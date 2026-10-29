import { z } from "zod";

export const memoryIdSchema = z
  .string()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/u);
const memoryContentSchema = z.strictObject({
  category: z.enum([
    "profile",
    "preference",
    "person",
    "organization",
    "fact",
    "decision",
    "birth",
    "conversation",
    "event",
  ]),
  title: z.string().trim().min(1).max(100),
  summary: z.string().trim().min(1).max(320),
  details: z.string().trim().max(2500),
  aliases: z.array(z.string().trim().min(1).max(60)).max(8),
  links: z.array(memoryIdSchema).max(8),
  expiresAt: z.iso.datetime({ offset: true }).nullable(),
});
export const saveMemorySchema = z.strictObject({
  id: memoryIdSchema,
  expectedRevision: z.number().int().min(0),
  content: memoryContentSchema,
  birthConsentConfirmed: z.boolean().default(false),
});
export const forgetMemorySchema = saveMemorySchema.pick({
  id: true,
  expectedRevision: true,
});
export const searchMemorySchema = z.strictObject({
  query: z.string().trim().max(200).default(""),
  category: memoryContentSchema.shape.category.optional(),
  offset: z.number().int().min(0).default(0),
  includeExpired: z.boolean().default(false),
});
const memoryHistorySchema = z
  .array(
    z.strictObject({
      revision: z.number().int().positive(),
      content: memoryContentSchema,
      recordedAt: z.iso.datetime({ offset: true }),
    })
  )
  .max(10);
export type MemoryContent = z.infer<typeof memoryContentSchema>;
export type MemoryHistory = z.infer<typeof memoryHistorySchema>;
