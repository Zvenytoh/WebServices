const express = require("express");
const swaggerUi = require("swagger-ui-express");
const swaggerDocument = require("./docs/swagger");
const productsRouter = require("./routes/products");
const usersRouter = require("./routes/users");
const f2pGamesRouter = require("./routes/f2pGames");
const ordersRouter = require("./routes/orders");
const reviewsRouter = require("./routes/reviews");

const app = express();

app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.use("/docs", swaggerUi.serve, swaggerUi.setup(swaggerDocument));
app.use("/products", productsRouter);
app.use("/users", usersRouter);
app.use("/f2p-games", f2pGamesRouter);
app.use("/orders", ordersRouter);
app.use("/reviews", reviewsRouter);

app.use((error, req, res, next) => {
  if (error.code === "23505") {
    return res.status(409).send({ message: "Resource already exists" });
  }

  if (error.code === "23503") {
    return res.status(400).send({ message: "Unknown referenced resource" });
  }

  console.error(error);
  return res.status(500).send({ message: "Internal server error" });
});

module.exports = app;
