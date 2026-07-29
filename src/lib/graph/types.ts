/**
 * Knowledge Graph entity and relation types — mirrors reference_entity_
 * type (Migration 001/019) and the knowledge_graph_edges.relation_type
 * CHECK constraint (Migration 019) exactly. Kept as the single source of
 * truth the same way src/lib/auth/roles.ts pins platform_role — a test
 * (src/__tests__/graph.test.ts) checks this list stays in sync with the
 * database the same way roles.test.ts does for roles.
 */
export const GRAPH_ENTITY_TYPES = [
  "article",
  "issue",
  "technology",
  "company",
  "book",
  "paper",
  "course",
  "video",
  "podcast",
  "github_repository",
  "wisdom_entry",
  "source",
  "person",
] as const;
export type GraphEntityType = (typeof GRAPH_ENTITY_TYPES)[number];

export const GRAPH_ENTITY_LABELS: Record<GraphEntityType, string> = {
  article: "Article",
  issue: "Issue",
  technology: "Technology",
  company: "Company",
  book: "Book",
  paper: "Research Paper",
  course: "Course",
  video: "Video",
  podcast: "Podcast",
  github_repository: "GitHub Repository",
  wisdom_entry: "Wisdom",
  source: "Source",
  person: "Person",
};

export const GRAPH_RELATION_TYPES = [
  "related",
  "mentions",
  "cites",
  "authored_by",
  "works_at",
  "founded",
  "built",
  "invested_in",
  "teaches",
  "implements",
  "inspired_by",
  "discusses",
  "part_of",
  "attributed_to",
] as const;
export type GraphRelationType = (typeof GRAPH_RELATION_TYPES)[number];

/** Verified against each table's actual column names (007_knowledge_graph.sql) — technology/company/github_repository use `name`, everything else uses `title` (or `full_name` for people). Getting this mapping wrong would silently query the wrong column, so every entry here was checked against the migration file directly, not assumed from a naming convention. */
export const GRAPH_ENTITY_TABLE: Record<GraphEntityType, { table: string; titleColumn: string }> = {
  article: { table: "articles", titleColumn: "title" },
  issue: { table: "issues", titleColumn: "title" },
  technology: { table: "technologies", titleColumn: "name" },
  company: { table: "companies", titleColumn: "name" },
  book: { table: "books", titleColumn: "title" },
  paper: { table: "papers", titleColumn: "title" },
  course: { table: "courses", titleColumn: "title" },
  video: { table: "videos", titleColumn: "title" },
  podcast: { table: "podcasts", titleColumn: "title" },
  github_repository: { table: "github_repositories", titleColumn: "name" },
  wisdom_entry: { table: "wisdom_entries", titleColumn: "title" },
  source: { table: "sources", titleColumn: "title" },
  person: { table: "people", titleColumn: "full_name" },
};
