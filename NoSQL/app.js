const { createServer } = require("node:http");
const { join } = require("node:path");
const express = require("express");
const { MongoClient, ObjectId } = require("mongodb");
const { Server } = require("socket.io");
const { z } = require("zod");

const port = 8000;
const mongoUrl = "mongodb://localhost:27017";

const isObjectId = (value) =>
  ObjectId.isValid(value) && new ObjectId(value).toString() === value;

const objectIdSchema = z.string().refine(isObjectId, {
  message: "Invalid MongoDB ObjectId",
});

const ProductSchema = z.object({
  _id: objectIdSchema,
  name: z.string().min(1),
  about: z.string().min(1),
  price: z.number().positive(),
  categoryIds: z.array(objectIdSchema).min(1),
});

const CreateProductSchema = ProductSchema.omit({ _id: true });
const UpdateProductSchema = CreateProductSchema;

const CategorySchema = z.object({
  _id: objectIdSchema,
  name: z.string().min(1),
});

const CreateCategorySchema = CategorySchema.omit({ _id: true });

function productPipeline(match) {
  return [
    { $match: match },
    {
      $lookup: {
        from: "categories",
        localField: "categoryIds",
        foreignField: "_id",
        as: "categories",
      },
    },
  ];
}

function parseObjectIdParam(value) {
  if (!isObjectId(value)) {
    return null;
  }

  return new ObjectId(value);
}

function toProductDocument(product) {
  return {
    name: product.name,
    about: product.about,
    price: product.price,
    categoryIds: product.categoryIds.map((id) => new ObjectId(id)),
  };
}

function emitProductEvent(app, event) {
  const io = app.get("io");

  if (io) {
    io.emit("products", event);
  }
}

function emitCategoryEvent(app, event) {
  const io = app.get("io");

  if (io) {
    io.emit("categories", event);
  }
}

function createApp(db) {
  const app = express();

  app.use(express.json());
  app.use("/frontend", express.static(join(__dirname, "public")));

  app.get("/", (req, res) => {
    res.send({
      message: "REST MongoDB API",
      endpoints: {
        createCategory: "POST /categories",
        createProduct: "POST /products",
        listCategories: "GET /categories",
        listProducts: "GET /products",
        getProduct: "GET /products/:id",
        updateProduct: "PUT /products/:id",
        deleteProduct: "DELETE /products/:id",
      },
    });
  });

  app.post("/categories", async (req, res, next) => {
    try {
      const result = await CreateCategorySchema.safeParseAsync(req.body);

      if (!result.success) {
        return res.status(400).send(result);
      }

      const { name } = result.data;
      const ack = await db.collection("categories").insertOne({ name });
      const category = { _id: ack.insertedId, name };

      emitCategoryEvent(app, { type: "created", category });

      return res.status(201).send(category);
    } catch (error) {
      return next(error);
    }
  });

  app.get("/categories", async (req, res, next) => {
    try {
      const categories = await db.collection("categories").find({}).toArray();

      return res.send(categories);
    } catch (error) {
      return next(error);
    }
  });

  app.post("/products", async (req, res, next) => {
    try {
      const result = await CreateProductSchema.safeParseAsync(req.body);

      if (!result.success) {
        return res.status(400).send(result);
      }

      const document = toProductDocument(result.data);
      const ack = await db.collection("products").insertOne(document);
      const products = await db
        .collection("products")
        .aggregate(productPipeline({ _id: ack.insertedId }))
        .toArray();
      const product = products[0];

      emitProductEvent(app, { type: "created", product });

      return res.status(201).send(product);
    } catch (error) {
      return next(error);
    }
  });

  app.get("/products", async (req, res, next) => {
    try {
      const result = await db
        .collection("products")
        .aggregate(productPipeline({}))
        .toArray();

      return res.send(result);
    } catch (error) {
      return next(error);
    }
  });

  app.get("/products/:id", async (req, res, next) => {
    try {
      const productId = parseObjectIdParam(req.params.id);

      if (!productId) {
        return res.status(400).send({ error: "Invalid product id" });
      }

      const products = await db
        .collection("products")
        .aggregate(productPipeline({ _id: productId }))
        .toArray();

      if (products.length === 0) {
        return res.status(404).send({ error: "Product not found" });
      }

      return res.send(products[0]);
    } catch (error) {
      return next(error);
    }
  });

  app.put("/products/:id", async (req, res, next) => {
    try {
      const productId = parseObjectIdParam(req.params.id);

      if (!productId) {
        return res.status(400).send({ error: "Invalid product id" });
      }

      const result = await UpdateProductSchema.safeParseAsync(req.body);

      if (!result.success) {
        return res.status(400).send(result);
      }

      const document = toProductDocument(result.data);
      const update = await db
        .collection("products")
        .findOneAndUpdate(
          { _id: productId },
          { $set: document },
          { returnDocument: "after" },
        );

      if (!update) {
        return res.status(404).send({ error: "Product not found" });
      }

      const products = await db
        .collection("products")
        .aggregate(productPipeline({ _id: productId }))
        .toArray();

      const product = products[0];

      emitProductEvent(app, { type: "updated", product });

      return res.send(product);
    } catch (error) {
      return next(error);
    }
  });

  app.delete("/products/:id", async (req, res, next) => {
    try {
      const productId = parseObjectIdParam(req.params.id);

      if (!productId) {
        return res.status(400).send({ error: "Invalid product id" });
      }

      const result = await db.collection("products").deleteOne({ _id: productId });

      if (result.deletedCount === 0) {
        return res.status(404).send({ error: "Product not found" });
      }

      emitProductEvent(app, { type: "deleted", product: { _id: productId } });

      return res.status(204).send();
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

  const db = client.db("myDB");
  const app = createApp(db);
  const server = createServer(app);
  const io = new Server(server);
  app.set("io", io);

  io.on("connection", () => {
    console.log("client connected to products realtime");
  });

  server.listen(port, () => {
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
