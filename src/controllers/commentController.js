import pool from "../config/db.js";
import fileUtil from "../utils/deleteFile.js";

const { deleteFile, deleteUpload } = fileUtil;

const COMMENT_SELECT = `
  SELECT
    c.id, c.post_id, c.parent_comment_id, c.comment, c.image, c.created_at, updated_at,
    (SELECT COUNT(*) FROM comment_likes cl WHERE cl.comment_id = c.id) AS likes_count,
    EXISTS(
      SELECT 1 FROM comment_likes cl2
      WHERE cl2.comment_id = c.id AND cl2.user_id = ?
    ) AS liked_by_me,
    u.id AS user_id, u.name AS user_name, u.avatar AS user_avatar
  FROM comments c
  JOIN users u ON u.id = c.user_id
`;

const formatComment = (r) => ({
  id: r.id,
  post_id: r.post_id,
  parent_comment_id: r.parent_comment_id,
  comment: r.comment,
  image: r.image,
  likes_count: Number(r.likes_count),
  liked_by_me: Boolean(r.liked_by_me),
  created_at: r.created_at,
  updated_at: r.updated_at,
  user: { id: r.user_id, name: r.user_name, avatar: r.user_avatar },
});

const getComments = async (req, res, next) => {
  try {
    const postId = Number(req.params.id);
    if (!Number.isInteger(postId) || postId < 1) {
      return res.status(400).json({ message: "Invalid post ID" });
    }

    const [posts] = await pool.query("SELECT id FROM posts WHERE id = ? LIMIT 1", [
      postId,
    ]);
    if (posts.length === 0) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Pertama di atas, trbaru di bawah (urutan chat)
    const [rows] = await pool.query(
      `${COMMENT_SELECT} WHERE c.post_id = ? ORDER BY c.id ASC`,
      [req.user.id, postId]
    );

    return res.json({ comments: rows.map(formatComment) });
  } catch (err) {
    next(err);
  }
};

const createComment = async (req, res, next) => {
  // Multer sudah menyimpan file sebelum controller jalan,
  // jadi setiap jalur gagal harus membuangnya.
  const discardUpload = () => deleteFile(req.file?.path);

  try {
    const postId = Number(req.params.id);
    if (!Number.isInteger(postId) || postId < 1) {
      await discardUpload();
      return res.status(400).json({ message: "Invalid post ID" });
    }

    const [posts] = await pool.query("SELECT id FROM posts WHERE id = ? LIMIT 1", [
      postId,
    ]);
    if (posts.length === 0) {
      await discardUpload();
      return res.status(404).json({ message: "Post not found" });
    }

    const parentCommentId = req.body.parent_comment_id ?? null;
    if (parentCommentId !== null) {
      const [parents] = await pool.query(
        "SELECT id FROM comments WHERE id = ? AND post_id = ? AND parent_comment_id IS NULL LIMIT 1",
        [parentCommentId, postId]
      );
      if (parents.length === 0) {
        await discardUpload();
        return res.status(400).json({ message: "Invalid parent comment" });
      }
    }

    const comment = req.body.comment || null; // "" -> NULL
    if (!comment && !req.file) {
      return res.status(400).json({
        message: "Validation failed",
        errors: { comment: "Write comment or attach image" },
      });
    }

    const image = req.file ? `/uploads/comments/${req.file.filename}` : null;

    const [result] = await pool.query(
      "INSERT INTO comments (post_id, user_id, parent_comment_id, comment, image) VALUES (?, ?, ?, ?, ?)",
      [postId, req.user.id, parentCommentId, comment, image]
    );

    const [rows] = await pool.query(`${COMMENT_SELECT} WHERE c.id = ?`, [
      req.user.id,
      result.insertId,
    ]);
    const [[{ total }]] = await pool.query(
      "SELECT COUNT(*) AS total FROM comments WHERE post_id = ?",
      [postId]
    );

    return res.status(201).json({
      message: "Comment sent",
      comment: formatComment(rows[0]),
      comments_count: Number(total), // untuk memperbarui angka di kartu post
    });
  } catch (err) {
    await discardUpload();
    next(err);
  }
};

const updateComment = async (req, res, next) => {
  let updateSaved = false;
  const discardUpload = () => deleteFile(req.file?.path);

  try {
    const postId = Number(req.params.id);
    const commentId = Number(req.params.commentId);
    if (
      !Number.isInteger(postId) || postId < 1 ||
      !Number.isInteger(commentId) || commentId < 1
    ) {
      await discardUpload();
      return res.status(400).json({ message: "Invalid ID" });
    }

    const comment = req.body.comment || null; // "" -> NULL
    const removeImage = req.body.removeImage;

    // post_id ikut dicek agar komentar benar-benar milik post di URL
    const [rows] = await pool.query(
      "SELECT user_id, image, comment FROM comments WHERE id = ? AND post_id = ? LIMIT 1",
      [commentId, postId]
    );
    if (rows.length === 0) {
      await discardUpload();
      return res.status(404).json({ message: "Comment not found" });
    }
    if (rows[0].user_id !== req.user.id) {
      await discardUpload();
      return res
        .status(403)
        .json({ message: "You're unauthorized to edit this comment" });
    }

    const image = req.file
      ? `/uploads/comments/${req.file.filename}`
      : removeImage
        ? null
        : rows[0].image;

    // Komentar tanpa gambar harus tetap punya teks
    if (!comment && !image) {
      await discardUpload();
      return res.status(400).json({
        message: "Validation failed",
        errors: {
          comment: "Comment without image cannot be empty",
        },
      });
    }

    const commentChanged = (rows[0].comment ?? null) !== comment;
    const imageChanged = rows[0].image !== image;
    if (commentChanged || imageChanged) {
      const [result] = await pool.query(
        "UPDATE comments SET comment = ?, image = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
        [comment, image, commentId, req.user.id]
      );
      if (result.affectedRows === 0) {
        await discardUpload();
        return res.status(404).json({ message: "Comment not found" });
      }
      updateSaved = true;
    }

    const [updated] = await pool.query(`${COMMENT_SELECT} WHERE c.id = ?`, [
      req.user.id,
      commentId,
    ]);

    if (imageChanged) await deleteUpload(rows[0].image);

    return res.json({
      message: "Comment updated",
      comment: formatComment(updated[0]),
    });
  } catch (err) {
    if (!updateSaved) await discardUpload();
    next(err);
  }
};

const deleteComment = async (req, res, next) => {
  try {
    const postId = Number(req.params.id);
    const commentId = Number(req.params.commentId);
    if (
      !Number.isInteger(postId) || postId < 1 ||
      !Number.isInteger(commentId) || commentId < 1
    ) {
      return res.status(400).json({ message: "Invalid ID" });
    }

    const [rows] = await pool.query(
      "SELECT id, user_id, image, parent_comment_id FROM comments WHERE id = ? AND post_id = ? LIMIT 1",
      [commentId, postId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: "Comment not found" });
    }
    if (rows[0].user_id !== req.user.id) {
      return res
        .status(403)
        .json({ message: "You cannot delete this comment" });
    }

    const commentsToDelete = [rows[0]];
    if (rows[0].parent_comment_id === null) {
      const [replies] = await pool.query(
        "SELECT id, image FROM comments WHERE parent_comment_id = ? AND post_id = ?",
        [commentId, postId]
      );
      commentsToDelete.push(...replies);
    }

    const commentIds = commentsToDelete.map((comment) => comment.id);
    const placeholders = commentIds.map(() => "?").join(", ");
    const [result] = await pool.query(
      `DELETE FROM comments WHERE post_id = ? AND id IN (${placeholders})`,
      [postId, ...commentIds]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Comment not found" });
    }

    await Promise.all(commentsToDelete.map((comment) => deleteUpload(comment.image)));

    const [[{ total }]] = await pool.query(
      "SELECT COUNT(*) AS total FROM comments WHERE post_id = ?",
      [postId]
    );

    return res.json({
      message: "Comment deleted",
      comments_count: Number(total),
    });
  } catch (err) {
    next(err);
  }
};

const toggleLike = async (req, res, next) => {
  try {
    const postId = Number(req.params.id);
    const commentId = Number(req.params.commentId);
    if (
      !Number.isInteger(postId) || postId < 1 ||
      !Number.isInteger(commentId) || commentId < 1
    ) {
      return res.status(400).json({ message: "Invalid ID" });
    }

    const [comments] = await pool.query(
      "SELECT id FROM comments WHERE id = ? AND post_id = ? LIMIT 1",
      [commentId, postId]
    );
    if (comments.length === 0) {
      return res.status(404).json({ message: "Comment not found" });
    }

    const [deleted] = await pool.query(
      "DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?",
      [commentId, req.user.id]
    );

    let liked = false;
    if (deleted.affectedRows === 0) {
      try {
        await pool.query(
          "INSERT INTO comment_likes (comment_id, user_id) VALUES (?, ?)",
          [commentId, req.user.id]
        );
      } catch (err) {
        if (err.code !== "ER_DUP_ENTRY") throw err;
      }
      liked = true;
    }

    const [[{ total }]] = await pool.query(
      "SELECT COUNT(*) AS total FROM comment_likes WHERE comment_id = ?",
      [commentId]
    );

    return res.json({ liked, likes_count: Number(total) });
  } catch (err) {
    next(err);
  }
};

export default { getComments, createComment, updateComment, deleteComment, toggleLike };