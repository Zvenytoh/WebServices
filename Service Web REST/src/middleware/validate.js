function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);

    if (!result.success) {
      return res.status(400).send({
        message: "Invalid request body",
        errors: result.error.flatten(),
      });
    }

    req.body = result.data;
    return next();
  };
}

module.exports = validate;
