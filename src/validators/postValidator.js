import Joi from "joi";

const createPostSchema = Joi.object({
  content: Joi.string().trim().allow("").max(500).messages({
    "string.max": "Text max. 500 characters",
  }),
});

const updatePostSchema = Joi.object({
  content: Joi.string().trim().allow("").max(500).required().messages({
    "string.max": "Teks maksimal 500 karakter",
    "any.required": "Teks wajib dikirim",
  }),
});

export default { createPostSchema, updatePostSchema };