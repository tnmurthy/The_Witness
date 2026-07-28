import {
  Heading as HeadingIcon,
  Type,
  ImageIcon,
  Table2,
  Newspaper,
  Radar,
  Briefcase,
  FileText,
  Github,
  Building2,
  GanttChartSquare,
  Quote as QuoteIcon,
  MessageCircleQuestion,
  BookOpen,
  ListChecks,
  type LucideIcon,
} from "lucide-react";
import type { ImplementedBlockType } from "./types";
import {
  type HeadingPayload,
  type ParagraphPayload,
  type ImagePayload,
  type TableBlockPayload,
  type HeroStoryPayload,
  type SignalCardPayload,
  type CareerInsightPayload,
  type ResearchSummaryPayload,
  type GithubRepositoryBlockPayload,
  type CompanyProfilePayload,
  type TimelinePayload,
  type QuotePayload,
  type ReflectionPayload,
  type TodaysWisdomPayload,
  type ActionChecklistPayload,
} from "./schemas";

export interface BlockDefinition<TPayload = unknown> {
  type: ImplementedBlockType;
  /** Display label — see types.ts for the two cases where this deliberately differs from the enum value. */
  label: string;
  description: string;
  icon: LucideIcon;
  category: "text" | "editorial" | "wisdom" | "data";
  defaultPayload: TPayload;
}

/**
 * The single source of truth for "what block types exist, and what do
 * they look like in the insert menu." block-renderer.tsx and
 * block-editor-fields.tsx both switch on `type` using this same
 * ImplementedBlockType union, so adding a 16th block type means updating
 * three places (this registry, the renderer, the editor fields) — not
 * hunting through the codebase for every place a block-type list was
 * hand-duplicated.
 */
export const BLOCK_REGISTRY: Record<ImplementedBlockType, BlockDefinition> = {
  heading: {
    type: "heading",
    label: "Heading",
    description: "Section heading, three levels",
    icon: HeadingIcon,
    category: "text",
    defaultPayload: { text: "", level: 2 } satisfies HeadingPayload,
  },
  paragraph: {
    type: "paragraph",
    label: "Paragraph",
    description: "Body text",
    icon: Type,
    category: "text",
    defaultPayload: { text: "" } satisfies ParagraphPayload,
  },
  image: {
    type: "image",
    label: "Image",
    description: "Image with alt text and caption",
    icon: ImageIcon,
    category: "text",
    defaultPayload: { url: "", alt: "" } satisfies ImagePayload,
  },
  table_block: {
    type: "table_block",
    label: "Table",
    description: "Rows and columns of data",
    icon: Table2,
    category: "data",
    defaultPayload: { headers: ["Column 1", "Column 2"], rows: [["", ""]] } satisfies TableBlockPayload,
  },
  hero_story: {
    type: "hero_story",
    label: "Hero Story",
    description: "Lead editorial story with headline and image",
    icon: Newspaper,
    category: "editorial",
    defaultPayload: { headline: "", body: "" } satisfies HeroStoryPayload,
  },
  signal_card: {
    type: "signal_card",
    label: "Technology Signal",
    description: "A single technology trend or development",
    icon: Radar,
    category: "editorial",
    defaultPayload: { eyebrow: "Signal", headline: "", body: "" } satisfies SignalCardPayload,
  },
  career_insight: {
    type: "career_insight",
    label: "Career Insight",
    description: "Career-focused analysis with action items",
    icon: Briefcase,
    category: "editorial",
    defaultPayload: { headline: "", body: "", actionItems: [] } satisfies CareerInsightPayload,
  },
  research_summary: {
    type: "research_summary",
    label: "Research Paper",
    description: "Summary of an academic or industry paper",
    icon: FileText,
    category: "editorial",
    defaultPayload: { title: "", summary: "" } satisfies ResearchSummaryPayload,
  },
  github_repository_block: {
    type: "github_repository_block",
    label: "GitHub Repository",
    description: "Highlight a GitHub project",
    icon: Github,
    category: "editorial",
    defaultPayload: { owner: "", repo: "", url: "" } satisfies GithubRepositoryBlockPayload,
  },
  company_profile: {
    type: "company_profile",
    label: "Company Profile",
    description: "Highlight a company",
    icon: Building2,
    category: "editorial",
    defaultPayload: { name: "", description: "" } satisfies CompanyProfilePayload,
  },
  timeline: {
    type: "timeline",
    label: "Timeline",
    description: "Chronological sequence of events",
    icon: GanttChartSquare,
    category: "data",
    defaultPayload: { events: [{ date: "", title: "" }] } satisfies TimelinePayload,
  },
  quote: {
    type: "quote",
    label: "Quote",
    description: "Pull quote with attribution",
    icon: QuoteIcon,
    category: "text",
    defaultPayload: { text: "" } satisfies QuotePayload,
  },
  reflection: {
    type: "reflection",
    label: "Reflection",
    description: "A question for the reader to consider",
    icon: MessageCircleQuestion,
    category: "wisdom",
    defaultPayload: { question: "" } satisfies ReflectionPayload,
  },
  todays_wisdom: {
    type: "todays_wisdom",
    label: "Today's Wisdom",
    description: "A wisdom entry — source text, translation, and context",
    icon: BookOpen,
    category: "wisdom",
    defaultPayload: { translation: "" } satisfies TodaysWisdomPayload,
  },
  action_checklist: {
    type: "action_checklist",
    label: "Action Checklist",
    description: "A checklist of reader action items",
    icon: ListChecks,
    category: "wisdom",
    defaultPayload: { items: [{ text: "", done: false }] } satisfies ActionChecklistPayload,
  },
};

export const BLOCK_CATEGORIES: { value: BlockDefinition["category"]; label: string }[] = [
  { value: "text", label: "Text" },
  { value: "editorial", label: "Editorial" },
  { value: "data", label: "Data" },
  { value: "wisdom", label: "Wisdom Engine" },
];
