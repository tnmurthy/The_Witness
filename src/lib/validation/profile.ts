import { z } from "zod";

export const updateProfileSchema = z.object({
  fullName: z.string().min(1, "Name is required").max(200),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
