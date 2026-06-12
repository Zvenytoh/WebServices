const z = require("zod");

const ProductSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  about: z.string().min(1),
  price: z.number().positive(),
  reviewIds: z.array(z.string().uuid()).default([]),
  scoreTotal: z.number().int().default(0),
});

const CreateProductSchema = ProductSchema.omit({
  id: true,
  reviewIds: true,
  scoreTotal: true,
});

module.exports = { ProductSchema, CreateProductSchema };
