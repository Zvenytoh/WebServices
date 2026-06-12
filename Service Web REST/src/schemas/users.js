const z = require("zod");

const UserSchema = z.object({
  id: z.string().uuid(),
  username: z.string().min(3),
  password: z.string().min(8),
  email: z.string().email(),
});

const CreateUserSchema = UserSchema.omit({ id: true });
const UpdateUserSchema = CreateUserSchema;
const PatchUserSchema = CreateUserSchema.partial().refine(
  (data) => Object.keys(data).length > 0,
  "At least one field is required"
);

module.exports = { CreateUserSchema, UpdateUserSchema, PatchUserSchema };
