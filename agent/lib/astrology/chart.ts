import { Temporal } from "@js-temporal/polyfill";
import { Body, Ecliptic, GeoVector, SunPosition } from "astronomy-engine";

const bodies = [
  Body.Sun,
  Body.Moon,
  Body.Mercury,
  Body.Venus,
  Body.Mars,
  Body.Jupiter,
  Body.Saturn,
  Body.Uranus,
  Body.Neptune,
  Body.Pluto,
];
const signs = [
  "Aries",
  "Taurus",
  "Gemini",
  "Cancer",
  "Leo",
  "Virgo",
  "Libra",
  "Scorpio",
  "Sagittarius",
  "Capricorn",
  "Aquarius",
  "Pisces",
];
const aspects = [
  { name: "conjunction", angle: 0 },
  { name: "sextile", angle: 60 },
  { name: "square", angle: 90 },
  { name: "trine", angle: 120 },
  { name: "opposition", angle: 180 },
];
const round = (value: number) => Math.round(value * 10000) / 10000;
const normalize = (value: number) => ((value % 360) + 360) % 360;
const signedAngle = (value: number) => normalize(value + 180) - 180;

function longitude(body: Body, date: Date) {
  // EclipticLongitude is heliocentric; convert a geocentric vector instead.
  return normalize(
    body === Body.Sun
      ? SunPosition(date).elon
      : Ecliptic(GeoVector(body, date, true)).elon
  );
}

function positions(date: Date) {
  return bodies.map((body) => {
    const lon = longitude(body, date);
    const before = longitude(body, new Date(date.getTime() - 3600000));
    const after = longitude(body, new Date(date.getTime() + 3600000));
    const speed = signedAngle(after - before) * 12;
    return {
      body,
      longitude: round(lon),
      sign: signs[Math.floor(lon / 30)],
      degreesInSign: round(lon % 30),
      retrograde: speed < 0,
      degreesPerDay: round(speed),
    };
  });
}

function findAspects(
  left: ReturnType<typeof positions>,
  right: ReturnType<typeof positions>,
  orb: number,
  sameChart: boolean
) {
  return left
    .flatMap((first, firstIndex) =>
      right.flatMap((second, secondIndex) => {
        if (sameChart && secondIndex <= firstIndex) return [];
        const separation = Math.abs(
          signedAngle(second.longitude - first.longitude)
        );
        const aspect = aspects.find(
          (item) => Math.abs(separation - item.angle) <= orb
        );
        return aspect
          ? [
              {
                from: first.body,
                to: second.body,
                aspect: aspect.name,
                orb: round(Math.abs(separation - aspect.angle)),
              },
            ]
          : [];
      })
    )
    .toSorted((first, second) => first.orb - second.orb);
}

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
      zodiac: "Western tropical",
      coordinates: "Geocentric true ecliptic of date",
      engine: "Astronomy Engine",
      natalOrbDegrees: 6,
      transitOrbDegrees: 3,
      limitations:
        "No ascendant, houses, nodes, asteroids, or exact event timing. Interpretations are symbolic, not scientific predictions.",
    };
    if (input.mode === "sky") {
      const date = supportedDate(input.at ?? new Date().toISOString());
      return {
        status: "ok",
        conventions,
        at: date.toISOString(),
        positions: positions(date),
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
    const natal = positions(date);
    const birth = {
      ...input.birth,
      utc: date.toISOString(),
      resolvedOffset: zoned.offset,
    };
    const chart = {
      birth,
      positions: natal,
      aspects: findAspects(natal, natal, 6, true),
    };
    if (input.mode === "natal")
      return { status: "ok", conventions, natal: chart };
    const transitDate = supportedDate(input.at ?? new Date().toISOString());
    const current = positions(transitDate);
    return {
      status: "ok",
      conventions,
      natal: chart,
      transits: {
        at: transitDate.toISOString(),
        positions: current,
        aspectsToNatal: findAspects(current, natal, 3, false),
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
