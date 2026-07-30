import { z } from "zod";
import { parseJsonResponse } from "./types";
import type { AIFunctionDefinition } from "./types";
import { IMPLEMENTED_BLOCK_TYPES } from "@/lib/blocks/types";
import { validateBlockPayload } from "@/lib/blocks/schemas";
import { BLOCK_REGISTRY } from "@/lib/blocks/registry";

const inputSchema = z.object({
  publicationName: z.string().min(1).max(200),
  editorialGuidelines: z.string().max(20000).optional(),
  topic: z.string().min(1).max(500),
  audience: z.string().max(300).default("technology and career-focused professionals"),
  tone: z.string().max(300).default("analytical, direct, no hype"),
  blockTypes: z
    .array(z.enum(IMPLEMENTED_BLOCK_TYPES))
    .min(1)
    .default(["hero_story", "signal_card", "career_insight"]),
});
export type GenerateIssueInput = z.infer<typeof inputSchema>;

interface DraftBlock {
  type: string;
  payload: Record<string, unknown>;
}
export interface GenerateIssueOutput {
  blocks: DraftBlock[];
  /** Blocks the model returned that failed their type's payload schema — surfaced rather than silently dropped, so the orchestrator/UI can show "N of M blocks drafted successfully" instead of an unexplained shortfall. See docs/AI_WORKSPACE.md, "Partial failure is visible, not silent." */
  rejected: { type: string; reason: string }[];
}

/**
 * Reuses the exact same payload schemas the Issue Builder (Milestone 5)
 * enforces for a manually-authored block — an AI-drafted block and a
 * human-authored one are validated by the identical rule, not a looser
 * "AI is allowed to be sloppy" variant. A block whose payload fails
 * validation is excluded from the result and reported in `rejected`
 * rather than persisted malformed or silently dropped.
 */
export const generateIssueFunction: AIFunctionDefinition<GenerateIssueInput, GenerateIssueOutput> = {
  id: "generate_issue",
  label: "Generate Issue",
  description: "Draft a full set of editorial blocks for a new issue",
  inputSchema,
  defaultMaxTokens: 4000,
  buildPrompt: (input) => {
    const blockShapes = input.blockTypes
      .map((type) => `- "${type}" (${BLOCK_REGISTRY[type].label}): ${BLOCK_REGISTRY[type].description}`)
      .join("\n");

    return {
      system:
        `You are the AI Workspace for ${input.publicationName}. Draft editorial content as a human editor would then review and edit — never invent specific facts, statistics, names, or quotes; write in general, defensible terms when you don't have a verified specific detail, and prefer a slightly vaguer true statement over a specific invented one.` +
        (input.editorialGuidelines
          ? `\n\nEditorial guidelines for this publication:\n${input.editorialGuidelines}`
          : "") +
        `\n\nAudience: ${input.audience}. Tone: ${input.tone}.` +
        `\n\nRespond with ONLY a JSON object: {"blocks": [{"type": string, "payload": object}]}. Draft one block for each of these types, with a payload shape matching the block type exactly:\n${blockShapes}`,
      prompt: `Topic for this issue: ${input.topic}`,
    };
  },
  parseResult: (rawText) => {
    const parsed = parseJsonResponse<{ blocks: DraftBlock[] }>(rawText);
    const blocks: DraftBlock[] = [];
    const rejected: { type: string; reason: string }[] = [];

    for (const draft of parsed.blocks ?? []) {
      const validation = validateBlockPayload(draft.type, draft.payload);
      if (validation.success) {
        blocks.push({ type: draft.type, payload: validation.data });
      } else {
        rejected.push({ type: draft.type, reason: validation.error });
      }
    }

    return { blocks, rejected };
  },
};
