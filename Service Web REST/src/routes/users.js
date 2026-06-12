const express = require("express");
const sql = require("../config/db");
const validate = require("../middleware/validate");
const { hashPassword } = require("../services/password");
const {
  CreateUserSchema,
  UpdateUserSchema,
  PatchUserSchema,
} = require("../schemas/users");

const router = express.Router();

function formatUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
  };
}

router.get("/", async (req, res, next) => {
  try {
    const users = await sql`SELECT id, username, email FROM users ORDER BY username`;
    res.send(users.map(formatUser));
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const users = await sql`
      SELECT id, username, email FROM users WHERE id = ${req.params.id}
    `;

    if (users.length === 0) {
      return res.status(404).send({ message: "User not found" });
    }

    return res.send(formatUser(users[0]));
  } catch (error) {
    return next(error);
  }
});

router.post("/", validate(CreateUserSchema), async (req, res, next) => {
  try {
    const { username, email, password } = req.body;
    const users = await sql`
      INSERT INTO users (username, email, password)
      VALUES (${username}, ${email}, ${hashPassword(password)})
      RETURNING id, username, email
    `;

    res.status(201).send(formatUser(users[0]));
  } catch (error) {
    next(error);
  }
});

router.put("/:id", validate(UpdateUserSchema), async (req, res, next) => {
  try {
    const { username, email, password } = req.body;
    const users = await sql`
      UPDATE users
      SET username = ${username}, email = ${email}, password = ${hashPassword(password)}
      WHERE id = ${req.params.id}
      RETURNING id, username, email
    `;

    if (users.length === 0) {
      return res.status(404).send({ message: "User not found" });
    }

    return res.send(formatUser(users[0]));
  } catch (error) {
    return next(error);
  }
});

router.patch("/:id", validate(PatchUserSchema), async (req, res, next) => {
  try {
    const updates = { ...req.body };
    if (updates.password) updates.password = hashPassword(updates.password);

    const users = await sql`
      UPDATE users
      SET ${sql(updates)}
      WHERE id = ${req.params.id}
      RETURNING id, username, email
    `;

    if (users.length === 0) {
      return res.status(404).send({ message: "User not found" });
    }

    return res.send(formatUser(users[0]));
  } catch (error) {
    return next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const users = await sql`
      DELETE FROM users
      WHERE id = ${req.params.id}
      RETURNING id, username, email
    `;

    if (users.length === 0) {
      return res.status(404).send({ message: "User not found" });
    }

    return res.send(formatUser(users[0]));
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
module.exports.formatUser = formatUser;
