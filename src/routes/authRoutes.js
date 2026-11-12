import { Router } from "express";
import authController from "../controllers/authController.js";
import authMiddleware from "../middlewares/authMiddleware.js";
import validate from "../middlewares/validate.js";
import authValidator from "../validators/authValidator.js";

const router = Router();
const { requireAuth } = authMiddleware;
const { registerSchema, loginSchema } = authValidator;

router.post("/register", validate(registerSchema), authController.register);
router.post("/login", validate(loginSchema), authController.login);
router.get("/me", requireAuth, authController.me);

export default router;