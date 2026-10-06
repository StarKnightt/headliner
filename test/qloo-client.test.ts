import { describe, expect, it, vi } from "vitest";
import { compactInsights, expandInsights } from "@/lib/qloo/compact";
import { buildQuery, HttpQlooTransport, QLOO_BASE_URL } from "@/lib/qloo/http";
import {
  brandCategory,
  cleanName,
  dedupeByName,
  mapDemographics,
  mapHeatmap,
  mapInsightsEntities,
  mapInsightsPlaces,
  mapSearch,
  mapTags,
  resolvedLocality,
} from "@/lib/qloo/mapping";
import { MockQlooTransport } from "@/lib/qloo/mock/transport";
import { QlooService } from "@/lib/qloo/service";
import type { DurableStore } from "@/lib/qloo/store";
import type { InsightsResponse, SearchResponse } from "@/lib/qloo/types";

// Shapes copied from live hackathon.api.qloo.com responses (Oct 6, 2026), trimmed to the fields we map.
const ARTIST_ID = "BAF6317A-DF94-4C90-92AE-63F86560C21B";

const searchRes = {
  results: [
    {
      name: "Khruangbin",
      entity_id: ARTIST_ID,
      types: ["urn:entity:artist"],
      popularity: 0.9919334977446856,
      properties: { short_description: "American trio", image: { url: "https://example.com/k.jpg" } },
      tags: [{ id: "urn:tag:genre:music:psychedelic", name: "Psychedelic", type: "urn:tag:genre:music" }],
    },
  ],
} as unknown as SearchResponse;

const insightsArtists = {
  success: true,
  results: {
    entities: [
      {
        name: "Glass Beams",
        entity_id: "24BA18BE-62EF-4B7E-99C6-7AA20EB05F28",
        type: "urn:entity",
        subtype: "urn:entity:artist",
        popularity: 0.9603182405022642,
        query: {
          affinity: 0.9615385496743382,
          explainability: { "signal.interests.entities": [{ entity_id: ARTIST_ID, score: 1 }, { bogus: true }] },
        },
      },
    ],
  },
} as unknown as InsightsResponse;

const insightsPlaces = {
  success: true,
  results: {
    entities: [
      {
        name: "Austin City Limits Live (ACL Live & 3TEN ACL Live)",
        entity_id: "6CA681F6-0000-0000-0000-000000000000",
        type: "urn:entity",
        subtype: "urn:entity:place",
        popularity: 0.9986001639611589,
        location: { lat: 30.265262699999997, lon: -97.7469912, geohash: "9v6kptwgcvye" },
        properties: {
          address: "310 W Willie Nelson Blvd Austin, TX 78701",
          geocode: { city: "Austin", name: "Downtown", metro: "Austin", country_code: "US" },
          website: "https://acllive.com/?utm_campaign=acl",
        },
        tags: [
          { id: "urn:tag:genre:place:event_venue", name: "Event venue", type: "urn:tag:genre:place" },
          { id: "urn:tag:category:place:event_venue", name: "Event venue", type: "urn:tag:category:place" },
          { id: "urn:tag:category:place:live_music_venue", name: "Live music venue", type: "urn:tag:category:place" },
        ],
        query: { affinity: 0.8649861584812752, explainability: { "signal.interests.entities": [{ entity_id: ARTIST_ID, score: 1 }] } },
      },
    ],
  },
  query: {
    localities: {
      filter: [{ entity_id: "C93C0541-F43D-484E-AC86-E27A54E5B1D0", name: "Austin", subtype: "urn:entity:locality", disambiguation: "Austin, Travis County, Texas, United States" }],
    },
  },
} as unknown as InsightsResponse;

const heatmapRes = {
  success: true,
  results: {
    heatmap: [
      { location: { latitude: 34.189453, longitude: -116.54297, geohash: "9qj4" }, query: { affinity: 0.9997979389775712, affinity_rank: 0.992032, popularity: 0.981208324914124, entity_artist_affinity: 0.99 } },
      { location: { latitude: 34.189453, longitude: -116.19141, geohash: "9qj6" }, query: { affinity: 1, affinity_rank: 0.992868, popularity: 0.9894928268337038 } },
      { location: { latitude: null, longitude: -97.8 }, query: { affinity: 1 } },
    ],
  },
} as unknown as InsightsResponse;

const demoRes = {
  success: true,
  results: {
    demographics: [
      {
        entity_id: ARTIST_ID,
        query: {
          age: { "55_and_older": -0.59, "24_and_younger": 0, "30_to_34": -0.78, "25_to_29": -0.05, "35_to_44": 0.29 },
          gender: { male: 0.16, female: -0.16 },
        },
      },
    ],
  },
} as unknown as InsightsResponse;

describe("Qloo response mapping", () => {
  it("maps /search results to entities", () => {
    const [e] = mapSearch(searchRes);
    expect(e).toMatchObject({ id: ARTIST_ID, name: "Khruangbin", type: "urn:entity:artist", popularity: 0.9919334977446856, affinity: null, imageUrl: "https://example.com/k.jpg" });
    expect(e.tags).toEqual([{ id: "urn:tag:genre:music:psychedelic", name: "Psychedelic", type: "urn:tag:genre:music" }]);
  });

  it("tolerates a malformed search body", () => {
    expect(mapSearch({} as SearchResponse)).toEqual([]);
  });

  it("maps insights entities with subtype, affinity and well-formed explainability only", () => {
    const [e] = mapInsightsEntities(insightsArtists);
    expect(e.type).toBe("urn:entity:artist");
    expect(e.affinity).toBeCloseTo(0.9615, 4);
    expect(e.explainedBy).toEqual([{ entityId: ARTIST_ID, score: 1 }]);
  });

  it("maps places with neighbourhood, room category and website, and reads the locality disambiguation", () => {
    const [p] = mapInsightsPlaces(insightsPlaces, ["urn:tag:category:place:live_music_venue"]);
    expect(p).toMatchObject({ city: "Austin", neighborhood: "Downtown", category: "Live music venue", lat: 30.265262699999997, lng: -97.7469912 });
    expect(p.website).toContain("acllive.com");
    expect(resolvedLocality(insightsPlaces)).toBe("Austin, Travis County, Texas, United States");
    expect(resolvedLocality({ success: true } as InsightsResponse)).toBeNull();
  });

  it("maps heatmap points, drops points without coordinates and sorts by affinity", () => {
    const cells = mapHeatmap(heatmapRes);
    expect(cells).toHaveLength(2);
    expect(cells[0]).toMatchObject({ geohash: "9qj6", affinity: 1 });
    expect(cells[1].geohash).toBe("9qj4");
  });

  it("orders demographic age bands youngest to oldest", () => {
    const d = mapDemographics(demoRes)!;
    expect(d.age.map((a) => a.band)).toEqual(["24_and_younger", "25_to_29", "30_to_34", "35_to_44", "55_and_older"]);
    expect(d.gender).toEqual({ male: 0.16, female: -0.16 });
    expect(mapDemographics({ success: true, results: {} } as InsightsResponse)).toBeNull();
  });

  it("maps live tag shapes (tag_id + subtype), cleans names and drops nameless ones", () => {
    const tags = mapTags([
      { tag_id: "urn:tag:genre:music:instrumental_hip_hop", name: "instrumental  hip hop", subtype: "urn:tag:genre:music", query: { affinity: 0.9926 } },
      { id: "urn:tag:genre:music:psychedelic_rock", name: " psychedelic rock", subtype: "urn:tag:genre:music" },
      { name: "no id" },
    ] as never);
    expect(tags).toEqual([
      { id: "urn:tag:genre:music:instrumental_hip_hop", name: "Instrumental hip hop", type: "urn:tag:genre:music", affinity: 0.9926 },
      { id: "urn:tag:genre:music:psychedelic_rock", name: "Psychedelic rock", type: "urn:tag:genre:music", affinity: null },
    ]);
    expect(cleanName("  lo-fi ")).toBe("Lo-fi");
  });

  it("dedupes regional brand variants and derives a category from brand-genre tags", () => {
    const brand = (id: string, name: string) => ({
      name,
      entity_id: id,
      subtype: "urn:entity:brand",
      tags: [
        { id: "urn:tag:genre:brand:casual", name: "Casual", type: "urn:tag:genre:brand" },
        { id: "urn:tag:genre:brand:fashion", name: "Fashion", type: "urn:tag:genre:brand" },
        { id: "urn:tag:lifestyle:qloo:outdoor", name: "Outdoor", type: "urn:tag:lifestyle:qloo" },
      ],
      query: { affinity: 0.94 },
    });
    const list = mapInsightsEntities({ success: true, results: { entities: [brand("E9A7", "Fjällräven"), brand("1BFF", "Fjällräven"), brand("DB4C", "Patagonia")] } } as unknown as InsightsResponse);
    const unique = dedupeByName(list);
    expect(unique.map((b) => b.id)).toEqual(["E9A7", "DB4C"]);
    expect(brandCategory(unique[0])).toBe("Casual · Fashion");
  });
});

describe("compaction for the cache", () => {
  it("packs heatmaps into tuples and restores the documented shape", () => {
    const packed = compactInsights(heatmapRes);
    expect(JSON.stringify(packed).length).toBeLessThan(JSON.stringify(heatmapRes).length);
    const back = expandInsights(JSON.parse(JSON.stringify(packed)));
    expect(back.results.heatmap?.[0]).toEqual({ location: { latitude: 34.18945, longitude: -116.54297, geohash: "9qj4" }, query: { affinity: 0.9998, affinity_rank: 0.992, popularity: 0.9812 } });
  });

  it("keeps the fields the mapping needs and drops verbose ones", () => {
    const verbose = structuredClone(insightsPlaces) as unknown as { results: { entities: { properties: Record<string, unknown> }[] } };
    verbose.results.entities[0].properties.akas = Array.from({ length: 30 }, (_, i) => ({ value: `alias ${i}` }));
    const slim = compactInsights(verbose as unknown as InsightsResponse);
    expect(JSON.stringify(slim)).not.toContain("alias 3");
    expect(mapInsightsPlaces(slim)[0]).toMatchObject({ neighborhood: "Downtown", category: "Event venue" });
    expect(resolvedLocality(slim)).toBe("Austin, Travis County, Texas, United States");
  });
});

class MemoryStore implements DurableStore {
  readonly kind = "disk" as const;
  map = new Map<string, unknown>();
  async get(k: string) {
    return this.map.get(k) ?? null;
  }
  async set(k: string, v: unknown) {
    this.map.set(k, JSON.parse(JSON.stringify(v)));
  }
}

describe("HttpQlooTransport", () => {
  const ok = (body: unknown, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json", ...headers } });
  const make = (fetchImpl: unknown, store: DurableStore | null = null, extra = {}) =>
    new HttpQlooTransport("test-key", { baseUrl: QLOO_BASE_URL, fetchImpl: fetchImpl as typeof fetch, store, minIntervalMs: 0, ...extra });

  it("skips empty params when building the query string", () => {
    expect(buildQuery({ a: "x y", b: undefined, c: "", d: 0, e: true })).toBe("a=x+y&d=0&e=true");
  });

  it("sends GET to the hackathon base URL with the X-Api-Key header and caches by URL", async () => {
    const fetchImpl = vi.fn(async () => ok(searchRes));
    const t = make(fetchImpl);
    await t.search({ query: "Khruangbin", types: "urn:entity:artist", take: 3 });
    await t.search({ query: "Khruangbin", types: "urn:entity:artist", take: 3 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://hackathon.api.qloo.com/search?query=Khruangbin&types=urn%3Aentity%3Aartist&take=3");
    expect((init.headers as Record<string, string>)["X-Api-Key"]).toBe("test-key");
    expect(init.method ?? "GET").toBe("GET");
  });

  it("shares one request between concurrent identical calls", async () => {
    const fetchImpl = vi.fn(async () => ok(searchRes));
    const t = make(fetchImpl);
    await Promise.all([t.search({ query: "x" }), t.search({ query: "x" }), t.search({ query: "x" })]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("serves a second instance from the durable store, and the service marks it cached", async () => {
    const store = new MemoryStore();
    const first = vi.fn(async () => ok(heatmapRes));
    const live = await new QlooService(make(first, store)).territoryHeat("A", "india");
    expect(live.calls[0].cached).toBeUndefined();
    expect(first).toHaveBeenCalledTimes(1);
    const second = vi.fn(async () => ok(heatmapRes));
    const svc = new QlooService(make(second, store));
    const r = await svc.territoryHeat("A", "india");
    expect(second).not.toHaveBeenCalled();
    expect(r.data).toHaveLength(2);
    expect(r.calls[0].cached).toBe(true);
  });

  it("routes insights, tags and audiences to their v2 paths", async () => {
    const fetchImpl = vi.fn(async () => ok({ success: true, results: {} }));
    const t = make(fetchImpl);
    await t.insights({ "filter.type": "urn:entity:artist" });
    await t.tags({ "filter.query": "venue" });
    await t.audiences({ "filter.parents.types": "urn:audience:hobbies_and_interests" });
    const paths = fetchImpl.mock.calls.map((c) => new URL((c as unknown as [string])[0]).pathname);
    expect(paths).toEqual(["/v2/insights", "/v2/tags", "/v2/audiences"]);
  });

  it("does not retry 4xx errors and surfaces status + path", async () => {
    const fetchImpl = vi.fn(async () => new Response("bad param", { status: 400 }));
    await expect(make(fetchImpl).insights({ "filter.type": "urn:entity:artist" })).rejects.toMatchObject({ status: 400, path: "/v2/insights" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retries a 429 after the per-second reset, then succeeds", async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce(new Response("slow down", { status: 429, headers: { "x-second-ratelimit-reset": "0.4" } }))
        .mockResolvedValueOnce(ok(searchRes));
      const p = make(fetchImpl).search({ query: "x" });
      await vi.advanceTimersByTimeAsync(1000);
      await expect(p).resolves.toEqual(searchRes);
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it("tracks the monthly quota and stops spending it below the floor", async () => {
    const fetchImpl = vi.fn(async () => ok(searchRes, { "x-month-ratelimit-remaining": "120", "x-month-ratelimit-limit": "10000" }));
    const t = make(fetchImpl, null, { minRemaining: 300 });
    await t.search({ query: "a" });
    expect(t.quota).toMatchObject({ remaining: 120, limit: 10000 });
    await expect(t.search({ query: "b" })).rejects.toMatchObject({ status: 429 });
    await expect(t.search({ query: "a" })).resolves.toBeTruthy();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});

describe("Mock transport + service", () => {
  const svc = new QlooService(new MockQlooTransport([0, 0]));

  it("reports mock mode on every provenance record", async () => {
    const r = await svc.searchArtist("Khruangbin");
    expect(r.data[0].name).toBe("Khruangbin");
    expect(r.calls.every((c) => c.mode === "mock" && c.path === "/search")).toBe(true);
  });

  const mockArtistId = async () => (await svc.searchArtist("Khruangbin")).data[0].id;

  it("returns nothing for entity ids it never issued", async () => {
    const res = await new MockQlooTransport([0, 0]).insights({ "filter.type": "urn:entity:brand", "signal.interests.entities": ARTIST_ID });
    expect(res.results?.entities).toEqual([]);
  });

  it("answers territory heatmaps with one cell per catalogue city", async () => {
    const id = await mockArtistId();
    const r = await svc.scoreCities(id, [
      { id: "atx", name: "Austin", query: "Austin, Texas", country: "US", region: "north-america", lat: 30.2672, lng: -97.7431, tier: 1 },
    ]);
    expect(r.calls).toHaveLength(1);
    expect(r.data[0].affinity).toBeGreaterThan(0.8);
    expect(r.data[0].area).toBe("North America");
  });

  it("is deterministic for the same input", async () => {
    const id = await mockArtistId();
    const a = await new MockQlooTransport([0, 0]).insights({ "filter.type": "urn:entity:brand", "signal.interests.entities": id });
    const b = await new MockQlooTransport([0, 0]).insights({ "filter.type": "urn:entity:brand", "signal.interests.entities": id });
    expect(mapInsightsEntities(a).length).toBeGreaterThan(0);
    expect(mapInsightsEntities(a).map((e) => [e.id, e.affinity])).toEqual(mapInsightsEntities(b).map((e) => [e.id, e.affinity]));
  });
});
