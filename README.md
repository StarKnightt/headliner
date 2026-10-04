# Headliner

**Tour where your fans already are.** Headliner is an agent that routes a concert tour from
[Qloo](https://www.qloo.com/) taste data. Give it an artist and a territory. It finds the cities
where that artist's audience over-indexes, the rooms that audience already goes to, the acts and
brands they share taste with, and an aggregate audience brief. It then routes the run, draws it on
a night-lights globe, and exports a booking sheet.

Built for the [Qloo Agentic Hackathon](https://qloo.devpost.com/).

![Headliner overview](shots/01-desktop-overview.png)

> The screenshots in `shots/` were taken in **mock mode** (no Qloo key yet). Every number in them
> is fixture data, and the app says so with a hazard banner, a "Mock data · not Qloo" badge, a
> `[mock]` tag on every call, and a MOCK caveat at the top of every export.

## Why Qloo

Booking agents route tours on gut feel and last tour's ticket counts. That data doesn't exist for
a first run in a new territory. Qloo's taste graph can show where an audience over-indexes
relative to local popularity before a single ticket is sold. Headliner treats that gap as the
signal. If a city has high fan affinity but low local popularity, the fans are there and the
market isn't crowded yet: a **hidden gem**.

| Read | Rule (Headliner's interpretation of Qloo numbers) |
| --- | --- |
| Hidden gem | affinity ≥ 68%, popularity < 55% |
| Stronghold | affinity ≥ 68% |
| Emerging | affinity ≥ 50% |
| Long shot | everything else |

## How a run works

1. **Resolve the artist:** `GET /search?query=…&types=urn:entity:artist`
2. **Find venue tags:** `GET /v2/tags?filter.query=music venue&feature.semantic_search=true`
3. **Score cities:** `GET /v2/insights?filter.type=urn:heatmap&signal.interests.entities=<artist>&filter.location.query=<country/region>&output.heatmap.boundary=urn:entity:locality`
   returns many cities in one call. Each result is matched to the city catalogue within 75 km. Any
   city that isn't matched falls back to its own geohash heatmap.
4. **Neighbourhood hotspots:** a geohash `urn:heatmap` per chosen city. These are drawn as glowing
   cells on the globe.
5. **Venues:** `filter.type=urn:entity:place` with `filter.location.query=<city>`, `filter.tags=<venue tags>`,
   a popularity band sized to the artist and room size, and `feature.explainability=true`.
6. **Bill:** similar artists (`urn:entity:artist`, excluding the headliner) at peer and smaller
   popularity bands, used as co-headliners and support.
7. **Partners and audience:** `urn:entity:brand`, `urn:demographics` and `urn:tag` insights.
8. **Plan:** steps 1–7 run as a fixed research pass. The LLM (Groq `openai/gpt-oss-120b` by
   default, tool calling) then gets a compact evidence digest, with Qloo IDs swapped for short
   aliases (`v3`, `a2`, `b1`). It picks the cities, rooms, bill and brands, and can call follow-up
   tools (`find_venues` with a room type, `similar_artists`) before it calls `submit_tour_plan`.
   The server checks the draft: valid IDs, the exact stop count, and the start and close cities.
   Every number cited in a stop reason must be that stop's own Qloo number, and any "hidden gem" or
   "stronghold" label must match its computed read. A failing draft goes back to the model once
   for correction. The server then hydrates every number, coordinate and leg from the evidence
   ledger, drops anything invented (the timeline shows what was dropped), routes the stops with
   nearest-neighbour plus 2-opt, and validates the result with zod. On a rate limit it moves to
   the next model in the chain; any other failure finishes with the deterministic planner. Without
   an LLM key, the deterministic planner runs on its own.

Each step streams to the **Soundcheck** timeline. The **Qloo calls** tab lists every request with
its parameters, duration and result count. The key is never shown.

Example run, Khruangbin across North America, 7 stops (mock data; the structure is real):

```text
GET /v2/insights?filter.type=urn:heatmap&signal.interests.entities=<id>
    &filter.location.query=United States&output.heatmap.boundary=urn:entity:locality&take=50
→ 50 localities · New York 88% / Los Angeles 83% / Denver 57% …
GET /v2/insights?filter.type=urn:entity:place&signal.interests.entities=<id>
    &filter.location.query=Austin&filter.tags=<venue tag>&filter.popularity.min=0.75&take=5
→ Stubb's Waller Creek, Mohawk …
⇒ 7 stops · 6,015 km · 23 Qloo calls · Itinerary + Markdown/JSON/printable booking sheet
```

More screenshots: [timeline](shots/02-agent-timeline.png) · [stop focus](shots/03-stop-focus-hotspots.png) ·
[Qloo calls](shots/04-qloo-calls.png) · [India](shots/05-india-run.png) · [Europe](shots/06-europe-run.png) ·
[booking sheet](shots/07-print-booking-sheet.png) · [/how](shots/08-how-qloo-powers-this.png) · [mobile](shots/09-mobile.png)

## Run it

Requires Node 22+ and pnpm 10.

```bash
pnpm install
cp .env.example .env.local   # add QLOO_API_KEY and optionally GROQ_API_KEY / OPENAI_API_KEY
pnpm dev                     # http://localhost:3000
```

| Script | What it does |
| --- | --- |
| `pnpm test` | vitest: plan schema, hydration/anti-hallucination, routing, Qloo mapping, HTTP client, mock transport |
| `pnpm typecheck` / `pnpm lint` / `pnpm build` | the usual |
| `pnpm verify:qloo [artist]` | hits every Qloo endpoint Headliner uses with the real key and prints response shapes |
| `pnpm shots [url]` | regenerates `shots/` from a running instance (uses the local Chrome, headless) |
| `pnpm eval:llm [url] [runs]` | runs 10 artist/territory/constraint cases through `/api/plan` and scores validity, latency, tokens and fallbacks |

### Environment

All variables are server-side only; none are `NEXT_PUBLIC_`. See [`.env.example`](.env.example).

- `QLOO_API_KEY`: if empty, the app runs on **mock fixtures** and labels them everywhere.
- `GROQ_API_KEY` or `OPENAI_API_KEY` (or `LLM_PROVIDER` / `LLM_API_KEY` / `LLM_BASE_URL` / `LLM_MODEL` /
  `LLM_FALLBACK_MODELS` for any OpenAI-compatible endpoint): if none is set, the deterministic planner runs.
  On Groq the default chain is `openai/gpt-oss-120b` → `openai/gpt-oss-20b` → `qwen/qwen3.8-27b`.
  Groq's free tier allows 8K tokens per minute per model, and a plan uses about 3–6K.

## Project layout

```text
src/lib/qloo/        typed client: transport interface, HTTP transport (cache + retries), mock transport, mapping
src/lib/agent/       tools, evidence ledger, LLM orchestrator, deterministic planner, stream events
src/lib/plan/        zod schemas, hydration, routing/scoring, Markdown export
src/components/      globe (R3F + custom shaders), control deck, timeline, itinerary, print sheet
src/app/api/plan     POST → NDJSON stream of agent events
```

## Limits and honesty

- Scores are Qloo **aggregate** taste affinities for audiences in a place. They are not
  ticket-sales forecasts and never describe an individual. No personal data is sent to Qloo.
- The opportunity labels and the stop score are Headliner's interpretation, not Qloo outputs.
- Venue suggestions are places Qloo associates with the audience. Capacity, availability and
  routing days still need a human agent.
- The city catalogue is curated (56 cities). Qloo localities are matched to it by distance.

## Credits

- Taste data: [Qloo](https://www.qloo.com/) Insights API (hackathon tier).
- Earth at night: NASA Earth Observatory, **Black Marble 2016** (public domain). See
  [`public/textures/ATTRIBUTION.md`](public/textures/ATTRIBUTION.md).
- Fonts: Big Shoulders, Instrument Sans and JetBrains Mono (SIL OFL, via Google Fonts).

## License

[MIT](LICENSE) © 2026 Prasenjit Nayak
