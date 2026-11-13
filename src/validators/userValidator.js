import Joi from "joi";

const updateProfileSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).messages({
    "string.empty": "Name is required",
    "string.min": "Name min. 2 characters",
    "string.max": "Name max. 100 characters",
  }),
  bio: Joi.string().trim().allow("").max(300).messages({
    "string.max": "Bio max. 300 characters",
  }),
  removeAvatar: Joi.boolean().empty("").default(false),

  // Kosong ("") diperlakukan sama dengan tidak dikirim
  oldPassword: Joi.string().empty(""),
  newPassword: Joi.string()
    .empty("")
    .min(6)
    .max(72)
    .invalid(Joi.ref("oldPassword"))
    .messages({
      "string.min": "New password min. 6 characters",
      "string.max": "New password max. 72 characters",
      "any.invalid": "New password cannot be the same as old password",
    }),
  confirmPassword: Joi.any()
    .empty("")
    .valid(Joi.ref("newPassword"))
    .messages({
      "any.only": "Password confirmation doesn't match",
    }),
})
  // Ketiganya harus terisi semua, atau kosong semua
  .and("oldPassword", "newPassword", "confirmPassword")
  .messages({
    "object.and": "Required if you want to change password",
  });

export default { updateProfileSchema };