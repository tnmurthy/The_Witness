-- =============================================================================
-- 020_knowledge_graph_integration.sql
-- The Witness — Database Schema
-- Milestone 8B: Knowledge Graph Integration
--
-- The Knowledge Graph milestone (Migration 019) built graph_neighbors()
-- for navigation and suggest_graph_connections for generic, any-entity
-- cold-start connection discovery via uniform sampling across every
-- other type. This milestone's brief asks for something more specific
-- and more useful inside the Issue Builder: automatic suggestions
-- across exactly six named categories (companies, technologies,
-- research papers, GitHub repositories, wisdom, articles), driven by
-- what the issue is actually about — not a blind sample. That needs its
-- own AI function, because its candidate-building strategy is
-- genuinely different (topic-relevant full-text search per category,
-- the same technique /api/graph/retrieve already uses, not uniform
-- sampling) and its output shape is genuinely different (grouped by
-- category, matching how an editor actually wants to review "here are
-- your companies, here are your technologies," not one flat list).
-- =============================================================================

alter type ai_function add value 'recommend_related_entities';
COMMIT;
