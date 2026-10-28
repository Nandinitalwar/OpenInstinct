import { Body } from "astronomy-engine";
import { describe, expect, it } from "vitest";
import { calculateAstrology } from "./chart";

const birth = {
  localDateTime: "2000-01-01T07:00:00",
  timeZone: "America/New_York",
};

describe("astrology calculations", () => {
  it("resolves historical local time and returns a geocentric natal chart", () => {
    const result = calculateAstrology({ mode: "natal", birth });
    expect(result.status).toBe("ok");
    expect(result.natal?.birth.utc).toBe("2000-01-01T12:00:00.000Z");
    expect(result.natal?.positions).toHaveLength(10);
    const sun = result.natal?.positions.find((item) => item.body === Body.Sun);
    expect(sun?.sign).toBe("Capricorn");
    expect(sun?.longitude).toBeCloseTo(280.37, 1);
    const moon = result.natal?.positions.find(
      (item) => item.body === Body.Moon
    );
    expect(moon?.longitude).toBeCloseTo(223.32, 1);
    expect(
      new Set(result.natal?.aspects.map((item) => `${item.from}/${item.to}`))
        .size
    ).toBe(result.natal?.aspects.length);
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
      result.transits?.aspectsToNatal.filter(
        (item) =>
          item.from === item.to &&
          item.aspect === "conjunction" &&
          item.orb === 0
      )
    ).toHaveLength(10);
    expect(result.transits?.aspectsToNatal.every((item) => item.orb <= 3)).toBe(
      true
    );
  });

  it("calculates sky without birth data and reports retrograde motion", () => {
    const result = calculateAstrology({
      mode: "sky",
      at: "2024-04-15T12:00:00Z",
    });
    expect(
      result.positions?.find((item) => item.body === Body.Mercury)?.retrograde
    ).toBe(true);
    expect(
      result.positions?.find((item) => item.body === Body.Sun)?.retrograde
    ).toBe(false);
    expect(result.natal).toBeUndefined();
  });

  it("rejects dates outside the supported product range", () => {
    expect(
      calculateAstrology({ mode: "sky", at: "1800-01-01T00:00:00Z" }).status
    ).toBe("needs_clarification");
  });
});
