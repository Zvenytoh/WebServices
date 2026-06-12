const z = require("zod");

const CreateOrderSchema = z.object({
  userId: z.string().uuid(),
  productIds: z.array(z.string().uuid()).min(1),
  payment: z.boolean().optional(),
});

const UpdateOrderSchema = CreateOrderSchema;
const PatchOrderSchema = CreateOrderSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  "At least one field is required"
);

module.exports = { CreateOrderSchema, UpdateOrderSchema, PatchOrderSchema };
