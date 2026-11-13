import multer from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const UPLOAD_ROOT = path.join(__dirname, "..", "..", "uploads");

const ALLOWED = {
  "image/jpeg": ".jpeg",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

// createUpload("avatars", 2) -> simpan di uploads/avatars, maksimal 2 MB
const createUpload = (folder, maxSizeMB = 5) => {
  const dest = path.join(UPLOAD_ROOT, folder);
  fs.mkdirSync(dest, { recursive: true });

  return multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => cb(null, dest),
      // nama acak, ekstensi dari MIME, bukan dari nama file asli user
      filename: (req, file, cb) =>
        cb(null, `${crypto.randomUUID()}${ALLOWED[file.mimetype]}`),
    }),
    limits: { fileSize: maxSizeMB * 1024 * 1024, files: 1 },
    fileFilter: (req, file, cb) => {
      if (!ALLOWED[file.mimetype]) {
        const err = new Error("Image format must be JPEG, JPG, PNG, or WEBP");
        err.status = 400;
        err.field = file.fieldname;
        return cb(err);
      }
      cb(null, true);
    },
  });
};

export default createUpload;