import pool from "../config/db.js";
import fileUtil from "../utils/deleteFile.js";

const { deleteFile, deleteUpload } = fileUtil;

const COMMENT_SELECT = `
  SELECT
    c.id, c.post_id, c.comment, c.image, c.created_at, updated_at,
    u.id AS user_id, u.name AS user_name, u.avatar AS user_avatar
  FROM comments c
  JOIN users u ON u.id = c.user_id
`;

const formatComment = (r) => ({
  id: r.id,
  post_id: r.post_id,
  comment: r.comment,
  image: r.image,
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

    // Terlama di atas, terbaru di bawah (urutan percakapan)
    const [rows] = await pool.query(
      `${COMMENT_SELECT} WHERE c.post_id = ? ORDER BY c.id ASC`,
      [postId]
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

    const comment = req.body.comment || null; // "" -> NULL
    if (!comment && !req.file) {
      return res.status(400).json({
        message: "Validation failed",
        errors: { comment: "Write comment or attach image" },
      });
    }

    const image = req.file ? `/uploads/comments/${req.file.filename}` : null;

    const [result] = await pool.query(
      "INSERT INTO comments (post_id, user_id, comment, image) VALUES (?, ?, ?, ?)",
      [postId, req.user.id, comment, image]
    );

    const [rows] = await pool.query(`${COMMENT_SELECT} WHERE c.id = ?`, [
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
  try {
    const postId = Number(req.params.id);
    const commentId = Number(req.params.commentId);
    if (
      !Number.isInteger(postId) || postId < 1 ||
      !Number.isInteger(commentId) || commentId < 1
    ) {
      return res.status(400).json({ message: "ID tidak valid" });
    }

    const comment = req.body.comment || null; // "" -> NULL

    // post_id ikut dicek agar komentar benar-benar milik post di URL
    const [rows] = await pool.query(
      "SELECT user_id, image, comment FROM comments WHERE id = ? AND post_id = ? LIMIT 1",
      [commentId, postId]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: "Komentar tidak ditemukan" });
    }
    if (rows[0].user_id !== req.user.id) {
      return res
        .status(403)
        .json({ message: "Anda tidak berhak mengedit komentar ini" });
    }

    // Komentar tanpa gambar harus tetap punya teks
    if (!comment && !rows[0].image) {
      return res.status(400).json({
        message: "Validasi gagal",
        errors: {
          comment: "Komentar tidak boleh kosong karena tidak memiliki gambar",
        },
      });
    }

    // Hanya sentuh updated_at kalau isinya memang berubah
    if ((rows[0].comment ?? null) !== comment) {
      const [result] = await pool.query(
        "UPDATE comments SET comment = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
        [comment, commentId, req.user.id]
      );
      if (result.affectedRows === 0) {
        return res.status(404).json({ message: "Komentar tidak ditemukan" });
      }
    }

    const [updated] = await pool.query(`${COMMENT_SELECT} WHERE c.id = ?`, [
      commentId,
    ]);

    return res.json({
      message: "Komentar berhasil diperbarui",
      comment: formatComment(updated[0]),
    });
  } catch (err) {
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
      "SELECT user_id, image FROM comments WHERE id = ? LIMIT 1",
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

    // Catat gambar komentar sebelum dihapus. Barisnya ikut terhapus lewat
    // ON DELETE CASCADE, tapi filenya di disk tidak.
    // const [commentImages] = await pool.query(
    //   "SELECT image FROM comments WHERE post_id = ? AND image IS NOT NULL",
    //   [id]
    // );

    
    // user_id di WHERE sebagai pengaman kedua
    const [result] = await pool.query(
      "DELETE FROM comments WHERE id = ? AND user_id = ?",
      [commentId, req.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Comment not found" });
    }

    await deleteUpload(rows[0].image); // buang file gambar komentar dari disk

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

export default { getComments, createComment, updateComment, deleteComment };