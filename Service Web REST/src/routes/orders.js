const express = require("express");
const sql = require("../config/db");
const validate = require("../middleware/validate");
const { formatUser } = require("./users");
const { formatProduct } = require("./products");
const {
  CreateOrderSchema,
  UpdateOrderSchema,
  PatchOrderSchema,
} = require("../schemas/orders");

const router = express.Router();

async function calculateTotal(productIds) {
  const products = await sql`
    SELECT id, price FROM products WHERE id IN ${sql(productIds)}
  `;

  if (products.length !== productIds.length) {
    return null;
  }

  const subtotal = products.reduce((sum, product) => sum + Number(product.price), 0);
  return Number((subtotal * 1.2).toFixed(2));
}

async function attachOrderProducts(orderId, productIds) {
  await sql`DELETE FROM order_products WHERE order_id = ${orderId}`;

  if (productIds.length > 0) {
    await sql`
      INSERT INTO order_products ${sql(
        productIds.map((productId) => ({ order_id: orderId, product_id: productId }))
      )}
    `;
  }
}

async function getOrder(id) {
  const orders = await sql`
    SELECT * FROM orders WHERE id = ${id}
  `;

  if (orders.length === 0) return null;

  const [user] = await sql`
    SELECT id, username, email FROM users WHERE id = ${orders[0].user_id}
  `;
  const products = await sql`
    SELECT p.*
    FROM products p
    JOIN order_products op ON op.product_id = p.id
    WHERE op.order_id = ${id}
    ORDER BY p.name
  `;

  return formatOrder(orders[0], user, products);
}

function formatOrder(order, user, products) {
  return {
    id: order.id,
    userId: order.user_id,
    productIds: products.map((product) => product.id),
    total: Number(order.total),
    payment: order.payment,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    user: user ? formatUser(user) : null,
    products: products.map(formatProduct),
  };
}

router.get("/", async (req, res, next) => {
  try {
    const orders = await sql`SELECT id FROM orders ORDER BY created_at DESC`;
    const fullOrders = await Promise.all(orders.map((order) => getOrder(order.id)));
    res.send(fullOrders);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const order = await getOrder(req.params.id);
    if (!order) return res.status(404).send({ message: "Order not found" });
    return res.send(order);
  } catch (error) {
    return next(error);
  }
});

router.post("/", validate(CreateOrderSchema), async (req, res, next) => {
  try {
    const { userId, productIds, payment = false } = req.body;
    const total = await calculateTotal(productIds);
    if (total === null) return res.status(400).send({ message: "Unknown product id" });

    const users = await sql`SELECT id FROM users WHERE id = ${userId}`;
    if (users.length === 0) return res.status(400).send({ message: "Unknown user id" });

    const orders = await sql`
      INSERT INTO orders (user_id, total, payment)
      VALUES (${userId}, ${total}, ${payment})
      RETURNING *
    `;
    await attachOrderProducts(orders[0].id, productIds);

    return res.status(201).send(await getOrder(orders[0].id));
  } catch (error) {
    return next(error);
  }
});

router.put("/:id", validate(UpdateOrderSchema), async (req, res, next) => {
  try {
    const { userId, productIds, payment = false } = req.body;
    const total = await calculateTotal(productIds);
    if (total === null) return res.status(400).send({ message: "Unknown product id" });

    const orders = await sql`
      UPDATE orders
      SET user_id = ${userId}, total = ${total}, payment = ${payment}
      WHERE id = ${req.params.id}
      RETURNING *
    `;

    if (orders.length === 0) return res.status(404).send({ message: "Order not found" });

    await attachOrderProducts(orders[0].id, productIds);
    return res.send(await getOrder(orders[0].id));
  } catch (error) {
    return next(error);
  }
});

router.patch("/:id", validate(PatchOrderSchema), async (req, res, next) => {
  try {
    const current = await getOrder(req.params.id);
    if (!current) return res.status(404).send({ message: "Order not found" });

    const userId = req.body.userId ?? current.userId;
    const productIds = req.body.productIds ?? current.productIds;
    const payment = req.body.payment ?? current.payment;
    const total = await calculateTotal(productIds);
    if (total === null) return res.status(400).send({ message: "Unknown product id" });

    await sql`
      UPDATE orders
      SET user_id = ${userId}, total = ${total}, payment = ${payment}
      WHERE id = ${req.params.id}
    `;
    await attachOrderProducts(req.params.id, productIds);

    return res.send(await getOrder(req.params.id));
  } catch (error) {
    return next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const order = await getOrder(req.params.id);
    if (!order) return res.status(404).send({ message: "Order not found" });

    await sql`DELETE FROM orders WHERE id = ${req.params.id}`;
    return res.send(order);
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
