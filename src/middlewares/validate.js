import fileUtil from "../utils/deleteFile.js";

const validate = (schema) => async (req, res, next) => {
  const { error, value } = schema.validate(req.body, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    // Multer sudah menyimpan file sebelum validasi, jadi bersihkan
    if (req.file) await fileUtil.deleteFile(req.file.path);

    const errors = {};
    error.details.forEach((d) => {
      if (d.type === "object.and") {
        // d.context.missing = field yang belum diisi
        d.context.missing.forEach((key) => {
          if (!errors[key]) errors[key] = d.message;
        });
        return;
      }
      const key = d.path[0];
      if (key && !errors[key]) errors[key] = d.message;
    });
    return res.status(400).json({ message: "Validation failed", errors });
  }

  req.body = value;
  next();
};

export default validate;