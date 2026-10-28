import { defineTool } from "eve/tools";
import { z } from "zod";
import { calculateAstrology } from "@agent/lib/astrology/chart";

export default defineTool({
  description:
    "Calculate Western tropical planetary positions, major natal aspects, or transits. Birth times must be known and confirmed. Rejects ambiguous/nonexistent local times unless an explicit valid offset disambiguates them. No houses or rising signs. Does not save personal data.",
  inputSchema: z.object({
    mode: z.enum(["natal", "transits", "sky"]),
    birth: z
      .object({
        localDateTime: z.iso
          .datetime({ local: true, precision: 0 })
          .regex(/T\d{2}:\d{2}:\d{2}$/u)
          .describe(
            "Local wall-clock time as YYYY-MM-DDTHH:mm:ss, without Z or offset."
          ),
        timeZone: z.string().min(1).max(100),
        offset: z
          .string()
          .regex(/^[+-]\d{2}:\d{2}$/u)
          .optional()
          .describe(
            "Only supply a historical UTC offset confirmed by the user."
          ),
      })
      .optional(),
    at: z.iso.datetime({ offset: true }).optional(),
  }),
  execute: calculateAstrology,
});
