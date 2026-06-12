const test = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const app = require("../src/app");
const { hashPassword } = require("../src/services/password");

test("GET / returns Hello World", async () => {
  const response = await request(app).get("/");
  assert.equal(response.status, 200);
  assert.equal(response.text, "Hello World!");
});

test("hashPassword returns a SHA512 hex digest", () => {
  const digest = hashPassword("password");
  assert.equal(digest.length, 128);
  assert.match(digest, /^[a-f0-9]+$/);
});

test("POST /products rejects invalid product body", async () => {
  const response = await request(app).post("/products").send({
    name: "Bad product",
    about: "Negative price",
    price: -10,
  });

  assert.equal(response.status, 400);
  assert.equal(response.body.message, "Invalid request body");
});
