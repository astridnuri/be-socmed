import Joi from "joi";

const createCommentSchema = Joi.object({
  comment: Joi.string().trim().allow("").max(300).messages({
    "string.max": "Comment max. 300 characters",
  }),
  parent_comment_id: Joi.number().integer().positive().optional(),
});

const updateCommentSchema = Joi.object({
  comment: Joi.string().trim().allow("").max(300).required().messages({
    "string.max": "Comment max. 300 characters",
    "any.required": "Comment is required",
  }),
});

export default { createCommentSchema, updateCommentSchema };