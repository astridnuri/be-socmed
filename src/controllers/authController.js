import bcrypt from "bcrypt";
import pool from "../config/db.js";
import jwtUtil from "../utils/jwt.js";

const EMAIL_TAKEN = {
  message: "Email already taken",
  errors: { email: "Email already taken" },
};

const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    const [existing] = await pool.query(
      "SELECT id FROM users WHERE email = ? LIMIT 1",
      [email]
    );
    if (existing.length > 0) return res.status(409).json(EMAIL_TAKEN);

    const hash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      "INSERT INTO users (name, email, password) VALUES (?, ?, ?)",
      [name, email, hash]
    );

    const user = { id: result.insertId, name, email, avatar: null, bio: null };

    // Auto-login: langsung kirim token, tanpa lewat form login
    const token = jwtUtil.signToken({ id: user.id });
    return res.status(201).json({ message: "Registration success", token, user });
  } catch (err) {
    // Dua request bersamaan dengan email sama, UNIQUE KEY jadi pengaman terakhir
    if (err.code === "ER_DUP_ENTRY") return res.status(409).json(EMAIL_TAKEN);
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const [rows] = await pool.query(
      "SELECT id, name, email, password, avatar, bio FROM users WHERE email = ? LIMIT 1",
      [email]
    );
    const found = rows[0];

    // Pesan sama untuk email salah maupun password salah
    const invalid = { message: "Incorrect email or password" };
    if (!found) return res.status(401).json(invalid);

    const match = await bcrypt.compare(password, found.password);
    if (!match) return res.status(401).json(invalid);

    const { password: _pw, ...user } = found;
    const token = jwtUtil.signToken({ id: user.id });
    return res.json({ message: "Login success", token, user });
  } catch (err) {
    next(err);
  }
};

const me = async (req, res, next) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, name, email, avatar, bio FROM users WHERE id = ? LIMIT 1",
      [req.user.id]
    );
    if (rows.length === 0) {
      return res.status(401).json({ message: "Account not found" });
    }
    return res.json({ user: rows[0] });
  } catch (err) {
    next(err);
  }
};

export default { register, login, me };