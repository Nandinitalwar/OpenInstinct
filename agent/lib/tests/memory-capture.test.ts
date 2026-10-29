import type * as Ai from "ai";
import type * as MemoryService from "@db/services/memory";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { MemoryTurnCompletedContext } from "eve/memory";
const mocks = vi.hoisted(() => ({
  generate: vi.fn<(...args: unknown[]) => Promise<{ text: string }>>(),
  claimMemoryCapture: vi.fn<typeof MemoryService.claimMemoryCapture>(),
  saveMemory: vi.fn<typeof MemoryService.saveMemory>(),
  searchMemories: vi.fn<typeof MemoryService.searchMemories>(),
}));
vi.mock("ai", async () => ({
  ...(await vi.importActual<typeof Ai>("ai")),
  generateText: mocks.generate,
}));
vi.mock("@db/services/memory", () => mocks);
vi.mock("@db/services/settings", () => ({
  getGatewayModel: async () => "test/model",
}));
vi.mock("@shared/models/provider", () => ({
  resolveModel: () => ({ model: "test/model" }),
}));
import { captureMemories } from "@agent/lib/memory-capture";

const candidate = {
  id: "reading-style",
  expectedRevision: 0,
  content: {
    category: "preference",
    title: "Reading style",
    summary: "Prefers concise readings",
    details: "Use short practical explanations",
    aliases: ["tone"],
    links: [],
    expiresAt: null,
  },
  sourceQuote: "I prefer concise readings",
};
beforeEach(() => {
  vi.clearAllMocks();
  mocks.claimMemoryCapture.mockResolvedValue(true);
  mocks.searchMemories.mockResolvedValue({ items: [], nextOffset: null });
  mocks.generate.mockResolvedValue({
    text: JSON.stringify({ memories: [candidate] }),
  });
});

describe("background memory capture", () => {
  it("stores evidence-backed preferences in the authenticated partition", async () => {
    await captureMemories(context("I prefer concise readings"));
    expect(mocks.saveMemory).toHaveBeenCalledWith(
      { userId: "user-1", workspaceId: "workspace-1" },
      "scope-1",
      {
        id: "reading-style",
        expectedRevision: 0,
        content: {
          ...candidate.content,
          details:
            "Use short practical explanations\nSource: I prefer concise readings",
        },
      },
      "operation-1:reading-style",
      "session-1",
      expect.any(Date)
    );
  });
  it("rejects invented supporting quotes", async () => {
    await captureMemories(context("I prefer detailed readings"));
    expect(mocks.saveMemory).not.toHaveBeenCalled();
  });
  it("accepts a JSON code fence while still validating the record schema", async () => {
    mocks.generate.mockResolvedValue({
      text: `\`\`\`json\n${JSON.stringify({ memories: [candidate] })}\n\`\`\``,
    });
    await captureMemories(context("I prefer concise readings"));
    expect(mocks.saveMemory).toHaveBeenCalledOnce();
  });
  it("does not store malformed extraction output", async () => {
    mocks.generate.mockResolvedValue({ text: "not a JSON memory record" });
    await expect(
      captureMemories(context("I prefer concise readings"))
    ).rejects.toThrow(/JSON/u);
    expect(mocks.saveMemory).not.toHaveBeenCalled();
  });
  it.each([
    "I was born in Mumbai",
    "Please forget my preferences",
    `My key is sk-or-v1-${"x".repeat(64)}`,
  ])("skips protected source input: %s", async (source) => {
    await captureMemories(context(source));
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(mocks.saveMemory).not.toHaveBeenCalled();
  });
  it("does not pay for a second extraction on replay", async () => {
    mocks.claimMemoryCapture.mockResolvedValue(false);
    await captureMemories(context("I prefer concise readings"));
    expect(mocks.generate).not.toHaveBeenCalled();
  });
});

function context(source: string): MemoryTurnCompletedContext {
  return {
    async getSandbox() {
      throw new Error("Memory extraction does not use a sandbox.");
    },
    abortSignal: new AbortController().signal,
    messages: [],
    operationId: "operation-1",
    memory: {
      slot: "profile",
      scope: {
        key: "scope-1",
        namespace: "astrology-profile-v1",
        value: "workspace-1",
      },
    },
    session: {
      id: "session-1",
      turn: { id: "turn-1", sequence: 1 },
      auth: {
        current: {
          principalType: "user",
          principalId: "user-1",
          authenticator: "authjs",
          attributes: { workspaceId: "workspace-1" },
        },
        initiator: null,
      },
    },
    turn: {
      id: "turn-1",
      sequence: 1,
      input: [{ role: "user", content: source }],
    },
  };
}
