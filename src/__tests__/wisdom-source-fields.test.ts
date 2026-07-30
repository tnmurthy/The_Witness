import { describe, it, expect, vi } from "vitest";
import { upsertWisdomSourceFields } from "@/lib/wisdom/source-fields";

function mockClient(upsertResult: { error: unknown }) {
  const upsert = vi.fn().mockResolvedValue(upsertResult);
  const from = vi.fn(() => ({ upsert }));
  return { client: { from } as never, from, upsert };
}

describe("upsertWisdomSourceFields", () => {
  it("is a no-op for source type 'other' — no specialization table exists", async () => {
    const { client, from } = mockClient({ error: null });
    const result = await upsertWisdomSourceFields(client, "entry-1", "other", undefined);

    expect(from).not.toHaveBeenCalled();
    expect(result.error).toBeNull();
  });

  it("returns an error when fields are missing for a source type that requires them", async () => {
    const { client } = mockClient({ error: null });
    const result = await upsertWisdomSourceFields(client, "entry-1", "gita_verse", undefined);

    expect(result.error).toContain("gita_verse");
  });

  it("routes gita_verse to the gita_verses table", async () => {
    const { client, from } = mockClient({ error: null });
    await upsertWisdomSourceFields(client, "entry-1", "gita_verse", { chapter: 2, verse: 47 });

    expect(from).toHaveBeenCalledWith("gita_verses");
  });

  it("routes panchatantra_tale to the panchatantra_tales table", async () => {
    const { client, from } = mockClient({ error: null });
    await upsertWisdomSourceFields(client, "entry-1", "panchatantra_tale", {
      tantraNumber: 4,
      tantraName: "X",
      taleTitle: "Y",
    });

    expect(from).toHaveBeenCalledWith("panchatantra_tales");
  });

  it("converts camelCase field names to their snake_case column names", async () => {
    const { client, upsert } = mockClient({ error: null });
    await upsertWisdomSourceFields(client, "entry-1", "advaita_principle", {
      sourceWork: "Vivekachudamani",
      traditionNote: "X",
    });

    expect(upsert).toHaveBeenCalledWith({
      wisdom_entry_id: "entry-1",
      source_work: "Vivekachudamani",
      tradition_note: "X",
    });
  });

  it("passes through a field name that has no camelCase mapping unchanged", async () => {
    const { client, upsert } = mockClient({ error: null });
    await upsertWisdomSourceFields(client, "entry-1", "gita_verse", { chapter: 2, verse: 47 });

    expect(upsert).toHaveBeenCalledWith({ wisdom_entry_id: "entry-1", chapter: 2, verse: 47 });
  });

  it("surfaces a database error message when the upsert itself fails", async () => {
    const { client } = mockClient({ error: { message: "constraint violation" } });
    const result = await upsertWisdomSourceFields(client, "entry-1", "gita_verse", { chapter: 2, verse: 47 });

    expect(result.error).toBe("constraint violation");
  });
});
