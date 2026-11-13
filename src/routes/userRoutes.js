import { Router } from "express";
import userController from "../controllers/userController.js";
import authMiddleware from "../middlewares/authMiddleware.js";
import validate from "../middlewares/validate.js";
import createUpload from "../middlewares/upload.js";
import userValidator from "../validators/userValidator.js";

const router = Router();
const { requireAuth } = authMiddleware;
const { updateProfileSchema } = userValidator;

const uploadAvatar = createUpload("avatars", 2); // maks 2 MB

// Wajib login, dipasang paling atas agar user tanpa token
// ditolak SEBELUM file sempat diupload.
router.use(requireAuth);

router.put(
  "/profile",
  uploadAvatar.single("avatar"), // 1. terima file (opsional)
  validate(updateProfileSchema), // 2. validasi field teks
  userController.updateProfile   // 3. simpan
);

router.get("/:id", userController.getPublicProfile);

export default router;