const express = require("express");
const sql = require("../config/db");
const validate = require("../middleware/validate");
const { CreateProductSchema } = require("../schemas/products");

const router = express.Router();

function formatProduct(product) {
  return {
    id: product.id,
    name: product.name,
    about: product.about,
    price: Number(product.price),
    reviewIds: product.review_ids || [],
    scoreTotal: Number(product.score_total || 0),
    reviews: product.reviews || undefined,
  };
}

router.get("/", async (req, res, next) => {
  try {
    const { name, about, price } = req.query;
    const filters = [];

    if (name) filters.push(sql`name ILIKE ${`%${name}%`}`);
    if (about) filters.push(sql`about ILIKE ${`%${about}%`}`);
    if (price) {
      const maxPrice = Number(price);
      if (Number.isNaN(maxPrice)) {
        return res.status(400).send({ message: "price must be a number" });
      }
      filters.push(sql`price <= ${maxPrice}`);
    }

    const products = await sql`
      SELECT * FROM products
      ${filters.length ? sql`WHERE ${filters.reduce((a, b) => sql`${a} AND ${b}`)}` : sql``}
      ORDER BY name
    `;

    return res.send(products.map(formatProduct));
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const products = await sql`
      SELECT
        p.*,
        COALESCE(
          json_agg(r.*) FILTER (WHERE r.id IS NOT NULL),
          '[]'
        ) AS reviews
      FROM products p
      LEFT JOIN reviews r ON r.product_id = p.id
      WHERE p.id = ${req.params.id}
      GROUP BY p.id
    `;

    if (products.length === 0) {
      return res.status(404).send({ message: "Product not found" });
    }

    return res.send(formatProduct(products[0]));
  } catch (error) {
    return next(error);
  }
});

router.post("/", validate(CreateProductSchema), async (req, res, next) => {
  try {
    const { name, about, price } = req.body;
    const products = await sql`
      INSERT INTO products (name, about, price)
      VALUES (${name}, ${about}, ${price})
      RETURNING *
    `;

    res.status(201).send(formatProduct(products[0]));
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const products = await sql`
      DELETE FROM products
      WHERE id = ${req.params.id}
      RETURNING *
    `;

    if (products.length === 0) {
      return res.status(404).send({ message: "Product not found" });
    }

    return res.send(formatProduct(products[0]));
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
module.exports.formatProduct = formatProduct;
