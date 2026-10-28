import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateText } from "ai";
import { z } from "zod";

beforeEach(() => {
  vi.stubEnv("DATABASE_URL", "postgresql://test:test@localhost/test");
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("OpenRouter routing", () => {
  it("fails without a key rather than falling back to a paid gateway", async () => {
    vi.resetModules();
    vi.stubEnv("MODEL_PROVIDER", "openrouter");
    vi.stubEnv("OPENROUTER_API_KEY", "");
    const { resolveModel } = await import("./provider");
    expect(() => resolveModel("google/gemini-2.5-flash-lite")).toThrow(
      "OPENROUTER_API_KEY"
    );
  });

  it("sends the chosen model to OpenRouter with server-side authentication", async () => {
    vi.resetModules();
    vi.stubEnv("MODEL_PROVIDER", "openrouter");
    vi.stubEnv("OPENROUTER_API_KEY", "test-key-not-real");
    const request = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "test-response",
          created: 1,
          model: "test/model",
          choices: [
            {
              index: 0,
              message: { role: "assistant", content: "Hello" },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 2, completion_tokens: 1, total_tokens: 3 },
        }),
        { headers: { "Content-Type": "application/json" } }
      )
    );
    vi.stubGlobal("fetch", request);
    const { resolveModel } = await import("./provider");
    const selection = resolveModel("test/model");
    const result = await generateText({
      model: selection.model,
      prompt: "Hello",
    });
    expect(result.text).toBe("Hello");
    expect(request.mock.calls[0]?.[0]).toBe(
      "https://openrouter.ai/api/v1/chat/completions"
    );
    const options = request.mock.calls[0]?.[1];
    expect(new Headers(options?.headers).get("Authorization")).toBe(
      "Bearer test-key-not-real"
    );
    expect(JSON.parse(z.string().parse(options?.body))).toMatchObject({
      model: "test/model",
    });
  });

  it("filters incompatible models and converts token prices to prices per million", async () => {
    vi.resetModules();
    vi.stubEnv("MODEL_PROVIDER", "openrouter");
    const model = {
      id: "test/model",
      name: "Test",
      context_length: 65536,
      supported_parameters: ["tools"],
      architecture: { output_modalities: ["text"] },
      pricing: { prompt: "0.0000001", completion: "0.0000004" },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            data: [
              model,
              { ...model, id: "test/no-tools", supported_parameters: [] },
              { ...model, id: "test/short", context_length: 8192 },
            ],
          })
        )
      )
    );
    const { readModelCatalog } = await import("./catalog");
    const catalog = await readModelCatalog();
    expect(catalog).toHaveLength(1);
    expect(catalog[0]).toMatchObject({
      id: "test/model",
      name: "Test",
      ownedBy: "test",
    });
    expect(catalog[0]?.pricing?.input).toBeCloseTo(0.1);
    expect(catalog[0]?.pricing?.output).toBeCloseTo(0.4);
  });
});
