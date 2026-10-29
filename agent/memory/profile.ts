import {
  defineMemory,
  defineMemoryProvider,
  type MemoryOperationContext,
} from "eve/memory";
import { defineTool } from "eve/tools";
import { z } from "zod";
import { captureMemories } from "@agent/lib/memory-capture";
import { scopeFromPrincipal } from "@agent/lib/principal-scope";
import { resolveModeValue } from "@agent/lib/mode";
import {
  forgetMemory,
  readMemory,
  recallMemoryProfile,
  saveMemory,
  searchMemories,
} from "@db/services/memory";
import {
  forgetMemorySchema,
  memoryIdSchema,
  saveMemorySchema,
  searchMemorySchema,
} from "@shared/memory/schema";
import {
  preserveProfileMemoryCancellation,
  resolveProfileMemoryScope,
} from "../lib/profile-memory";

async function recall(context: MemoryOperationContext) {
  const caller = context.session.auth.current;
  if (caller?.principalType !== "user") return null;
  context.abortSignal.throwIfAborted();
  const content = await recallMemoryProfile(
    scopeFromPrincipal(caller),
    context.memory.scope.key
  );
  context.abortSignal.throwIfAborted();
  return { messages: [{ id: "profile-one-pager", content }] };
}

export default defineMemory({
  description:
    "Durable searchable user memory: profile, preferences, entities, dated context and consented birth details.",
  namespace: "astrology-profile-v1",
  scope: resolveProfileMemoryScope,
  provider: preserveProfileMemoryCancellation(
    defineMemoryProvider({
      recall: { "turn.started": recall, "compaction.completed": recall },
      capture: {
        "turn.completed": (context) =>
          resolveModeValue(context, { interactive: true })
            ? captureMemories(context)
            : undefined,
      },
      async tools(context) {
        const caller = context.session.auth.current;
        if (caller?.principalType !== "user") return null;
        const scope = scopeFromPrincipal(caller);
        const key = context.memory.scope.key;
        const readTools = {
          search: defineTool({
            description:
              "Search durable memories by keyword, ID, alias, or category. Use for facts absent from the bounded profile; no hits means unknown, not false.",
            inputSchema: searchMemorySchema,
            execute: (input) => searchMemories(scope, key, input),
          }),
          read: defineTool({
            description:
              "Read a memory and up to ten prior revisions. Earlier revisions are history, not current truth. Null means missing or forgotten.",
            inputSchema: z.object({ id: memoryIdSchema }),
            execute: ({ id }) => readMemory(scope, key, id),
          }),
        };
        if (resolveModeValue(context, { interactive: true }) !== true)
          return readTools;
        return {
          ...readTools,
          save_memory: defineTool({
            description:
              "Immediately save or correct something the user asks to remember. Read first before correcting and pass expectedRevision. Birth data requires explicit user consent and birthConsentConfirmed=true. Use stable topical IDs. Never store credentials or unsupported inferences. Background extraction handles ordinary facts separately.",
            inputSchema: saveMemorySchema,
            execute: (input, ctx) =>
              saveMemory(
                scope,
                key,
                input,
                `${ctx.session.id}:${ctx.callId}`,
                ctx.session.id
              ),
          }),
          remove_memory: defineTool({
            description:
              "Forget a record the user asks to erase. Read first for its revision. Purges current content and retained revision contents; preserves a content-free tombstone against stale writes. Chat history is unchanged. Do not use the earlier recalled content after forgetting.",
            inputSchema: forgetMemorySchema,
            execute: (input, ctx) =>
              forgetMemory(
                scope,
                key,
                input,
                `${ctx.session.id}:${ctx.callId}`
              ),
          }),
        };
      },
    })
  ),
});
