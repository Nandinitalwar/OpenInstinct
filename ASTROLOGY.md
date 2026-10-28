# Astrology text agent — first version

This fork specializes the existing OpenInstinct agent for conversational Western
tropical astrology. The existing web chat and Linq iMessage channel use the same
root instructions and `calculate_astrology` tool. Model calls now use OpenRouter
by default, with the original Vercel AI Gateway route available via configuration.

## Local web testing with OpenRouter

No cloud database, Linq number, Kernel account, or Docker installation is needed
for local astrology chat. On this Mac, run `pnpm db:local` in one terminal to
start persistent PostgreSQL on `127.0.0.1:54329`. Its data directory is ignored
by Git. This database uses development credentials and binds only to loopback;
it is not a production database service.

Copy `.env.example` to `.env.local` if it does not already exist. Set
`MODEL_PROVIDER=openrouter`, `OPENROUTER_API_KEY` to your key, and
`OPENROUTER_MODEL=google/gemini-2.5-flash-lite`. The key stays server-side. Do
not commit it or paste it into chat. Keep both database URLs pointed at the
local database. Leave Kernel and Linq credentials blank for web testing.

Run `pnpm db:migrate`, then `pnpm dev:app --hostname 127.0.0.1` in another
terminal. Open `http://localhost:3000/chat`. The existing localhost-only
development sign-in accepts a test phone number (for example `+15555550100`)
without sending an SMS. Production still requires verified phone sign-in.

Use the workspace model picker at `/` to select another tool-capable OpenRouter
model. Prices are fetched from OpenRouter and shown in USD per million input /
output tokens; actual billing depends on tokens, routing, caching, and provider
charges. Provider selections are stored separately in the database. Start a new
chat for clean comparisons so earlier answers do not influence the next model.

`MODEL_PROVIDER=gateway` restores the original AI Gateway path. An absent or
invalid OpenRouter key never triggers an automatic paid fallback to that path.

## Implemented

- Conversational birth-date, known-time, and city onboarding; confirm the IANA
  time zone before calculation. The model resolves the city; this is not an
  automated geocoding service.
- Local-time conversion with historical zone rules. Ambiguous and nonexistent
  daylight-saving times fail rather than silently shifting. A confirmed offset
  can disambiguate a repeated time.
- Geocentric tropical longitudes and signs for Sun, Moon, Mercury, Venus, Mars,
  Jupiter, Saturn, Uranus, Neptune, and Pluto using Astronomy Engine 2.1.19.
- Five major natal aspects with a fixed 6° orb; transit-to-natal aspects with a
  fixed 3° orb. Orbs are conventions, not astronomical accuracy estimates.
- Retrograde flags based on a centered two-hour longitude difference.
- Current sky without a birth profile; transit comparisons at a requested instant.
- Instructions for concise texts, symbolic interpretation, consent before saving
  birth details, and opt-in scheduling using inherited tools.

The supported product date range is 1900–2100. There are no rising signs, houses,
sidereal/Vedic charts, nodes, asteroids, compatibility scores, or searches for
exact future events. Unknown birth times support general discussion only in
this version. Calculations return structured data; the model supplies the reading.
Onboarding, memory consent, and reading style are model instructions and still
need live conversation evaluation before launch.

## Try the calculation without credentials

```sh
pnpm exec vitest run agent/lib/astrology/chart.test.ts
pnpm exec tsx -e 'import { calculateAstrology } from "./agent/lib/astrology/chart.ts"; console.log(JSON.stringify(calculateAstrology({mode:"natal",birth:{localDateTime:"1995-08-12T14:30:00",timeZone:"America/Los_Angeles"}}),null,2))'
```

## Run conversations

Use the local setup above, or follow the upstream README's Docker/Vercel path.
Example: “I was born August 12, 1995 at 2:30pm in Los Angeles.
What themes do you see in my chart?”

For real texts, deploy and connect Linq using the README instructions. A fork
alone does not provision a number, model access, database, or delivery service.
Do not enter API keys into chat or commit `.env.local`.

Suggested live acceptance checks: unknown birth time, a repeated DST time,
correcting previously supplied birth details, refusing to save a profile,
asking for a Vedic reading, and creating/canceling an opt-in daily reading.
Check actual received messages as well as web chat before inviting users.

## Next product work

Add verified geocoding and location-based ascendant/house calculations, a
structured birth-profile editor, and live conversation evaluations. The fork
still exposes upstream browser, wallet, and workspace capabilities; a dedicated
astrology-only product should narrow that tool surface before public launch.
