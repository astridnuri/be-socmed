import bcrypt from "bcrypt";
import pool from "../config/db.js";
import fileUtil from "../utils/deleteFile.js";

const { deleteFile, deleteUpload } = fileUtil;

const updateProfile = async (req, res, next) => {
  const discardUpload = () => deleteFile(req.file?.path);

  try {
    const { name, bio, removeAvatar, oldPassword, newPassword } = req.body;

    const [rows] = await pool.query(
      "SELECT name, email, bio, avatar, password FROM users WHERE id = ? LIMIT 1",
      [req.user.id]
    );
    if (rows.length === 0) {
      await discardUpload();
      return res.status(401).json({ message: "Account not found" });
    }
    const current = rows[0];

    // Kumpulkan hanya kolom yang benar-benar berubah
    const fields = {};

    // 1. Password (opsional). Validator menjamin ketiganya terisi bersama.
    if (oldPassword) {
      const match = await bcrypt.compare(oldPassword, current.password);
      if (!match) {
        await discardUpload();
        // Sengaja 400, bukan 401, supaya frontend tidak logout otomatis
        return res.status(400).json({
          message: "Incorrest old password",
          errors: { oldPassword: "Incorrest old password" },
        });
      }
      fields.password = await bcrypt.hash(newPassword, 10);
    }

    // 2. Nama dan bio
    if (name !== undefined) fields.name = name;
    if (bio !== undefined) fields.bio = bio || null; // "" -> NULL

    // 3. Avatar: file baru > hapus avatar
    if (req.file) fields.avatar = `/uploads/avatars/${req.file.filename}`;
    else if (removeAvatar) fields.avatar = null;

    if (Object.keys(fields).length === 0) {
      await discardUpload();
      return res.status(400).json({ message: "No data changed" });
    }

    // mysql2 pool.query mengubah "SET ?" menjadi: SET `name` = 'x', `bio` = 'y'
    // Nama kolom hanya berasal dari kode di atas, bukan dari input user.
    await pool.query("UPDATE users SET ? WHERE id = ?", [fields, req.user.id]);

    // Hapus file avatar lama hanya setelah UPDATE sukses
    if ("avatar" in fields && fields.avatar !== current.avatar) {
      await deleteUpload(current.avatar);
    }

    return res.json({
      message: "Profile updated",
      passwordChanged: "password" in fields,
      user: {
        id: req.user.id,
        name: "name" in fields ? fields.name : current.name,
        email: current.email,
        avatar: "avatar" in fields ? fields.avatar : current.avatar,
        bio: "bio" in fields ? fields.bio : current.bio,
      },
    });
  } catch (err) {
    await discardUpload(); // update gagal, buang file baru
    next(err);
  }
};

export default { updateProfile };