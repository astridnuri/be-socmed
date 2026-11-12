import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SERVER_ROOT = path.join(__dirname, "..", "..");

// Hapus file berdasarkan path absolut (dipakai saat upload batal/gagal)
const deleteFile = async (absolutePath) => {
  if (!absolutePath) return;
  try {
    await fs.unlink(absolutePath);
  } catch {
    // file sudah tidak ada, abaikan
  }
};

// Hapus file berdasarkan path yang tersimpan di DB, misal "/uploads/avatars/abc.jpg"
const deleteUpload = async (storedPath) => {
  if (!storedPath || !storedPath.startsWith("/uploads/")) return;
  await deleteFile(path.join(SERVER_ROOT, storedPath));
};

export default { deleteFile, deleteUpload };