import Joi from "joi";

const createCommentSchema = Joi.object({
  comment: Joi.string().trim().allow("").max(300).messages({
    "string.max": "Comment max. 300 characters",
  }),
});

const updateCommentSchema = Joi.object({
  comment: Joi.string().trim().allow("").max(300).required().messages({
    "string.max": "Komentar maksimal 300 karakter",
    "any.required": "Komentar wajib dikirim",
  }),
});

export default { createCommentSchema, updateCommentSchema };