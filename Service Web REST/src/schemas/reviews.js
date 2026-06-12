const z = require("zod");

const CreateReviewSchema = z.object({
  userId: z.string().uuid(),
  productId: z.string().uuid(),
  score: z.number().int().min(1).max(5),
  content: z.string().min(1),
});

const UpdateReviewSchema = CreateReviewSchema;
const PatchReviewSchema = CreateReviewSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  "At least one field is required"
);

module.exports = { CreateReviewSchema, UpdateReviewSchema, PatchReviewSchema };
