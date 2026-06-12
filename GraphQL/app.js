const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const { z } = require("zod");

const port = 8010;
const mongoUrl = "mongodb://localhost:27017";

const isObjectId = (value) =>
  ObjectId.isValid(value) && new ObjectId(value).toString() === value;

const metaSchema = z.record(z.string(), z.any());

const AnalyticsBaseSchema = z.object({
  source: z.string().min(1),
  url: z.string().min(1),
  visitor: z.string().min(1),
  meta: metaSchema.default({}),
});

const CreateViewSchema = AnalyticsBaseSchema;
const CreateActionSchema = AnalyticsBaseSchema.extend({
  action: z.string().min(1),
});
const CreateGoalSchema = AnalyticsBaseSchema.extend({
  goal: z.string().min(1),
});

function createDocument(data) {
  return {
    ...data,
    createdAt: new Date(),
  };
}

function createPostRoute(db, collectionName, schema) {
  return async (req, res, next) => {
    try {
      const result = await schema.safeParseAsync(req.body);

      if (!result.success) {
        return res.status(400).send(result);
      }

      const document = createDocument(result.data);
      const ack = await db.collection(collectionName).insertOne(document);

      return res.status(201).send({ _id: ack.insertedId, ...document });
    } catch (error) {
      return next(error);
    }
  };
}

function createListRoute(db, collectionName) {
  return async (req, res, next) => {
    try {
      const documents = await db.collection(collectionName).find({}).toArray();

      return res.send(documents);
    } catch (error) {
      return next(error);
    }
  };
}

function createApp(db) {
  const app = express();

  app.use(express.json());

  app.get("/", (req, res) => {
    res.send({
      message: "REST Analytics API",
      endpoints: {
        createView: "POST /views",
        listViews: "GET /views",
        createAction: "POST /actions",
        listActions: "GET /actions",
        createGoal: "POST /goals",
        listGoals: "GET /goals",
        goalDetails: "GET /goals/:goalId/details",
      },
    });
  });

  app.post("/views", createPostRoute(db, "views", CreateViewSchema));
  app.get("/views", createListRoute(db, "views"));

  app.post("/actions", createPostRoute(db, "actions", CreateActionSchema));
  app.get("/actions", createListRoute(db, "actions"));

  app.post("/goals", createPostRoute(db, "goals", CreateGoalSchema));
  app.get("/goals", createListRoute(db, "goals"));

  app.get("/goals/:goalId/details", async (req, res, next) => {
    try {
      const { goalId } = req.params;

      if (!isObjectId(goalId)) {
        return res.status(400).send({ error: "Invalid goal id" });
      }

      const result = await db
        .collection("goals")
        .aggregate([
          { $match: { _id: new ObjectId(goalId) } },
          {
            $lookup: {
              from: "views",
              localField: "visitor",
              foreignField: "visitor",
              as: "views",
            },
          },
          {
            $lookup: {
              from: "actions",
              localField: "visitor",
              foreignField: "visitor",
              as: "actions",
            },
          },
        ])
        .toArray();

      if (result.length === 0) {
        return res.status(404).send({ error: "Goal not found" });
      }

      return res.send(result[0]);
    } catch (error) {
      return next(error);
    }
  });

  app.use((error, req, res, next) => {
    console.error(error);
    return res.status(500).send({ error: "Internal server error" });
  });

  return app;
}

async function start() {
  const client = new MongoClient(mongoUrl);
  await client.connect();

  const db = client.db("myDB_analytics");
  const app = createApp(db);

  app.listen(port, () => {
    console.log(`Listening on http://localhost:${port}`);
  });
}

if (require.main === module) {
  start().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { createApp };
