import pool from "../config/db.js";
import fileUtil from "../utils/deleteFile.js";

const { deleteFile, deleteUpload } = fileUtil;

// Query dasar feed. Parameter pertama (?) = id viewer, NULL kalau guest.
const POST_SELECT = `
  SELECT
    p.id, p.content, p.image, p.location, p.created_at, p.updated_at,
    u.id AS user_id, u.name AS user_name, u.avatar AS user_avatar,
    (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) AS likes_count,
    (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comments_count,
    EXISTS(
      SELECT 1 FROM likes l2 WHERE l2.post_id = p.id AND l2.user_id = ?
    ) AS liked_by_me
  FROM posts p
  JOIN users u ON u.id = p.user_id
`;

const formatPost = (r) => ({
  id: r.id,
  content: r.content,
  image: r.image,
  location: r.location,
  created_at: r.created_at,
  updated_at: r.updated_at,
  user: { id: r.user_id, name: r.user_name, avatar: r.user_avatar },
  likes_count: Number(r.likes_count),
  comments_count: Number(r.comments_count),
  liked_by_me: Boolean(r.liked_by_me),
});

const getPosts = async (req, res, next) => {
  try {
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 10, 1), 50);
    const cursor = parseInt(req.query.cursor, 10);
    const requestedUserId = req.query.userId;
    let userId = null;
    if (requestedUserId !== undefined) {
      if (
        typeof requestedUserId !== "string" ||
        !/^[1-9]\d*$/.test(requestedUserId) ||
        !Number.isSafeInteger(Number(requestedUserId))
      ) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      userId = Number(requestedUserId);
    }

    const params = [req.user?.id ?? null];
    const filters = [];
    if (userId !== null) {
      filters.push("p.user_id = ?");
      params.push(userId);
    }
    if (Number.isInteger(cursor) && cursor > 0) {
      filters.push("p.id < ?");
      params.push(cursor);
    }
    const where = filters.length > 0 ? `WHERE ${filters.join(" AND ")}` : "";
    params.push(limit + 1); // ambil 1 lebih banyak bwt cek apakah msh ada halaman berikutnya

    const [rows] = await pool.query(
      `${POST_SELECT} ${where} ORDER BY p.id DESC LIMIT ?`, //post terbaru di atas
      params
    );

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;

    return res.json({
      posts: items.map(formatPost),
      nextCursor: hasMore ? items[items.length - 1].id : null,
    });
  } catch (err) {
    next(err);
  }
};

const createPost = async (req, res, next) => {
  try {
    const content = req.body.content || null; // "" -> NULL
    const location = req.body.location?.trim() || null;

    if (!content && !req.file) {
      return res.status(400).json({
        message: "Validation failed",
        errors: { content: "Write comment or send image" },
      });
    }

    const image = req.file ? `/uploads/posts/${req.file.filename}` : null;

    const [result] = await pool.query(
      "INSERT INTO posts (user_id, content, image, location) VALUES (?, ?, ?, ?)",
      [req.user.id, content, image, location]
    );

    // Ambil ulang dengan query yang sama supaya bentuknya identik dengan item feed
    const [rows] = await pool.query(`${POST_SELECT} WHERE p.id = ?`, [
      req.user.id,
      result.insertId,
    ]);

    return res
      .status(201)
      .json({ message: "Post successfully created", post: formatPost(rows[0]) });
  } catch (err) {
    await deleteFile(req.file?.path); // gagal simpan, buang file yang sudah terupload
    next(err);
  }
};

const updatePost = async (req, res, next) => {
  let updateSaved = false;
  const discardUpload = () => deleteFile(req.file?.path);

  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      await discardUpload();
      return res.status(400).json({ message: "Invalid post ID" });
    }

    const content = req.body.content || null; // "" -> NULL
    const removeImage = req.body.removeImage;

    const [rows] = await pool.query(
      "SELECT user_id, image, content FROM posts WHERE id = ? LIMIT 1",
      [id]
    );
    if (rows.length === 0) {
      await discardUpload();
      return res.status(404).json({ message: "Post not found" });
    }
    if (rows[0].user_id !== req.user.id) {
      await discardUpload();
      return res
        .status(403)
        .json({ message: "You're unauthorized to edit this post" });
    }

    const image = req.file
      ? `/uploads/posts/${req.file.filename}`
      : removeImage
        ? null
        : rows[0].image;

    // Postingan tanpa gambar harus tetap punya teks
    if (!content && !image) {
      await discardUpload();
      return res.status(400).json({
        message: "Validation failed",
        errors: { content: "Post without image cannot be empty" },
      });
    }

    const contentChanged = (rows[0].content ?? null) !== content;
    const imageChanged = rows[0].image !== image;
    if (contentChanged || imageChanged) {
      const [result] = await pool.query(
        "UPDATE posts SET content = ?, image = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
        [content, image, id, req.user.id]
      );
      if (result.affectedRows === 0) {
        await discardUpload();
        return res.status(404).json({ message: "Post not found" });
      }
      updateSaved = true;
    }

    const [updated] = await pool.query(`${POST_SELECT} WHERE p.id = ?`, [
      req.user.id,
      id,
    ]);

    if (imageChanged) await deleteUpload(rows[0].image);

    return res.json({
      message: "Post updated",
      post: formatPost(updated[0]),
    });
  } catch (err) {
    if (!updateSaved) await discardUpload();
    next(err);
  }
};

const deletePost = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ message: "Invalid post ID" });
    }

    const [rows] = await pool.query(
      "SELECT user_id, image FROM posts WHERE id = ? LIMIT 1",
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ message: "Post not found" });
    }
    if (rows[0].user_id !== req.user.id) {
      return res
        .status(403)
        .json({ message: "You cannot delete this post" });
    }

    // Catat gambar komen sebelum dihapus. Barisnya ikut terhapus krn pakai
    // ON DELETE CASCADE, tapi filenya di disk tidak.
    const [commentImages] = await pool.query(
      "SELECT image FROM comments WHERE post_id = ? AND image IS NOT NULL",
      [id]
    );

    // user_id di WHERE sebagai pengaman kedua
    const [result] = await pool.query(
      "DELETE FROM posts WHERE id = ? AND user_id = ?",
      [id, req.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Post not found" });
    }

    await Promise.all([
      deleteUpload(rows[0].image),
      ...commentImages.map((c) => deleteUpload(c.image)),
    ]);

    return res.json({ message: "Post deleted" });
  } catch (err) {
    next(err);
  }
};

export default { getPosts, createPost, updatePost, deletePost };