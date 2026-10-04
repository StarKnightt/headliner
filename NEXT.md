# NEXT: when the Qloo key arrives

Everything below was built against documented response shapes and a mock transport. Nothing has
been checked against the live API yet. Work through this list top to bottom; each item names the
code to change if reality differs.

Deadline: **Oct 31, 2026, 9:15 AM IST**. Needs a hosted demo, a public repo with an OSS license (MIT
is in place), and real Qloo usage.

## 0. Put the key in place (never in git, chat, screenshots or the browser)

```bash
cp .env.example .env.local      # .env.local is gitignored; .env.example is the only env file committed
# edit .env.local → QLOO_API_KEY=...
pnpm verify:qloo Khruangbin     # live smoke test of every call, prints shapes only
pnpm verify:qloo "Prateek Kuhad"
```

`verify:qloo` exits non-zero if any call fails. Paste its output into an issue or note. It never
prints the key, but check before sharing anyway.

## 1. Endpoint-by-endpoint checks

Code under test: `src/lib/qloo/service.ts` (parameters), `src/lib/qloo/mapping.ts` (parsing),
`src/lib/qloo/types.ts` (raw types). When a shape differs, fix the mapping, add the real (redacted)
payload as a fixture in `test/qloo-client.test.ts`, and run `pnpm test`.

### 1.1 `GET /search?query=<artist>&types=urn:entity:artist&take=5`
- [ ] Body is `{ results: [...] }` (not `{ results: { entities } }`). `mapSearch` expects an array.
- [ ] Each result has `entity_id`, `name`, `popularity` and `types` (or `subtype`). Image lives at `properties.image.url`.
- [ ] `types` is honoured (only artists come back). If not, filter by type in `searchArtist`.
- [ ] Ambiguous names ("Phoenix", "Low"): is the first result the most popular? The agent
      currently takes `[0]`.

### 1.2 `GET /v2/tags?filter.query=music venue&feature.semantic_search=true&take=8`
- [ ] Returns `results.tags[]` with `id` (or `tag_id`), `name`, `type`.
- [ ] Find the **real venue tag IDs**. `DEFAULT_VENUE_TAG = "urn:tag:category:place:music_venue"`
      in `service.ts` is a guess. Replace it with the real ones (live music venue, concert hall,
      nightclub, theater…).
- [ ] Does `filter.parents.types=urn:entity:place` narrow to place tags? If not, drop it.

### 1.3 Locality heatmap: the core city-scoring call
`/v2/insights?filter.type=urn:heatmap&signal.interests.entities=<id>&filter.location.query=<within>&output.heatmap.boundary=urn:entity:locality&take=50`
- [ ] `output.heatmap.boundary=urn:entity:locality` is accepted and returns city-level points.
      **Biggest unknown.** If it is ignored (invalid params are silently dropped), you get geohash
      cells instead. Check that points carry a `name` and that coordinates look like city centres.
- [ ] Country and region queries resolve: "United States", "Canada", "Europe", "Southeast Asia",
      "United Kingdom", "India" (`REGION_LOCALITY_QUERIES`). If "Europe" or "Southeast Asia"
      don't resolve, split them into countries.
- [ ] Point shape is `{ location: { latitude, longitude, geohash }, query: { affinity, affinity_rank, popularity } }`.
- [ ] `take` above 50 is capped. If coverage is thin, increase calls per region instead.
- [ ] Fallback: if locality heatmaps don't work at all, `scoreCities` already falls back to one
      geohash heatmap per city (mean of the top 5 cells). That costs about 16–20 calls per run,
      so watch rate limits.
- [ ] **Alternative to try:** `filter.type=urn:entity:artist` + `filter.results.entities=<id>` +
      `signal.location.query=<city>` per city, reading `query.affinity`. The Entity Type Parameter
      Guide does **not** list `signal.location` for artists, so expect it to be ignored. Confirm
      by comparing two cities. If the affinity changes, it is a cleaner per-city score.

### 1.4 Geohash heatmap in a city
`filter.type=urn:heatmap&filter.location.query=Austin&take=20`
- [ ] Cells fall inside the city (not centred on a same-named place elsewhere, e.g. Portland or
      Cambridge). If they don't, use `CITIES[].query` disambiguation ("Portland, Oregon").
- [ ] `query.locality` in the response shows which locality matched. It becomes `qlooLocality` on each stop.

### 1.5 Venues
`filter.type=urn:entity:place&filter.location.query=<city>&filter.tags=<venue tags>&filter.popularity.min/max&feature.explainability=true&take=5`
- [ ] Results are actually music venues once the real tag IDs are in.
- [ ] `location.lat` / `location.lon` and `properties.address` exist (`mapPlace`).
- [ ] The popularity band (`venuePopularityRange` in `agent/tools.ts`) isn't too narrow. The tool
      widens once if the result is empty. Check how often that happens.
- [ ] Explainability path: `query.explainability["signal.interests.entities"]`.

### 1.6 Similar artists (bill)
`filter.type=urn:entity:artist&filter.exclude.entities=<id>&filter.popularity.min/max&feature.explainability=true`
- [ ] Exclude works (the headliner isn't in its own list).
- [ ] `signal.demographics.age` (used for the "younger" option) is accepted, and which value
      format works (`24_and_younger`?).

### 1.7 Brands, demographics, taste tags
- [ ] `urn:entity:brand` returns brands with a usable category. `properties.short_description`
      becomes the category; if it's empty, use tags.
- [ ] `urn:demographics` shape is `results.demographics[0].query.age{band:val}` and `.gender{male,female}`,
      with values in −1..1 (the schema clamps them).
- [ ] `urn:tag` insights: are results under `results.tags` or `results.entities`? `tasteTags()`
      reads `results.tags` only. The verify script prints both.

### 1.8 `/v2/audiences`
- [ ] Response shape. It is typed but not used in the plan yet. Possible use: audience presets
      for the brand brief.

### 1.9 Limits
- [ ] Note the rate limit (the verify script prints `x-ratelimit-remaining` if present). A run makes
      about 20–30 calls. The HTTP transport caches every URL for 24h in memory and retries
      429/5xx three times with backoff.
- [ ] Latency per call. If runs take more than about 40s, lower the parallelism in `deterministic.ts`
      or tighten `mapLimit` in `scoreCities`.

## 2. With the real key, in the app

- [ ] `pnpm dev`: the badge shows **Qloo live** and the hazard banner disappears. `/api/status`
      returns `{"qloo":"live",...}`.
- [ ] Run Khruangbin NA, Prateek Kuhad India, Fred again.. Europe, and Peggy Gou APAC. Check that
      each map looks plausible and that the Qloo calls tab shows no `[mock]` tags.
- [ ] Re-tune the opportunity thresholds in `src/lib/plan/routing.ts` to the live distribution
      (mock data was tuned to produce some hidden gems; live data may not).
- [ ] Add an LLM key (`GROQ_API_KEY` first) and confirm the model supports tool calling. The
      default is `openai/gpt-oss-120b`; check that it is still listed on Groq. Watch the timeline
      for "dropped" references, which mean the model tried to cite something Qloo didn't return.
      **The LLM path has only been exercised by unit tests so far; no real model run has happened.**
- [ ] `pnpm shots` against the live build, then replace the mock screenshots in `shots/` and the README.
      Check them for any key or personal data before committing.
- [ ] Update the README example block with a real (redacted) request→result.

## 3. Deploy to Vercel (not done yet; don't deploy until section 1 passes)

The Vercel CLI isn't installed globally. Use `pnpm dlx vercel` or the dashboard.

1. Create the GitHub repo (public) and push:
   `gh repo create StarKnightt/headliner --public --source . --remote origin --push`
2. Import into Vercel. Either use the dashboard ("Add New → Project", pick the repo; framework is
   detected as Next.js, install command `pnpm install`), or from this folder:
   ```bash
   pnpm dlx vercel login
   pnpm dlx vercel link
   ```
3. Add env vars as **Production + Preview**, server-side only, never `NEXT_PUBLIC_`:
   ```bash
   pnpm dlx vercel env add QLOO_API_KEY production
   pnpm dlx vercel env add GROQ_API_KEY production
   # repeat for preview; optional: LLM_MODEL, QLOO_BASE_URL
   ```
4. `/api/plan` sets `maxDuration = 120`. That's within the Hobby limit with Fluid compute
   (default on). If runs are slow, check function logs.
5. Deploy a preview with `pnpm dlx vercel` and smoke-test it: run a plan, open `/how`, print the
   booking sheet, and try a phone. Then promote with `pnpm dlx vercel --prod`.
6. Optional: since the key is server-side, the only abuse risk is people burning your Qloo quota.
   If that matters, add a simple per-IP rate limit on `/api/plan` (for example Vercel Firewall rate limiting).
7. Put the production URL in the Devpost entry and the README.

## 4. Devpost entry checklist

- [ ] Hosted demo URL (live Qloo, not mock).
- [ ] Public repo, MIT license.
- [ ] A description of exactly how Qloo is used. `/how` and the README "How a run works" section cover it.
- [ ] Screenshots from live mode.
