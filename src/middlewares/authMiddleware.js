import jwtUtil from "../utils/jwt.js";

// Ambil token dari header: Authorization: Bearer <token>
const getToken = (req) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) return null;
  return header.slice(7).trim();
};

// Wajib login
const requireAuth = (req, res, next) => {
  const token = getToken(req);
  if (!token) {
    return res.status(401).json({ message: "Please login first" });
  }
  try {
    const decoded = jwtUtil.verifyToken(token);
    req.user = { id: decoded.id };
    next();
  } catch {
    return res.status(401).json({ message: "Session ended or invalid" });
  }
};

// // Boleh guest. Kalau ada token valid, req.user terisi
// const optionalAuth = (req, res, next) => {
//   req.user = null;
//   const token = getToken(req);
//   if (token) {
//     try {
//       const decoded = jwtUtil.verifyToken(token);
//       req.user = { id: decoded.id };
//     } catch {
//       // token rusak atau kedaluwarsa dianggap guest
//     }
//   }
//   next();
// };

export default { requireAuth };