import { z } from "zod";

export const organizationTypeSchema = z.enum(["enterprise", "university", "company"]);

export const createOrganizationSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(200),
  type: organizationTypeSchema,
});
export type CreateOrganizationInput = z.infer<typeof createOrganizationSchema>;

export const inviteMemberSchema = z.object({
  email: z.string().min(1, "Email is required").email("Enter a valid email address"),
  role: z.enum(["admin", "member"]).default("member"),
});
export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;
