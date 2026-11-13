import Joi from "joi";

const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required().messages({
    "string.empty": "Name is required",
    "string.min": "Name min. 2 characters",
    "string.max": "Name max. 100 characters",
    "any.required": "Name is required",
  }),
  email: Joi.string().trim().lowercase().email().max(150).required().messages({
    "string.empty": "Email is required",
    "string.email": "Invalid email format",
    "string.max": "Email max. 150 characters",
    "any.required": "Email is required",
  }),
  password: Joi.string().min(6).max(72).required().messages({
    "string.empty": "Password is required",
    "string.min": "Password min. 6 characters",
    "string.max": "Password min. 72 characters",
    "any.required": "Password is required",
  }),
  confirmPassword: Joi.any().valid(Joi.ref("password")).required().messages({
    "any.only": "Password confirmation doesn't match",
    "any.required": "Password confirmation is required",
  }),
});

const loginSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().required().messages({
    "string.empty": "Email is required",
    "string.email": "Invalid email format",
    "any.required": "Email is required",
  }),
  password: Joi.string().min(6).required().messages({
    "string.empty": "Password is required",
    "string.min": "Password min. 6 characters",
    "any.required": "Password is required",
  }),
});

export default { registerSchema, loginSchema };