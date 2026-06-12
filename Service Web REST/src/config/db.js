const postgres = require("postgres");

const sql = postgres({
  host: process.env.POSTGRES_HOST || "localhost",
  port: Number(process.env.POSTGRES_PORT || 5432),
  database: process.env.POSTGRES_DB || "mydb",
  username: process.env.POSTGRES_USER || "user",
  password: process.env.POSTGRES_PASSWORD || "password",
});

module.exports = sql;
