import { gateway } from "ai";
import { z } from "zod";
import { env } from "@shared/environment";

const openRouterCatalogSchema = z.object({
  data: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      context_length: z.number(),
      supported_parameters: z.array(z.string()),
      architecture: z.object({ output_modalities: z.array(z.string()) }),
      pricing: z.object({ prompt: z.string(), completion: z.string() }),
    })
  ),
});

export async function readModelCatalog() {
  if (env.MODEL_PROVIDER === "openrouter") {
    const response = await fetch("https://openrouter.ai/api/v1/models", {
      signal: AbortSignal.timeout(10000),
    });
    if (!response.ok)
      throw new Error("Unable to load OpenRouter models. Try again.");
    const { data } = openRouterCatalogSchema.parse(await response.json());
    return data
      .filter(
        (model) =>
          model.context_length >= 32768 &&
          model.supported_parameters.includes("tools") &&
          model.architecture.output_modalities.includes("text")
      )
      .map((model) => ({
        id: model.id,
        name: model.name,
        ownedBy: model.id.split("/")[0] ?? "openrouter",
        pricing: {
          input: perMillion(model.pricing.prompt),
          output: perMillion(model.pricing.completion),
        },
      }));
  }
  const { models } = await gateway.getAvailableModels();
  return models
    .filter((model) => model.modelType === "language")
    .map((model) => ({
      id: model.id,
      name: model.name,
      ownedBy: model.specification.provider,
      pricing: model.pricing
        ? {
            input: perMillion(model.pricing.input),
            output: perMillion(model.pricing.output),
          }
        : undefined,
    }));
}

function perMillion(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0
    ? parsed * 1_000_000
    : undefined;
}
