const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
const { z } = require("zod");
const { ApolloServer } = require("@apollo/server");
const { expressMiddleware } = require("@as-integrations/express5");

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

function formatDocument(document) {
  if (!document) return null;

  return {
    ...document,
    id: document._id.toString(),
    createdAt: document.createdAt
        ? new Date(document.createdAt).toISOString()
        : null,
  };
}

const typeDefs = `#graphql
  scalar JSON

  type View {
    id: ID!
    source: String!
    url: String!
    visitor: String!
    meta: JSON
    createdAt: String!
  }

  type Action {
    id: ID!
    source: String!
    url: String!
    visitor: String!
    action: String!
    meta: JSON
    createdAt: String!
  }

  type Goal {
    id: ID!
    source: String!
    url: String!
    visitor: String!
    goal: String!
    meta: JSON
    createdAt: String!
  }

  type GoalDetails {
    id: ID!
    source: String!
    url: String!
    visitor: String!
    goal: String!
    meta: JSON
    createdAt: String!
    views: [View!]!
    actions: [Action!]!
  }

  input CreateViewInput {
    source: String!
    url: String!
    visitor: String!
    meta: JSON
  }

  input CreateActionInput {
    source: String!
    url: String!
    visitor: String!
    action: String!
    meta: JSON
  }

  input CreateGoalInput {
    source: String!
    url: String!
    visitor: String!
    goal: String!
    meta: JSON
  }

  type Query {
    views: [View!]!
    actions: [Action!]!
    goals: [Goal!]!
    goalDetails(goalId: ID!): GoalDetails
  }

  type Mutation {
    createView(input: CreateViewInput!): View!
    createAction(input: CreateActionInput!): Action!
    createGoal(input: CreateGoalInput!): Goal!
  }
`;

const JSONScalar = {
  __serialize(value) {
    return value;
  },
  __parseValue(value) {
    return value;
  },
  __parseLiteral(ast) {
    switch (ast.kind) {
      case "StringValue":
      case "BooleanValue":
        return ast.value;
      case "IntValue":
      case "FloatValue":
        return Number(ast.value);
      case "ObjectValue": {
        const value = {};
        ast.fields.forEach((field) => {
          value[field.name.value] = JSONScalar.__parseLiteral(field.value);
        });
        return value;
      }
      case "ListValue":
        return ast.values.map(JSONScalar.__parseLiteral);
      case "NullValue":
        return null;
      default:
        return null;
    }
  },
};

function createResolvers(db) {
  return {
    JSON: JSONScalar,

    Query: {
      views: async () => {
        const documents = await db.collection("views").find({}).toArray();
        return documents.map(formatDocument);
      },

      actions: async () => {
        const documents = await db.collection("actions").find({}).toArray();
        return documents.map(formatDocument);
      },

      goals: async () => {
        const documents = await db.collection("goals").find({}).toArray();
        return documents.map(formatDocument);
      },

      goalDetails: async (_, { goalId }) => {
        if (!isObjectId(goalId)) {
          throw new Error("Invalid goal id");
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
          return null;
        }

        return formatDocument({
          ...result[0],
          views: result[0].views.map(formatDocument),
          actions: result[0].actions.map(formatDocument),
        });
      },
    },

    Mutation: {
      createView: async (_, { input }) => {
        const result = await CreateViewSchema.safeParseAsync(input);

        if (!result.success) {
          throw new Error("Invalid view data");
        }

        const document = createDocument(result.data);
        const ack = await db.collection("views").insertOne(document);

        return formatDocument({
          _id: ack.insertedId,
          ...document,
        });
      },

      createAction: async (_, { input }) => {
        const result = await CreateActionSchema.safeParseAsync(input);

        if (!result.success) {
          throw new Error("Invalid action data");
        }

        const document = createDocument(result.data);
        const ack = await db.collection("actions").insertOne(document);

        return formatDocument({
          _id: ack.insertedId,
          ...document,
        });
      },

      createGoal: async (_, { input }) => {
        const result = await CreateGoalSchema.safeParseAsync(input);

        if (!result.success) {
          throw new Error("Invalid goal data");
        }

        const document = createDocument(result.data);
        const ack = await db.collection("goals").insertOne(document);

        return formatDocument({
          _id: ack.insertedId,
          ...document,
        });
      },
    },
  };
}

async function createApp(db) {
  const app = express();

  const server = new ApolloServer({
    typeDefs,
    resolvers: createResolvers(db),
  });

  await server.start();

  app.use(
      "/graphql",
      cors(),
      express.json(),
      expressMiddleware(server)
  );

  app.get("/", (req, res) => {
    res.send({
      message: "GraphQL Analytics API",
      graphqlEndpoint: "POST /graphql",
      playground: "http://localhost:8010/graphql",
      queries: {
        views: "query { views { id source url visitor meta createdAt } }",
        actions: "query { actions { id source url visitor action meta createdAt } }",
        goals: "query { goals { id source url visitor goal meta createdAt } }",
        goalDetails:
            "query { goalDetails(goalId: \"GOAL_ID\") { id goal visitor views { id url } actions { id action } } }",
      },
      mutations: {
        createView:
            "mutation { createView(input: { source: \"website\", url: \"/home\", visitor: \"user1\" }) { id source url visitor createdAt } }",
        createAction:
            "mutation { createAction(input: { source: \"website\", url: \"/home\", visitor: \"user1\", action: \"click\" }) { id action createdAt } }",
        createGoal:
            "mutation { createGoal(input: { source: \"website\", url: \"/checkout\", visitor: \"user1\", goal: \"purchase\" }) { id goal createdAt } }",
      },
    });
  });

  return app;
}

async function start() {
  const client = new MongoClient(mongoUrl);
  await client.connect();

  const db = client.db("myDB_analytics");
  const app = await createApp(db);

  app.listen(port, () => {
    console.log(`Listening on http://localhost:${port}`);
    console.log(`GraphQL endpoint: http://localhost:${port}/graphql`);
  });
}

if (require.main === module) {
  start().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { createApp };