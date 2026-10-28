import { Temporal } from "@js-temporal/polyfill";
import { siderealPositions, grahaRelationships } from "./sidereal";

function supportedDate(instant: string) {
  const date = new Date(instant);
  const year = date.getUTCFullYear();
  if (!Number.isFinite(date.getTime()) || year < 1900 || year > 2100) {
    throw new Error("This version supports dates from 1900 through 2100.");
  }
  return date;
}

export function calculateAstrology(input: {
  mode: "natal" | "transits" | "sky";
  birth?: { localDateTime: string; timeZone: string; offset?: string };
  at?: string;
}) {
  try {
    const conventions = {
      zodiac: "Vedic sidereal",
      ayanamsa: "Lahiri-aligned J2000 precession approximation",
      coordinates: "Geocentric true ecliptic of date",
      engine: "Astronomy Engine",
      aspects: "Whole-sign Parashari graha drishti; node drishti excluded",
      nodes: "Mean Rahu and opposite Ketu (approximate)",
      limitations:
        "No lagna, houses, dashas, vargas, true nodes, or exact event timing. Sidereal positions use a Lahiri-aligned approximation. Interpretations are symbolic, not scientific predictions.",
    };
    if (input.mode === "sky") {
      const date = supportedDate(input.at ?? new Date().toISOString());
      return {
        status: "ok",
        conventions,
        at: date.toISOString(),
        ...siderealPositions(date),
      };
    }
    if (!input.birth)
      throw new Error(
        "A known birth date, local time, and IANA time zone are required."
      );
    const { localDateTime, timeZone, offset } = input.birth;
    if (/^[+-]/u.test(timeZone))
      throw new Error("Supply an IANA time zone, not a fixed UTC offset.");
    const zoned = Temporal.ZonedDateTime.from(
      `${localDateTime}${offset ?? ""}[${timeZone}]`,
      { disambiguation: "reject", offset: "reject", overflow: "reject" }
    );
    const date = supportedDate(zoned.toInstant().toString());
    const natal = siderealPositions(date);
    const birth = {
      ...input.birth,
      utc: date.toISOString(),
      resolvedOffset: zoned.offset,
    };
    const chart = {
      birth,
      ...natal,
      relationships: grahaRelationships(natal.positions, natal.positions, true),
    };
    if (input.mode === "natal")
      return { status: "ok", conventions, natal: chart };
    const transitDate = supportedDate(input.at ?? new Date().toISOString());
    const current = siderealPositions(transitDate);
    return {
      status: "ok",
      conventions,
      natal: chart,
      transits: {
        at: transitDate.toISOString(),
        ...current,
        relationshipsToNatal: grahaRelationships(
          current.positions,
          natal.positions,
          false
        ),
      },
    };
  } catch (error) {
    return {
      status: "needs_clarification",
      message:
        error instanceof Error
          ? error.message
          : "Unable to calculate this chart.",
      instruction:
        "Ask for corrected or clarified birth details. Do not invent placements or assume a birth time.",
    };
  }
}
