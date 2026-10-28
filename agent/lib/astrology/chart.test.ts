import { describe, expect, it } from "vitest";
import { calculateAstrology } from "./chart";
import reference from "@tests/fixtures/astrology-reference.json";
import { siderealPositions, grahaRelationships } from "./sidereal";

const birth = {
  localDateTime: "2000-01-01T07:00:00",
  timeZone: "America/New_York",
};

describe("astrology calculations", () => {
  it.each(reference.samples)(
    "matches independent sidereal references at $at within 0.05 degrees",
    ({ at, positions }) => {
      const result = siderealPositions(new Date(at));
      for (const [body, expected] of Object.entries(positions)) {
        const actual = result.positions.find((item) => item.body === body);
        if (!actual) throw new Error(`Missing calculated graha: ${body}`);
        const delta = Math.abs(actual.longitude - expected);
        expect(Math.min(delta, 360 - delta)).toBeLessThan(0.05);
      }
      const rahu = result.positions.find((item) => item.body === "Rahu");
      const ketu = result.positions.find((item) => item.body === "Ketu");
      if (!rahu || !ketu) throw new Error("Missing lunar nodes");
      expect(Math.abs(rahu.longitude - ketu.longitude)).toBeCloseTo(180, 3);
      expect(rahu.retrograde).toBe(true);
    }
  );

  it("uses directional whole-sign graha drishti and excludes node drishti", () => {
    const longitude = new Map([
      ["Mars", 0],
      ["Moon", 90],
      ["Jupiter", 30],
      ["Venus", 150],
      ["Saturn", 60],
      ["Sun", 120],
      ["Rahu", 0],
      ["Ketu", 180],
    ]);
    const positions = siderealPositions(
      new Date("2000-01-01T12:00:00Z")
    ).positions;
    for (const item of positions) {
      item.longitude = longitude.get(item.body) ?? item.longitude;
      item.rashiIndex = Math.floor(item.longitude / 30);
    }
    const relationships = grahaRelationships(positions, positions, true);
    expect(relationships).toContainEqual({
      from: "Mars",
      to: "Moon",
      relationship: "graha-drishti",
      signDistance: 4,
    });
    expect(relationships).toContainEqual({
      from: "Jupiter",
      to: "Venus",
      relationship: "graha-drishti",
      signDistance: 5,
    });
    expect(relationships).toContainEqual({
      from: "Saturn",
      to: "Sun",
      relationship: "graha-drishti",
      signDistance: 3,
    });
    expect(
      relationships.some((item) => item.from === "Sun" && item.to === "Moon")
    ).toBe(false);
    expect(
      relationships.some(
        (item) =>
          ["Rahu", "Ketu"].includes(item.from) &&
          item.relationship === "graha-drishti"
      )
    ).toBe(false);
  });

  it("resolves historical local time and returns a geocentric natal chart", () => {
    const result = calculateAstrology({ mode: "natal", birth });
    expect(result.status).toBe("ok");
    expect(result.natal?.birth.utc).toBe("2000-01-01T12:00:00.000Z");
    expect(result.natal?.positions).toHaveLength(9);
    const sun = result.natal?.positions.find((item) => item.body === "Sun");
    expect(sun?.sign).toBe("Sagittarius");
    expect(sun?.longitude).toBeCloseTo(256.5157, 1);
    const moon = result.natal?.positions.find((item) => item.body === "Moon");
    expect(moon?.longitude).toBeCloseTo(199.4706, 1);
    expect(moon?.nakshatra).toEqual({ name: "Swati", pada: 4 });
    expect(result.natal?.ayanamsaDegrees).toBeCloseTo(23.8532, 3);
  });

  it("rejects missing birth data instead of inventing a time", () => {
    expect(calculateAstrology({ mode: "natal" }).status).toBe(
      "needs_clarification"
    );
  });

  it.each([
    "2024-03-10T02:30:00",
    "2024-11-03T01:30:00",
    "2024-02-30T12:00:00",
  ])(
    "rejects nonexistent, ambiguous, and invalid local times: %s",
    (localDateTime) => {
      expect(
        calculateAstrology({
          mode: "natal",
          birth: { ...birth, localDateTime },
        }).status
      ).toBe("needs_clarification");
    }
  );

  it("accepts a confirmed offset to disambiguate a repeated time", () => {
    const result = calculateAstrology({
      mode: "natal",
      birth: {
        localDateTime: "2024-11-03T01:30:00",
        timeZone: "America/New_York",
        offset: "-05:00",
      },
    });
    expect(result.natal?.birth.utc).toBe("2024-11-03T06:30:00.000Z");
  });

  it("rejects an incorrect historical offset and unknown time zone", () => {
    expect(
      calculateAstrology({
        mode: "natal",
        birth: { ...birth, offset: "-04:00" },
      }).status
    ).toBe("needs_clarification");
    expect(
      calculateAstrology({
        mode: "natal",
        birth: { ...birth, timeZone: "Invalid/City" },
      }).status
    ).toBe("needs_clarification");
  });

  it("compares transit planets to natal planets, including same-body conjunctions", () => {
    const result = calculateAstrology({
      mode: "transits",
      birth,
      at: "2000-01-01T12:00:00Z",
    });
    expect(
      result.transits?.relationshipsToNatal.filter(
        (item) =>
          item.from === item.to &&
          item.relationship === "same-rashi conjunction"
      )
    ).toHaveLength(9);
  });

  it("calculates sky without birth data and reports retrograde motion", () => {
    const result = calculateAstrology({
      mode: "sky",
      at: "2024-04-15T12:00:00Z",
    });
    if (!("positions" in result))
      throw new Error("Expected calculated sky positions");
    expect(
      result.positions.find((item) => item.body === "Mercury")?.retrograde
    ).toBe(true);
    expect(
      result.positions.find((item) => item.body === "Sun")?.retrograde
    ).toBe(false);
    expect(result.natal).toBeUndefined();
  });

  it("rejects dates outside the supported product range", () => {
    expect(
      calculateAstrology({ mode: "sky", at: "1800-01-01T00:00:00Z" }).status
    ).toBe("needs_clarification");
  });
});
