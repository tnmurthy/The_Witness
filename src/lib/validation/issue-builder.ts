import { z } from "zod";
import { ALL_BLOCK_TYPES } from "@/lib/blocks/types";

export const createIssueSchema = z.object({
  publicationId: z.string().uuid(),
  title: z.string().min(1, "Title is required").max(300),
});
export type CreateIssueInput = z.infer<typeof createIssueSchema>;

export const createSectionSchema = z.object({
  title: z.string().max(200).optional(),
  position: z.number().int().min(0).optional(),
});
export type CreateSectionInput = z.infer<typeof createSectionSchema>;

export const createBlockSchema = z.object({
  type: z.enum(ALL_BLOCK_TYPES),
  payload: z.record(z.string(), z.unknown()).default({}),
  position: z.number().int().min(0).optional(),
});
export type CreateBlockInput = z.infer<typeof createBlockSchema>;

export const updateBlockSchema = z.object({
  payload: z.record(z.string(), z.unknown()).optional(),
  position: z.number().int().min(0).optional(),
  sectionId: z.string().uuid().optional(),
});
export type UpdateBlockInput = z.infer<typeof updateBlockSchema>;

export const reorderBlocksSchema = z.object({
  blocks: z
    .array(
      z.object({
        id: z.string().uuid(),
        sectionId: z.string().uuid(),
        position: z.number().int().min(0),
      })
    )
    .min(1),
});
export type ReorderBlocksInput = z.infer<typeof reorderBlocksSchema>;

export const createRevisionSchema = z.object({
  label: z.string().max(200).optional(),
});
export type CreateRevisionInput = z.infer<typeof createRevisionSchema>;
