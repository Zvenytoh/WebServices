const crypto = require("node:crypto");

function hashPassword(password) {
  return crypto.createHash("sha512").update(password).digest("hex");
}

module.exports = { hashPassword };
