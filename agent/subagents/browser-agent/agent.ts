import { defineAgent, defineDynamic } from "eve";
import { resolveModeValue } from "@agent/lib/mode";
import { env } from "@shared/environment";
import { resolveModel } from "@shared/models/provider";

export default defineDynamic({
  build: {
    externalDependencies: ["@onkernel/browser-loop"],
  },
  events: {
    "turn.started": (_event, context) => {
      if (!env.KERNEL_API_KEY) return null;
      const selection = resolveModel(
        env.MODEL_PROVIDER === "openrouter"
          ? env.OPENROUTER_MODEL
          : "meta/muse-spark-1.3"
      );
      const worker = defineAgent({
        tool: false,
        description:
          "Execute one bounded browser assignment for the root coordinator, including secure vault autofill, transaction preparation, optional durable browser images, human-takeover handoff, cleanup, and a concise verified result.",
        model: selection.model,
        modelContextWindowTokens: 32768,
        reasoning: "provider-default",
        compaction: {
          thresholdPercent: 0.7,
        },
      });
      return resolveModeValue(context, {
        interactive: worker,
        "scheduled-worker": worker,
      });
    },
  },
});
