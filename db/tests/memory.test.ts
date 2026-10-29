import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as Database from "@db";
import * as schema from "../schema";
import {
  claimMemoryCapture,
  forgetMemory,
  readMemory,
  recallMemoryProfile,
  saveMemory,
  searchMemories,
} from "../services/memory";

let client: PGlite | undefined;
afterEach(async () => {
  vi.restoreAllMocks();
  await client?.close();
  client = undefined;
});

describe("durable memory archive", () => {
  it("persists, corrects, searches and forgets records while isolating users and scope keys", async () => {
    client = new PGlite();
    for (const file of [
      "0000_fluffy_the_spike.sql",
      "0016_many_thor_girl.sql",
    ]) {
      // eslint-disable-next-line no-await-in-loop -- Migrations depend on their predecessors.
      const source = await readFile(
        new URL(`../migrations/${file}`, import.meta.url),
        "utf8"
      );
      // eslint-disable-next-line no-await-in-loop -- Migrations depend on their predecessors.
      await client.exec(source);
    }
    const database = drizzle(client, { schema });
    // SAFETY: PGlite provides the query-builder contract used by the service.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Only the test database driver changes, as in existing service tests.
    vi.spyOn(Database, "db", "get").mockReturnValue(database as never);
    const alice = { userId: "alice", workspaceId: "alice-workspace" };
    const bob = { userId: "bob", workspaceId: "bob-workspace" };
    const content = {
      category: "preference" as const,
      title: "Reading style",
      summary: "Prefers short practical readings",
      details: "Avoid lengthy mystical language.",
      aliases: ["tone", "communication"],
      links: [],
      expiresAt: null,
    };
    const input = { id: "reading-style", expectedRevision: 0, content };
    const first = await saveMemory(
      alice,
      "scope-a",
      input,
      "save-1",
      "session-1"
    );
    expect(first?.revision).toBe(1);
    expect(
      (await saveMemory(alice, "scope-a", input, "save-1", "session-1"))
        ?.revision
    ).toBe(1);
    expect(
      (await searchMemories(alice, "scope-a", { query: "communication" })).items
    ).toHaveLength(1);
    expect(
      (await searchMemories(bob, "scope-a", { query: "" })).items
    ).toHaveLength(0);
    expect(await readMemory(alice, "scope-b", "reading-style")).toBeNull();
    // A fresh module instance uses SQL state, not process-local memory.
    vi.resetModules();
    const freshDatabase = await import("@db");
    // SAFETY: The fresh module uses the same schema and PGlite query-builder contract.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Preserve the same SQL store across the simulated module restart.
    vi.spyOn(freshDatabase, "db", "get").mockReturnValue(database as never);
    const fresh = await import("../services/memory");
    expect(
      (await fresh.readMemory(alice, "scope-a", "reading-style"))?.content
        ?.summary
    ).toBe(content.summary);
    const corrected = await saveMemory(
      alice,
      "scope-a",
      {
        ...input,
        expectedRevision: 1,
        content: { ...content, summary: "Prefers detailed explanations" },
      },
      "save-2",
      "session-2"
    );
    expect(corrected?.revision).toBe(2);
    expect(corrected?.history[0]?.content.summary).toBe(content.summary);
    await expect(
      saveMemory(
        alice,
        "scope-a",
        { ...input, expectedRevision: 1 },
        "stale",
        "session-1"
      )
    ).rejects.toThrow("changed");
    expect(await recallMemoryProfile(alice, "scope-a")).toContain(
      "Prefers detailed explanations"
    );
    expect(await recallMemoryProfile(alice, "scope-a")).not.toContain(
      content.summary
    );
    await forgetMemory(
      alice,
      "scope-a",
      { id: "reading-style", expectedRevision: 2 },
      "forget-1"
    );
    expect(await readMemory(alice, "scope-a", "reading-style")).toBeNull();
    const tombstone = await client.query<{
      content: unknown;
      history: unknown;
    }>(
      "SELECT content, history FROM memory_records WHERE id = 'reading-style'"
    );
    expect(tombstone.rows[0]).toEqual({ content: null, history: [] });
    await expect(
      saveMemory(alice, "scope-a", input, "resurrect", "session-1")
    ).rejects.toThrow("forgotten");
    expect(await recallMemoryProfile(alice, "scope-a")).toContain(
      "No durable memories saved"
    );
    await expect(
      saveMemory(
        alice,
        "scope-a",
        { ...input, id: "new-stale-id" },
        "old-capture",
        "session-1",
        new Date(0)
      )
    ).rejects.toThrow("forgotten during extraction");
    expect(await claimMemoryCapture(alice, "scope-a", "turn-1")).toBe(true);
    expect(await claimMemoryCapture(alice, "scope-a", "turn-1")).toBe(false);
    await expect(
      saveMemory(
        alice,
        "scope-a",
        {
          ...input,
          id: "birth-profile",
          content: { ...content, category: "birth" },
        },
        "birth-1",
        "session-1"
      )
    ).rejects.toThrow("permission");
    await saveMemory(
      alice,
      "scope-a",
      {
        ...input,
        id: "birth-profile",
        content: { ...content, category: "birth" },
        birthConsentConfirmed: true,
      },
      "birth-2",
      "session-1"
    );
    await saveMemory(
      alice,
      "scope-a",
      {
        ...input,
        id: "expired-event",
        content: {
          ...content,
          category: "event",
          expiresAt: "2000-01-01T00:00:00Z",
        },
      },
      "event-1",
      "session-1"
    );
    expect(
      (await searchMemories(alice, "scope-a", { query: "expired-event" })).items
    ).toHaveLength(0);
    expect(await recallMemoryProfile(alice, "scope-a")).not.toContain(
      "expired-event"
    );
    expect(
      (
        await searchMemories(alice, "scope-a", {
          query: "expired-event",
          includeExpired: true,
        })
      ).items
    ).toHaveLength(1);
  });
});
