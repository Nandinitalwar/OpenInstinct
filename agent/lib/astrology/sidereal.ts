import {
  Body,
  Ecliptic,
  GeoVector,
  MakeTime,
  RotateVector,
  Rotation_ECL_EQJ,
  e_tilt,
  SunPosition,
  Vector,
} from "astronomy-engine";

const bodies = [
  Body.Sun,
  Body.Moon,
  Body.Mercury,
  Body.Venus,
  Body.Mars,
  Body.Jupiter,
  Body.Saturn,
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
const rashis = [
  "Mesha",
  "Vrishabha",
  "Mithuna",
  "Karka",
  "Simha",
  "Kanya",
  "Tula",
  "Vrishchika",
  "Dhanu",
  "Makara",
  "Kumbha",
  "Meena",
];
const nakshatras = [
  "Ashwini",
  "Bharani",
  "Krittika",
  "Rohini",
  "Mrigashira",
  "Ardra",
  "Punarvasu",
  "Pushya",
  "Ashlesha",
  "Magha",
  "Purva Phalguni",
  "Uttara Phalguni",
  "Hasta",
  "Chitra",
  "Swati",
  "Vishakha",
  "Anuradha",
  "Jyeshtha",
  "Mula",
  "Purva Ashadha",
  "Uttara Ashadha",
  "Shravana",
  "Dhanishta",
  "Shatabhisha",
  "Purva Bhadrapada",
  "Uttara Bhadrapada",
  "Revati",
];
const round = (value: number) => Math.round(value * 10000) / 10000;
const normalize = (value: number) => ((value % 360) + 360) % 360;
const signedAngle = (value: number) => normalize(value + 180) - 180;

function ayanamsa(date: Date) {
  // Lahiri mean ayanamsa at J2000. Propagate that fixed reference direction
  // with Astronomy Engine's precession/nutation into the true ecliptic of date.
  // This is a Lahiri-aligned approximation, independently checked against
  // Swiss Ephemeris reference outputs; no Swiss Ephemeris code is bundled.
  const angle = (23.85709235370882 * Math.PI) / 180;
  const reference = new Vector(
    Math.cos(angle),
    Math.sin(angle),
    0,
    MakeTime(date)
  );
  return Ecliptic(RotateVector(Rotation_ECL_EQJ(), reference)).elon;
}

function tropicalLongitude(body: Body, date: Date) {
  return body === Body.Sun
    ? SunPosition(date).elon
    : Ecliptic(GeoVector(body, date, true)).elon;
}

function meanNode(date: Date) {
  // Mean ascending lunar node, Meeus Astronomical Algorithms, chapter 47.
  const t = MakeTime(date).tt / 36525;
  return normalize(
    125.0445479 -
      1934.1362891 * t +
      0.0020754 * t ** 2 +
      t ** 3 / 467441 -
      t ** 4 / 60616000 +
      e_tilt(MakeTime(date)).dpsi / 3600
  );
}

function placement(body: string, longitude: number, speed: number) {
  const lon = normalize(longitude);
  const nakshatraIndex = Math.floor((lon * 27) / 360);
  return {
    body,
    rashiIndex: Math.floor(lon / 30),
    longitude: round(lon),
    sign: signs[Math.floor(lon / 30)],
    rashi: rashis[Math.floor(lon / 30)],
    degreesInSign: round(lon % 30),
    nakshatra: {
      name: nakshatras[nakshatraIndex],
      pada: Math.floor(((lon * 27) / 360 - nakshatraIndex) * 4) + 1,
    },
    retrograde: speed < 0,
    degreesPerDay: round(speed),
    boundaryWarning:
      Math.min(lon % (10 / 3), 10 / 3 - (lon % (10 / 3))) < 0.05
        ? "Near a pada boundary: approximate coordinates or birth-time uncertainty may change the pada, nakshatra, or rashi. Verify before a definitive reading."
        : null,
  };
}

export function siderealPositions(date: Date) {
  const offset = ayanamsa(date);
  const before = new Date(date.getTime() - 3600000);
  const after = new Date(date.getTime() + 3600000);
  const beforeOffset = ayanamsa(before);
  const afterOffset = ayanamsa(after);
  const positions = bodies.map((body) =>
    placement(
      body,
      tropicalLongitude(body, date) - offset,
      signedAngle(
        tropicalLongitude(body, after) -
          afterOffset -
          (tropicalLongitude(body, before) - beforeOffset)
      ) * 12
    )
  );
  const rahu = normalize(meanNode(date) - offset);
  const nodeSpeed =
    signedAngle(
      meanNode(after) - afterOffset - (meanNode(before) - beforeOffset)
    ) * 12;
  positions.push(
    placement("Rahu", rahu, nodeSpeed),
    placement("Ketu", rahu + 180, nodeSpeed)
  );
  return { ayanamsaDegrees: round(offset), positions };
}

export function grahaRelationships(
  left: ReturnType<typeof siderealPositions>["positions"],
  right: ReturnType<typeof siderealPositions>["positions"],
  sameChart: boolean
) {
  return left.flatMap((first, firstIndex) =>
    right.flatMap((second, secondIndex) => {
      if (sameChart && firstIndex === secondIndex) return [];
      const distance = ((second.rashiIndex - first.rashiIndex + 12) % 12) + 1;
      if (distance === 1 && (!sameChart || firstIndex < secondIndex)) {
        return [
          {
            from: first.body,
            to: second.body,
            relationship: "same-rashi conjunction",
            signDistance: distance,
          },
        ];
      }
      // Whole-sign Parashari graha drishti, with nodes excluded by convention.
      if (first.body === "Rahu" || first.body === "Ketu") return [];
      const special =
        first.body === "Mars"
          ? [4, 8]
          : first.body === "Jupiter"
            ? [5, 9]
            : first.body === "Saturn"
              ? [3, 10]
              : [];
      return distance === 7 || special.includes(distance)
        ? [
            {
              from: first.body,
              to: second.body,
              relationship: "graha-drishti",
              signDistance: distance,
            },
          ]
        : [];
    })
  );
}
