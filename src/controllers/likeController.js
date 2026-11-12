import pool from "../config/db.js";

const toggleLike = async (req, res, next) => {
  try {
    const postId = Number(req.params.id);
    if (!Number.isInteger(postId) || postId < 1) {
      return res.status(400).json({ message: "Invalid post ID=" });
    }

    const [posts] = await pool.query("SELECT id FROM posts WHERE id = ? LIMIT 1", [
      postId,
    ]);
    if (posts.length === 0) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Coba hapus dulu. Kalau ada barisnya, berarti tadinya sudah like -> sekarang unlike.
    const [del] = await pool.query(
      "DELETE FROM likes WHERE user_id = ? AND post_id = ?",
      [req.user.id, postId]
    );

    let liked = false;
    if (del.affectedRows === 0) {
      // Belum pernah like -> buat like baru
      try {
        await pool.query("INSERT INTO likes (user_id, post_id) VALUES (?, ?)", [
          req.user.id,
          postId,
        ]);
      } catch (err) {
        // Klik ganda yang tiba bersamaan: UNIQUE KEY (user_id, post_id) menolak
        // duplikat. Artinya like sudah tercatat, jadi tetap dianggap liked.
        if (err.code !== "ER_DUP_ENTRY") throw err;
      }
      liked = true;
    }

    const [[{ total }]] = await pool.query(
      "SELECT COUNT(*) AS total FROM likes WHERE post_id = ?",
      [postId]
    );

    return res.json({ liked, likes_count: Number(total) });
  } catch (err) {
    next(err);
  }
};

export default { toggleLike };