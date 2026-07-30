import "@testing-library/jest-dom/vitest";
import { vi } from "vitest";

// server-only is a real, correct production safeguard (throws if
// imported into client-bundled code) — but vitest's jsdom test
// environment presents as client-like to any package checking for it,
// and several files under test here (AI provider registry,
// orchestrator, the admin Supabase client) legitimately import it as
// part of testing genuinely server-side logic. Mocked globally as a
// no-op rather than per test file, since every test exercising
// server-side code would otherwise need this same workaround.
vi.mock("server-only", () => ({}));
