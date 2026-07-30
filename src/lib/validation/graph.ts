import { z } from "zod";
import { GRAPH_ENTITY_TYPES, GRAPH_RELATION_TYPES } from "@/lib/graph/types";

export const graphEntityTypeSchema = z.enum(GRAPH_ENTITY_TYPES);
export const graphRelationTypeSchema = z.enum(GRAPH_RELATION_TYPES);

export const createEdgeSchema = z.object({
  sourceType: graphEntityTypeSchema,
  sourceId: z.string().uuid(),
  targetType: graphEntityTypeSchema,
  targetId: z.string().uuid(),
  relationType: graphRelationTypeSchema.default("related"),
});
export type CreateEdgeInput = z.infer<typeof createEdgeSchema>;

export const neighborsQuerySchema = z.object({
  depth: z.coerce.number().int().min(1).max(4).default(2),
});

export const retrieveQuerySchema = z.object({
  query: z.string().min(1).max(500),
  entityTypes: z.array(graphEntityTypeSchema).optional(),
  limit: z.number().int().min(1).max(20).default(10),
  expandFrom: z.object({ entityType: graphEntityTypeSchema, entityId: z.string().uuid() }).optional(),
});
export type RetrieveQueryInput = z.infer<typeof retrieveQuerySchema>;

export const createPersonSchema = z.object({
  fullName: z.string().min(1, "Name is required").max(200),
  bio: z.string().max(3000).optional(),
  avatarUrl: z.string().url().optional().or(z.literal("")),
  externalLinks: z.record(z.string(), z.string().url()).default({}),
});
export type CreatePersonInput = z.infer<typeof createPersonSchema>;

export const updatePersonSchema = createPersonSchema.partial();

export const suggestConnectionsRequestSchema = z.object({
  entityType: graphEntityTypeSchema,
  entityId: z.string().uuid(),
  count: z.number().int().min(1).max(5).default(3),
});
