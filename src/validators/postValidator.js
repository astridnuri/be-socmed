import Joi from "joi";

const createPostSchema = Joi.object({
  content: Joi.string().trim().allow("").max(500).messages({
    "string.max": "Text max. 500 characters",
  }),
  location: Joi.string().trim().allow("").max(255).messages({
    "string.max": "Location max. 255 characters",
  }),
});

const updatePostSchema = Joi.object({
  content: Joi.string().trim().allow("").max(500).required().messages({
    "string.max": "Text max. 500 characters",
    "any.required": "Text is required",
  }),
  removeImage: Joi.boolean().default(false),
});

export default { createPostSchema, updatePostSchema };