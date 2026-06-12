const assert = require("node:assert/strict");
const { after, before, beforeEach, describe, it } = require("node:test");
const { MongoClient, ObjectId } = require("mongodb");
const request = require("supertest");
const { createApp } = require("./app");

const client = new MongoClient("mongodb://localhost:27017");
let db;
let app;

describe("Analytics REST API", () => {
  before(async () => {
    await client.connect();
    db = client.db("myDB_analytics_test");
    app = createApp(db);
  });

  beforeEach(async () => {
    await Promise.all([
      db.collection("views").deleteMany({}),
      db.collection("actions").deleteMany({}),
      db.collection("goals").deleteMany({}),
    ]);
  });

  after(async () => {
    await Promise.all([
      db.collection("views").deleteMany({}),
      db.collection("actions").deleteMany({}),
      db.collection("goals").deleteMany({}),
    ]);
    await client.close();
  });

  it("creates views, actions and goals with flexible meta fields", async () => {
    const view = await request(app)
      .post("/views")
      .send({
        source: "google",
        url: "/pricing",
        visitor: "visitor-1",
        meta: { browser: "Firefox", campaign: "summer" },
      })
      .expect(201);

    const action = await request(app)
      .post("/actions")
      .send({
        source: "newsletter",
        url: "/pricing",
        action: "click_cta",
        visitor: "visitor-1",
        meta: { x: 10, y: 20, element: { id: "cta" } },
      })
      .expect(201);

    const goal = await request(app)
      .post("/goals")
      .send({
        source: "direct",
        url: "/checkout",
        goal: "purchase",
        visitor: "visitor-1",
        meta: { amount: 99, currency: "EUR", items: ["plan-pro"] },
      })
      .expect(201);

    assert.equal(view.body.meta.campaign, "summer");
    assert.equal(action.body.meta.element.id, "cta");
    assert.deepEqual(goal.body.meta.items, ["plan-pro"]);
    assert.match(view.body.createdAt, /^\d{4}-\d{2}-\d{2}T/);
  });

  it("validates required analytics fields", async () => {
    await request(app)
      .post("/views")
      .send({ source: "", url: "", visitor: "", meta: [] })
      .expect(400);

    await request(app)
      .post("/actions")
      .send({ source: "site", url: "/x", visitor: "v1", meta: {} })
      .expect(400);

    await request(app)
      .post("/goals")
      .send({ source: "site", url: "/x", visitor: "v1", meta: {} })
      .expect(400);
  });

  it("returns goal details with views and actions for the same visitor", async () => {
    await db.collection("views").insertMany([
      {
        source: "google",
        url: "/home",
        visitor: "visitor-42",
        createdAt: new Date("2026-06-12T10:00:00.000Z"),
        meta: { device: "mobile" },
      },
      {
        source: "google",
        url: "/ignored",
        visitor: "other-visitor",
        createdAt: new Date("2026-06-12T11:00:00.000Z"),
        meta: { device: "desktop" },
      },
    ]);

    await db.collection("actions").insertMany([
      {
        source: "site",
        url: "/home",
        action: "open_menu",
        visitor: "visitor-42",
        createdAt: new Date("2026-06-12T10:01:00.000Z"),
        meta: { menu: "main" },
      },
      {
        source: "site",
        url: "/ignored",
        action: "ignored",
        visitor: "other-visitor",
        createdAt: new Date("2026-06-12T11:01:00.000Z"),
        meta: {},
      },
    ]);

    const createdGoal = await db.collection("goals").insertOne({
      source: "site",
      url: "/checkout",
      goal: "purchase",
      visitor: "visitor-42",
      createdAt: new Date("2026-06-12T10:05:00.000Z"),
      meta: { revenue: 49 },
    });

    const response = await request(app)
      .get(`/goals/${createdGoal.insertedId}/details`)
      .expect(200);

    assert.equal(response.body.goal, "purchase");
    assert.equal(response.body.views.length, 1);
    assert.equal(response.body.views[0].url, "/home");
    assert.equal(response.body.actions.length, 1);
    assert.equal(response.body.actions[0].action, "open_menu");
  });

  it("returns 400 and 404 for goal details errors", async () => {
    await request(app).get("/goals/not-an-id/details").expect(400);
    await request(app)
      .get(`/goals/${new ObjectId().toString()}/details`)
      .expect(404);
  });
});
