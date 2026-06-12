const express = require("express");
const sql = require("../config/db");
const validate = require("../middleware/validate");
const {
  CreateReviewSchema,
  UpdateReviewSchema,
  PatchReviewSchema,
} = require("../schemas/reviews");

const router = express.Router();

function formatReview(review) {
  return {
    id: review.id,
    userId: review.user_id,
    productId: review.product_id,
    score: review.score,
    content: review.content,
    createdAt: review.created_at,
    updatedAt: review.updated_at,
  };
}

async function refreshProductReviewStats(productId) {
  const stats = await sql`
    SELECT
      COALESCE(array_agg(id ORDER BY created_at), '{}') AS review_ids,
      COALESCE(SUM(score), 0)::int AS score_total
    FROM reviews
    WHERE product_id = ${productId}
  `;

  await sql`
    UPDATE products
    SET review_ids = ${stats[0].review_ids}, score_total = ${stats[0].score_total}
    WHERE id = ${productId}
  `;
}

router.get("/", async (req, res, next) => {
  try {
    const reviews = await sql`SELECT * FROM reviews ORDER BY created_at DESC`;
    res.send(reviews.map(formatReview));
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const reviews = await sql`SELECT * FROM reviews WHERE id = ${req.params.id}`;
    if (reviews.length === 0) return res.status(404).send({ message: "Review not found" });
    return res.send(formatReview(reviews[0]));
  } catch (error) {
    return next(error);
  }
});

router.post("/", validate(CreateReviewSchema), async (req, res, next) => {
  try {
    const { userId, productId, score, content } = req.body;
    const reviews = await sql`
      INSERT INTO reviews (user_id, product_id, score, content)
      VALUES (${userId}, ${productId}, ${score}, ${content})
      RETURNING *
    `;
    await refreshProductReviewStats(productId);
    res.status(201).send(formatReview(reviews[0]));
  } catch (error) {
    next(error);
  }
});

router.put("/:id", validate(UpdateReviewSchema), async (req, res, next) => {
  try {
    const { userId, productId, score, content } = req.body;
    const reviews = await sql`
      UPDATE reviews
      SET user_id = ${userId}, product_id = ${productId}, score = ${score}, content = ${content}
      WHERE id = ${req.params.id}
      RETURNING *
    `;

    if (reviews.length === 0) return res.status(404).send({ message: "Review not found" });

    await refreshProductReviewStats(productId);
    return res.send(formatReview(reviews[0]));
  } catch (error) {
    return next(error);
  }
});

router.patch("/:id", validate(PatchReviewSchema), async (req, res, next) => {
  try {
    const existing = await sql`SELECT * FROM reviews WHERE id = ${req.params.id}`;
    if (existing.length === 0) return res.status(404).send({ message: "Review not found" });

    const userId = req.body.userId ?? existing[0].user_id;
    const productId = req.body.productId ?? existing[0].product_id;
    const score = req.body.score ?? existing[0].score;
    const content = req.body.content ?? existing[0].content;

    const reviews = await sql`
      UPDATE reviews
      SET user_id = ${userId}, product_id = ${productId}, score = ${score}, content = ${content}
      WHERE id = ${req.params.id}
      RETURNING *
    `;

    await refreshProductReviewStats(existing[0].product_id);
    await refreshProductReviewStats(productId);
    return res.send(formatReview(reviews[0]));
  } catch (error) {
    return next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const reviews = await sql`
      DELETE FROM reviews
      WHERE id = ${req.params.id}
      RETURNING *
    `;

    if (reviews.length === 0) return res.status(404).send({ message: "Review not found" });

    await refreshProductReviewStats(reviews[0].product_id);
    return res.send(formatReview(reviews[0]));
  } catch (error) {
    return next(error);
  }
});

module.exports = router;
