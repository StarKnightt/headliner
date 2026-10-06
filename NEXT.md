# Verification log and next steps

Headliner was first built against documented response shapes and a mock transport (Oct 4). On Oct 6
it was moved to the live hackathon API, every call was checked against real responses, and the
mapping and scoring were rebuilt where reality differed. This file records what was found.

Deadline: **Oct 31, 2026, 9:15 AM IST.** Live demo: https://headliner-five.vercel.app

## Endpoint by endpoint (live, Oct 6)

`pnpm verify:qloo` exercises every call below (about 12 calls) and exits non-zero if one misbehaves.

| Call | Finding | Change |
| --- | --- | --- |
| `GET /search?types=urn:entity:artist` | `{ results: [...] }`, `types` honoured, exact names resolve (Prateek Kuhad, AP Dhillon, PEGGY GOU in caps) | exact case-insensitive match first |
| `GET /v2/tags` | `live_music_venue`, `concert_hall`, `night_club`, `jazz_club`, `performing_arts_theater`, `arena`, `amphitheater`, `stadium` exist as `urn:tag:category:place:*`. The guessed `music_venue` does not. `filter.parents.types=urn:entity:place` returns decor and setting tags, not categories | room sizes map to verified category IDs; semantic search without the parents filter |
| `urn:heatmap` + `output.heatmap.boundary=urn:entity:locality` | **500 "System Error"** for every area tried (US, Europe, India, a WKT box, a tag signal, a single city). Only `urn:geohash` and `urn:entity:locality` are accepted values | cities are read from geohash cells instead |
| `urn:heatmap` with `filter.location.query` | "United States", "Canada", "India" work. "Europe" and "Southeast Asia" return zero cells | multi-country territories use WKT polygons (`filter.location`) |
| `urn:heatmap` shape | `location.{latitude,longitude,geohash}`, `query.{affinity,affinity_rank,popularity}`. Country-size areas return precision-4 cells (about 40 km), 1,000 to 10,000 of them; `take` is ignored. Affinity and popularity are uniform percentiles across the queried cells | one call per territory; each city read at its centre cell; packed for caching |
| `urn:entity:place` | works with the real tags; affinity clusters at 0.80 to 0.87 inside a city; popularity tracks prominence, not capacity. Locality proof is `query.localities.filter[0].disambiguation` (not `query.locality.signal`) | rooms ranked real-room-first; locality shown per stop; popularity bands dropped except a 0.97 cap for clubs |
| `urn:entity:place` with unresolvable names | `400 filter.location.query is unable to resolve to a valid locality` (Shillong) | retry with `filter.location=POINT(lng lat)` and a 20 km radius |
| `urn:entity:artist` | exclude works; every known touring act is above popularity 0.9; `signal.demographics.age=24_and_younger` changes the list | multiplicative popularity bands for peers and support acts |
| `urn:entity:brand` | duplicates by name (two Fjällräven IDs); category lives in `urn:tag:genre:brand` tags | dedupe by name; category from tags |
| `urn:demographics` | `results.demographics[0].query.age` and `.gender`, values −1 to 1, as documented | demographic facts are written by the server, never by the LLM |
| `urn:tag` | results under `results.tags` with `tag_id` and `subtype`; mixes every domain. `filter.tag.types` and `diversify.by=subtype` work | one call across six subtypes, grouped in the audience brief; names trimmed |
| `/v2/audiences` | needs `filter.parents.types` (or another filter); not used | removed from the verify script |
| explainability | 1.0 with one signal; about 33/33/33 across three artists | treated as provenance, not insight |
| limits | `x-second-ratelimit-limit: 5`, `x-month-ratelimit-limit: 10000` | 230 ms spacing, in-flight sharing, 7-day cache, quota floor, run replay |

## Calibration

Real percentiles put every big city near the top, so the mock-tuned thresholds (affinity ≥ 0.68,
popularity < 0.55) labelled everything a stronghold. The read now uses a log scale of how far into the
top a city sits; thresholds were set on heatmaps for 12 artists across all six territories
(`eval/calibrate.eval.ts`, gitignored). See the README for the rules.

## LLM planner on live data

`pnpm eval:llm` (10 cases, including Prateek Kuhad and Anoushka Shankar in India, AP Dhillon in North
America, Fred again.. in Europe and a prompt-injection case) went 6/10 on the first live round: runs
overflowed Groq's 8K tokens per minute and ran out of turns. After shrinking the digest, fetching rooms
for hidden gems up front, forcing a submission on the last two turns and narrowing one validator, the
four failed cases passed (4/4), as did Khruangbin on the final code. The rest of the final round hit
Groq's free-tier daily cap (200K tokens per model) on the shared key; those runs finished on the
deterministic planner, as designed. Re-run the eval when the key has budget.

## Before submitting

- [ ] Join the hackathon on Devpost (accept the official rules), then "Enter a submission" and paste
      `../DEVPOST.md`; upload `shots/` as the gallery. Devpost asks for a reCAPTCHA when the project is created.
- [ ] Re-warm the demos with the LLM once Groq has budget: `pnpm warm https://headliner-five.vercel.app --fresh`.
- [ ] Optional: a dedicated Groq key (or Groq's Dev tier) for Headliner, so other projects cannot exhaust its daily tokens.
- [ ] Re-warm again just before judging (Nov 2): recorded runs and cached Qloo responses last 7 days.
- [ ] Check the demo URL logged out in an incognito window; confirm MIT shows in the GitHub About sidebar.
