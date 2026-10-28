import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { env } from "@shared/environment";

export function resolveModel(modelId: string) {
  if (env.MODEL_PROVIDER === "gateway")
    return { model: modelId, reasoning: "low" as const };
  if (!env.OPENROUTER_API_KEY) {
    throw new Error(
      "Add OPENROUTER_API_KEY to .env.local and restart the app."
    );
  }
  const provider = createOpenAICompatible({
    name: "openrouter",
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: env.OPENROUTER_API_KEY,
  });
  return {
    model: provider.chatModel(modelId),
    // Conservative budget shared by every model offered in our catalog.
    modelContextWindowTokens: 32768,
    reasoning: "provider-default" as const,
  };
}
