import { z } from "zod";
import { platformRoleSchema } from "@/lib/auth/roles";

export const changeUserRoleSchema = z.object({
  role: platformRoleSchema,
});
export type ChangeUserRoleInput = z.infer<typeof changeUserRoleSchema>;
