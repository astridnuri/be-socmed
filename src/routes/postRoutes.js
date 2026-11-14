import { Router } from "express";
import postController from "../controllers/postController.js";
import likeController from "../controllers/likeController.js";
import commentController from "../controllers/commentController.js";
import authMiddleware from "../middlewares/authMiddleware.js";
import validate from "../middlewares/validate.js";
import createUpload from "../middlewares/upload.js";
import postValidator from "../validators/postValidator.js";
import commentValidator from "../validators/commentValidator.js";

const router = Router();
const { requireAuth } = authMiddleware;
const { createPostSchema, updatePostSchema } = postValidator;
const { createCommentSchema, updateCommentSchema } = commentValidator;

const uploadPostImage = createUpload("posts", 5); // maks 5 MB
const uploadCommentImage = createUpload("comments", 5); // maks 5 MB

// Feed publik: guest boleh melihat, user login mendapat liked_by_me
router.get("/", requireAuth, postController.getPosts);

// requireAuth dulu, baru upload, supaya guest tidak bisa mengisi disk
router.post(
  "/",
  requireAuth,
  uploadPostImage.single("image"),
  validate(createPostSchema),
  postController.createPost
);
router.put(
  "/:id",
  requireAuth,
  uploadPostImage.single("image"),
  validate(updatePostSchema),
  postController.updatePost
);
router.delete("/:id", requireAuth, postController.deletePost);

router.post("/:id/like", requireAuth, likeController.toggleLike);

// --- Comments ---
router.get("/:id/comments", requireAuth, commentController.getComments);
router.post(
  "/:id/comments",
  requireAuth,
  uploadCommentImage.single("image"),
  validate(createCommentSchema),
  commentController.createComment
);
router.put(
  "/:id/comments/:commentId",
  requireAuth,
  uploadCommentImage.single("image"),
  validate(updateCommentSchema),
  commentController.updateComment
);
router.delete("/:id/comments/:commentId", requireAuth, commentController.deleteComment);
router.post(
  "/:id/comments/:commentId/like",
  requireAuth,
  commentController.toggleLike
);

export default router;