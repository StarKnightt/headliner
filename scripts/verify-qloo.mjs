// Live check of every Qloo call Headliner makes. Prints shapes and counts, never the key.
// Usage: QLOO_API_KEY=... pnpm verify:qloo [artist]     (or put the key in .env.local)
// Costs about 12 calls of the hackathon key's 10,000-a-month quota.
import { readFileSync } from "node:fs";

function loadEnvLocal() {
  try {
    for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {}
}
loadEnvLocal();

const KEY = process.env.QLOO_API_KEY;
const BASE = process.env.QLOO_BASE_URL || "https://hackathon.api.qloo.com";
if (!KEY) {
  console.error("QLOO_API_KEY is not set (env or .env.local).");
  process.exit(1);
}
const artistName = process.argv[2] ?? "Khruangbin";
const NA = "POLYGON((-126 24,-52 24,-52 57,-126 57,-126 24))";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let quota = null;
async function get(path, params) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== "")).toString();
  const t0 = Date.now();
  const res = await fetch(`${BASE}${path}?${qs}`, { headers: { "X-Api-Key": KEY, accept: "application/json" } });
  const text = await res.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {}
  quota = res.headers.get("x-month-ratelimit-remaining") ?? quota;
  await sleep(250); // the hackathon key allows 5 requests per second
  return { status: res.status, ms: Date.now() - t0, body, text };
}

const results = [];
async function check(label, path, params, inspect, { expectStatus = 200 } = {}) {
  const r = await get(path, params);
  let summary;
  try {
    summary = r.status === 200 ? inspect(r.body) : r.text.slice(0, 240);
  } catch (e) {
    summary = `inspect failed: ${e.message}`;
  }
  const ok = r.status === expectStatus;
  results.push({ label, ok });
  console.log(`\n${ok ? "OK  " : "FAIL"} ${label}  [${r.status}, ${r.ms}ms]`);
  console.log(`     GET ${path}?${new URLSearchParams(params)}`.slice(0, 260));
  console.log(`     ${typeof summary === "string" ? summary : JSON.stringify(summary, null, 1).replace(/\n/g, "\n     ")}`);
  return r.body;
}

const search = await check("search artist", "/search", { query: artistName, types: "urn:entity:artist", take: 3 }, (b) => ({
  first: b.results?.[0] && { name: b.results[0].name, entity_id: b.results[0].entity_id, popularity: b.results[0].popularity },
}));
const artist = search?.results?.[0]?.entity_id;
if (!artist) {
  console.error("\nNo artist id; stopping.");
  process.exit(1);
}

await check("room category tags", "/v2/tags", { "filter.query": "live music venue", "feature.semantic_search": true, take: 10 }, (b) =>
  (b.results?.tags ?? []).filter((t) => (t.id ?? t.tag_id).startsWith("urn:tag:category:place:")).map((t) => t.id ?? t.tag_id),
);

const heat = await check("territory heatmap (WKT polygon)", "/v2/insights", { "filter.type": "urn:heatmap", "signal.interests.entities": artist, "filter.location": NA }, (b) => {
  const h = b.results?.heatmap ?? [];
  return { cells: h.length, precision: h[0]?.location?.geohash?.length, top: h[0]?.query };
});
if (!heat?.results?.heatmap?.length) console.log("     (no cells: city scoring would have no data)");

await check("country heatmap (India query)", "/v2/insights", { "filter.type": "urn:heatmap", "signal.interests.entities": artist, "filter.location.query": "India" }, (b) => ({
  cells: b.results?.heatmap?.length ?? 0,
}));

await check(
  "locality-boundary heatmap (known to fail on the hackathon host)",
  "/v2/insights",
  { "filter.type": "urn:heatmap", "signal.interests.entities": artist, "filter.location.query": "Texas", "output.heatmap.boundary": "urn:entity:locality" },
  () => "unexpectedly worked: Headliner could switch to city-level boundaries",
  { expectStatus: 500 },
);

await check("city hotspots", "/v2/insights", { "filter.type": "urn:heatmap", "signal.interests.entities": artist, "filter.location.query": "Austin, Texas" }, (b) => ({
  cells: b.results?.heatmap?.length ?? 0,
  precision: b.results?.heatmap?.[0]?.location?.geohash?.length,
}));

await check(
  "rooms in Portland, Oregon",
  "/v2/insights",
  {
    "filter.type": "urn:entity:place",
    "signal.interests.entities": artist,
    "filter.location.query": "Portland, Oregon",
    "filter.tags": "urn:tag:category:place:live_music_venue",
    "feature.explainability": true,
    take: 4,
  },
  (b) => ({
    names: (b.results?.entities ?? []).map((e) => `${e.name} aff=${e.query?.affinity?.toFixed(3)}`),
    locality: b.query?.localities?.filter?.[0]?.disambiguation,
  }),
);

await check(
  "rooms by WKT point (fallback for unresolved names)",
  "/v2/insights",
  {
    "filter.type": "urn:entity:place",
    "signal.interests.entities": artist,
    "filter.location": "POINT(91.8933 25.5788)",
    "filter.location.radius": 20000,
    "filter.tags": "urn:tag:category:place:live_music_venue",
    take: 3,
  },
  (b) => (b.results?.entities ?? []).map((e) => e.name),
);

await check("similar artists", "/v2/insights", { "filter.type": "urn:entity:artist", "signal.interests.entities": artist, "filter.exclude.entities": artist, take: 6 }, (b) =>
  (b.results?.entities ?? []).map((e) => `${e.name} aff=${e.query?.affinity?.toFixed(3)} pop=${e.popularity?.toFixed(3)}`),
);

await check("brands", "/v2/insights", { "filter.type": "urn:entity:brand", "signal.interests.entities": artist, take: 8 }, (b) =>
  (b.results?.entities ?? []).map((e) => `${e.name} aff=${e.query?.affinity?.toFixed(3)}`),
);

await check("demographics", "/v2/insights", { "filter.type": "urn:demographics", "signal.interests.entities": artist }, (b) => b.results?.demographics?.[0]?.query);

await check(
  "taste tags by subtype",
  "/v2/insights",
  {
    "filter.type": "urn:tag",
    "signal.interests.entities": artist,
    "filter.tag.types": "urn:tag:genre:music,urn:tag:style:qloo,urn:tag:audience:qloo",
    "diversify.by": "subtype",
    "diversify.take": 3,
    take: 12,
  },
  (b) => (b.results?.tags ?? []).map((t) => `${t.subtype}: ${t.name.trim()}`),
);

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks behaved as expected. Monthly quota left: ${quota ?? "unknown"}.`);
process.exit(failed.length ? 1 : 0);
