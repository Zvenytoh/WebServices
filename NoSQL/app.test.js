const assert = require("node:assert/strict");
const { createServer } = require("node:http");
const { after, before, beforeEach, describe, it } = require("node:test");
const { MongoClient, ObjectId } = require("mongodb");
const request = require("supertest");
const { io: createClient } = require("socket.io-client");
const { Server } = require("socket.io");
const { createApp } = require("./app");

const client = new MongoClient("mongodb://localhost:27017");
let db;
let app;
let httpServer;
let io;
let baseUrl;

describe("Products REST routes", () => {
  before(async () => {
    await client.connect();
    db = client.db("myDB_test");
    app = createApp(db);
    httpServer = createServer(app);
    io = new Server(httpServer);
    app.set("io", io);

    await new Promise((resolve) => {
      httpServer.listen(0, resolve);
    });

    const address = httpServer.address();
    baseUrl = `http://localhost:${address.port}`;
  });

  beforeEach(async () => {
    await db.collection("products").deleteMany({});
    await db.collection("categories").deleteMany({});
  });

  after(async () => {
    await db.collection("products").deleteMany({});
    await db.collection("categories").deleteMany({});
    io.close();
    await new Promise((resolve) => httpServer.close(resolve));
    await client.close();
  });

  it("creates, reads, updates and deletes a product", async () => {
    const category = await db
      .collection("categories")
      .insertOne({ name: "Informatique" });

    const created = await request(app)
      .post("/products")
      .send({
        name: "MacBook",
        about: "Ordinateur portable",
        price: 1200,
        categoryIds: [category.insertedId.toString()],
      })
      .expect(201);

    const productId = created.body._id;
    assert.equal(created.body.name, "MacBook");

    const found = await request(app).get(`/products/${productId}`).expect(200);

    assert.equal(found.body._id, productId);
    assert.equal(found.body.categories[0].name, "Informatique");

    const updated = await request(app)
      .put(`/products/${productId}`)
      .send({
        name: "MacBook Pro",
        about: "Ordinateur portable puissant",
        price: 1800,
        categoryIds: [category.insertedId.toString()],
      })
      .expect(200);

    assert.equal(updated.body.name, "MacBook Pro");
    assert.equal(updated.body.price, 1800);

    await request(app).delete(`/products/${productId}`).expect(204);
    await request(app).get(`/products/${productId}`).expect(404);
  });

  it("returns 400 for invalid product ids", async () => {
    await request(app).get("/products/not-an-object-id").expect(400);
    await request(app).put("/products/not-an-object-id").send({}).expect(400);
    await request(app).delete("/products/not-an-object-id").expect(400);
  });

  it("returns 400 for invalid product payloads", async () => {
    const id = new ObjectId().toString();

    await request(app)
      .post("/products")
      .send({ name: "", about: "", price: -1, categoryIds: ["bad-id"] })
      .expect(400);

    await request(app)
      .post("/products")
      .send({ name: "Valid", about: "Valid", price: 10 })
      .expect(400);

    await request(app)
      .put(`/products/${id}`)
      .send({ name: "Valid", about: "Valid", price: 0, categoryIds: [] })
      .expect(400);
  });

  it("lists categories", async () => {
    await request(app)
      .post("/categories")
      .send({ name: "Informatique" })
      .expect(201);

    const response = await request(app).get("/categories").expect(200);

    assert.equal(response.body.length, 1);
    assert.equal(response.body[0].name, "Informatique");
  });

  it("returns 404 when a product does not exist", async () => {
    const id = new ObjectId().toString();

    await request(app).get(`/products/${id}`).expect(404);

    await request(app)
      .put(`/products/${id}`)
      .send({
        name: "Missing",
        about: "Missing product",
        price: 99,
        categoryIds: [new ObjectId().toString()],
      })
      .expect(404);

    await request(app).delete(`/products/${id}`).expect(404);
  });

  it("emits products events when products change", async () => {
    const socket = createClient(baseUrl);
    const receivedEvents = [];

    socket.on("products", (event) => {
      receivedEvents.push(event);
    });

    await new Promise((resolve) => socket.on("connect", resolve));

    const category = await db
      .collection("categories")
      .insertOne({ name: "Temps reel" });

    const created = await request(app)
      .post("/products")
      .send({
        name: "Live Product",
        about: "Created in real time",
        price: 10,
        categoryIds: [category.insertedId.toString()],
      })
      .expect(201);

    await request(app)
      .put(`/products/${created.body._id}`)
      .send({
        name: "Live Product Updated",
        about: "Updated in real time",
        price: 20,
        categoryIds: [category.insertedId.toString()],
      })
      .expect(200);

    await request(app).delete(`/products/${created.body._id}`).expect(204);

    await waitFor(() => receivedEvents.length === 3);
    socket.close();

    assert.deepEqual(
      receivedEvents.map((event) => event.type),
      ["created", "updated", "deleted"],
    );
    assert.equal(receivedEvents[0].product.name, "Live Product");
    assert.equal(receivedEvents[0].product.categories[0].name, "Temps reel");
    assert.equal(receivedEvents[1].product.name, "Live Product Updated");
    assert.equal(receivedEvents[2].product._id, created.body._id);
  });
});

function waitFor(predicate) {
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      if (predicate()) {
        clearInterval(timer);
        resolve();
        return;
      }

      if (Date.now() - startedAt > 2000) {
        clearInterval(timer);
        reject(new Error("Timed out waiting for condition"));
      }
    }, 20);
  });
}
