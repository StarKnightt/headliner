// Live check of every Qloo call Headliner makes. Prints shapes and counts, never the key.
// Usage: QLOO_API_KEY=... pnpm verify:qloo [artist]     (or put the key in .env.local)
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

async function get(path, params) {
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== "")).toString();
  const t0 = Date.now();
  const res = await fetch(`${BASE}${path}?${qs}`, { headers: { "X-Api-Key": KEY, accept: "application/json" } });
  const text = await res.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {}
  return { status: res.status, ms: Date.now() - t0, body, text, rate: res.headers.get("x-ratelimit-remaining") };
}

const keysOf = (o) => (o && typeof o === "object" ? Object.keys(o) : []);
const results = [];

async function check(label, path, params, inspect) {
  const r = await get(path, params);
  let summary;
  try {
    summary = r.status === 200 ? inspect(r.body) : r.text.slice(0, 300);
  } catch (e) {
    summary = `inspect failed: ${e.message}`;
  }
  const ok = r.status === 200;
  results.push({ label, ok });
  console.log(`\n${ok ? "OK  " : "FAIL"} ${label}  [${r.status}, ${r.ms}ms${r.rate ? `, remaining ${r.rate}` : ""}]`);
  console.log(`     GET ${path}?${new URLSearchParams(params)}`);
  console.log(`     ${typeof summary === "string" ? summary : JSON.stringify(summary, null, 1).replace(/\n/g, "\n     ")}`);
  return r.body;
}

const search = await check("search artist", "/search", { query: artistName, types: "urn:entity:artist", take: 3 }, (b) => ({
  topKeys: keysOf(b),
  first: b.results?.[0] && { name: b.results[0].name, entity_id: b.results[0].entity_id, types: b.results[0].types, popularity: b.results[0].popularity },
}));
const artist = search?.results?.[0]?.entity_id;
if (!artist) {
  console.error("\nNo artist id; stopping.");
  process.exit(1);
}

const tags = await check("venue tags", "/v2/tags", { "filter.query": "music venue", "feature.semantic_search": true, take: 8 }, (b) =>
  (b.results?.tags ?? []).map((t) => `${t.id ?? t.tag_id} | ${t.name} | ${t.type ?? t.subtype ?? ""}`),
);
const venueTag = tags?.results?.tags?.[0]?.id ?? tags?.results?.tags?.[0]?.tag_id;

await check("tags filtered to place parents", "/v2/tags", { "filter.query": "music venue", "filter.parents.types": "urn:entity:place", take: 8 }, (b) =>
  (b.results?.tags ?? []).map((t) => `${t.id ?? t.tag_id} | ${t.name}`),
);

for (const within of ["United States", "Europe", "Southeast Asia", "India"]) {
  await check(`locality heatmap within "${within}"`, "/v2/insights", {
    "filter.type": "urn:heatmap",
    "signal.interests.entities": artist,
    "filter.location.query": within,
    "output.heatmap.boundary": "urn:entity:locality",
    take: 50,
  }, (b) => {
    const h = b.results?.heatmap ?? [];
    return { count: h.length, pointKeys: keysOf(h[0]), locationKeys: keysOf(h[0]?.location), sample: h.slice(0, 3), queryEcho: b.query };
  });
}

await check("geohash heatmap in Austin", "/v2/insights", {
  "filter.type": "urn:heatmap",
  "signal.interests.entities": artist,
  "filter.location.query": "Austin",
  take: 20,
}, (b) => ({ count: b.results?.heatmap?.length ?? 0, sample: b.results?.heatmap?.[0], locality: b.query?.locality }));

await check("venues in Austin", "/v2/insights", {
  "filter.type": "urn:entity:place",
  "signal.interests.entities": artist,
  "filter.location.query": "Austin",
  "filter.tags": venueTag ?? "urn:tag:category:place:music_venue",
  "feature.explainability": true,
  take: 5,
}, (b) => ({
  count: b.results?.entities?.length ?? 0,
  names: (b.results?.entities ?? []).map((e) => `${e.name} aff=${e.query?.affinity} pop=${e.popularity} loc=${e.location?.lat},${e.location?.lon}`),
  explainKeys: keysOf(b.results?.entities?.[0]?.query?.explainability),
  locality: b.query?.locality,
}));

await check("similar artists", "/v2/insights", {
  "filter.type": "urn:entity:artist",
  "signal.interests.entities": artist,
  "filter.exclude.entities": artist,
  "feature.explainability": true,
  take: 8,
}, (b) => (b.results?.entities ?? []).map((e) => `${e.name} aff=${e.query?.affinity} pop=${e.popularity}`));

await check("brands", "/v2/insights", { "filter.type": "urn:entity:brand", "signal.interests.entities": artist, take: 8 }, (b) =>
  (b.results?.entities ?? []).map((e) => `${e.name} aff=${e.query?.affinity}`),
);

await check("demographics", "/v2/insights", { "filter.type": "urn:demographics", "signal.interests.entities": artist }, (b) => b.results?.demographics?.[0] ?? keysOf(b.results));

await check("taste tags", "/v2/insights", { "filter.type": "urn:tag", "signal.interests.entities": artist, take: 12 }, (b) => ({
  resultKeys: keysOf(b.results),
  tags: (b.results?.tags ?? b.results?.entities ?? []).slice(0, 12).map((t) => `${t.name} aff=${t.query?.affinity ?? t.affinity}`),
}));

await check("audiences", "/v2/audiences", { take: 5 }, (b) => (b.results?.audiences ?? []).map((a) => `${a.entity_id} | ${a.name}`));

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} calls returned 200.`);
process.exit(failed.length ? 1 : 0);
