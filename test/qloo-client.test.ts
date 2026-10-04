import { describe, expect, it, vi } from "vitest";
import { buildQuery, HttpQlooTransport, QLOO_BASE_URL } from "@/lib/qloo/http";
import {
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
import type { InsightsResponse, SearchResponse } from "@/lib/qloo/types";

// Raw shapes copied from the structure of Qloo's documented responses (values invented).
const ARTIST_ID = "4BBEF799-A0C4-4110-AB01-39216993C312";

const searchRes = {
  results: [
    {
      name: "Khruangbin",
      entity_id: ARTIST_ID,
      types: ["urn:entity:artist"],
      popularity: 0.93,
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
        name: "Hermanos Gutiérrez",
        entity_id: "B1",
        type: "urn:entity",
        subtype: "urn:entity:artist",
        popularity: 0.81,
        query: {
          affinity: 0.97,
          explainability: { "signal.interests.entities": [{ entity_id: ARTIST_ID, score: 0.9 }, { bogus: true }] },
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
        name: "Mohawk",
        entity_id: "P1",
        subtype: "urn:entity:place",
        popularity: 0.71,
        location: { lat: 30.2697, lon: -97.7362, geohash: "9v6kpm" },
        properties: { address: "912 Red River St, Austin, TX", geocode: { name: "Austin" }, business_rating: 4.6 },
        query: { affinity: 0.88 },
      },
    ],
  },
  query: { locality: { filter: { name: "Austin", entity_id: "L1" } } },
} as unknown as InsightsResponse;

const heatmapRes = {
  success: true,
  results: {
    heatmap: [
      { location: { latitude: 30.2, longitude: -97.7, geohash: "9v6k" }, query: { affinity: 0.4, affinity_rank: 0.5, popularity: 0.9 } },
      { location: { latitude: 30.3, longitude: -97.8, geohash: "9v6m" }, query: { affinity: 0.95, affinity_rank: 0.9, popularity: 0.2 } },
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
          age: { "55_and_older": -0.4, "24_and_younger": 0.2, "30_to_34": 0.31, "25_to_29": 0.35 },
          gender: { male: 0.05, female: -0.05 },
        },
      },
    ],
  },
} as unknown as InsightsResponse;

describe("Qloo response mapping", () => {
  it("maps /search results to entities", () => {
    const [e] = mapSearch(searchRes);
    expect(e).toMatchObject({
      id: ARTIST_ID,
      name: "Khruangbin",
      type: "urn:entity:artist",
      popularity: 0.93,
      affinity: null,
      description: "American trio",
      imageUrl: "https://example.com/k.jpg",
    });
    expect(e.tags).toEqual([{ id: "urn:tag:genre:music:psychedelic", name: "Psychedelic" }]);
  });

  it("tolerates a malformed search body", () => {
    expect(mapSearch({} as SearchResponse)).toEqual([]);
  });

  it("maps insights entities with subtype, affinity and well-formed explainability only", () => {
    const [e] = mapInsightsEntities(insightsArtists);
    expect(e.type).toBe("urn:entity:artist");
    expect(e.affinity).toBe(0.97);
    expect(e.explainedBy).toEqual([{ entityId: ARTIST_ID, score: 0.9 }]);
  });

  it("maps places with lat/lon, address and rating, and reads the resolved locality", () => {
    const [p] = mapInsightsPlaces(insightsPlaces);
    expect(p).toMatchObject({ name: "Mohawk", lat: 30.2697, lng: -97.7362, city: "Austin", businessRating: 4.6, affinity: 0.88 });
    expect(resolvedLocality(insightsPlaces)).toBe("Austin");
    expect(resolvedLocality({ success: true } as InsightsResponse)).toBeNull();
  });

  it("maps heatmap points, drops points without coordinates and sorts by affinity", () => {
    const cells = mapHeatmap(heatmapRes);
    expect(cells).toHaveLength(2);
    expect(cells[0]).toMatchObject({ lat: 30.3, lng: -97.8, geohash: "9v6m", affinity: 0.95, popularity: 0.2 });
    expect(cells[1].affinity).toBe(0.4);
  });

  it("orders demographic age bands youngest to oldest", () => {
    const d = mapDemographics(demoRes)!;
    expect(d.age.map((a) => a.band)).toEqual(["24_and_younger", "25_to_29", "30_to_34", "55_and_older"]);
    expect(d.gender).toEqual({ male: 0.05, female: -0.05 });
    expect(mapDemographics({ success: true, results: {} } as InsightsResponse)).toBeNull();
  });

  it("maps tags from either id or tag_id and drops nameless ones", () => {
    const tags = mapTags([
      { id: "urn:tag:a", name: "A", subtype: "urn:tag:genre" },
      { tag_id: "urn:tag:b", name: "B", query: { affinity: 0.5 } },
      { name: "no id" },
    ] as never);
    expect(tags).toEqual([
      { id: "urn:tag:a", name: "A", type: "urn:tag:genre", affinity: null },
      { id: "urn:tag:b", name: "B", type: null, affinity: 0.5 },
    ]);
  });
});

describe("HttpQlooTransport", () => {
  const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

  it("skips empty params when building the query string", () => {
    expect(buildQuery({ a: "x y", b: undefined, c: "", d: 0, e: true })).toBe("a=x+y&d=0&e=true");
  });

  it("sends GET to the hackathon base URL with the X-Api-Key header and caches by URL", async () => {
    const fetchImpl = vi.fn(async () => ok(searchRes));
    const t = new HttpQlooTransport("test-key", QLOO_BASE_URL, fetchImpl as unknown as typeof fetch);
    await t.search({ query: "Khruangbin", types: "urn:entity:artist", take: 3 });
    await t.search({ query: "Khruangbin", types: "urn:entity:artist", take: 3 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://hackathon.api.qloo.com/search?query=Khruangbin&types=urn%3Aentity%3Aartist&take=3");
    expect((init.headers as Record<string, string>)["X-Api-Key"]).toBe("test-key");
    expect(init.method ?? "GET").toBe("GET");
  });

  it("routes insights, tags and audiences to their v2 paths", async () => {
    const fetchImpl = vi.fn(async () => ok({ success: true, results: {} }));
    const t = new HttpQlooTransport("k", QLOO_BASE_URL, fetchImpl as unknown as typeof fetch);
    await t.insights({ "filter.type": "urn:entity:artist" });
    await t.tags({ "filter.query": "venue" });
    await t.audiences({});
    const paths = fetchImpl.mock.calls.map((c) => new URL((c as unknown as [string])[0]).pathname);
    expect(paths).toEqual(["/v2/insights", "/v2/tags", "/v2/audiences"]);
  });

  it("does not retry 4xx errors and surfaces status + path", async () => {
    const fetchImpl = vi.fn(async () => new Response("bad param", { status: 400 }));
    const t = new HttpQlooTransport("k", QLOO_BASE_URL, fetchImpl as unknown as typeof fetch);
    await expect(t.insights({ "filter.type": "urn:entity:artist" })).rejects.toMatchObject({ status: 400, path: "/v2/insights" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("retries 429 then succeeds", async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi
        .fn()
        .mockResolvedValueOnce(new Response("slow down", { status: 429 }))
        .mockResolvedValueOnce(ok(searchRes));
      const t = new HttpQlooTransport("k", QLOO_BASE_URL, fetchImpl as unknown as typeof fetch);
      const p = t.search({ query: "x" });
      await vi.advanceTimersByTimeAsync(1000);
      await expect(p).resolves.toEqual(searchRes);
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("Mock transport + service", () => {
  const svc = new QlooService(new MockQlooTransport());

  it("reports mock mode on every provenance record", async () => {
    const r = await svc.searchArtist("Khruangbin");
    expect(r.data[0].name).toBe("Khruangbin");
    expect(r.calls.every((c) => c.mode === "mock" && c.path === "/search")).toBe(true);
  });

  const mockArtistId = async () => (await svc.searchArtist("Khruangbin")).data[0].id;

  it("returns nothing for entity ids it never issued", async () => {
    const res = await new MockQlooTransport().insights({ "filter.type": "urn:entity:brand", "signal.interests.entities": ARTIST_ID });
    expect(res.results?.entities).toEqual([]);
  });

  it("returns documented response shapes for insights", async () => {
    const t = new MockQlooTransport();
    const id = await mockArtistId();
    const heat = await t.insights({ "filter.type": "urn:heatmap", "signal.interests.entities": id, "filter.location.query": "Austin" });
    expect(heat.success).toBe(true);
    expect(Array.isArray(heat.results?.heatmap)).toBe(true);
    const p = heat.results!.heatmap![0];
    expect(typeof p.location.latitude).toBe("number");
    expect(typeof p.query.affinity).toBe("number");
  });

  it("is deterministic for the same input", async () => {
    const id = await mockArtistId();
    const a = await new MockQlooTransport().insights({ "filter.type": "urn:entity:brand", "signal.interests.entities": id });
    const b = await new MockQlooTransport().insights({ "filter.type": "urn:entity:brand", "signal.interests.entities": id });
    expect(mapInsightsEntities(a).length).toBeGreaterThan(0);
    expect(mapInsightsEntities(a).map((e) => [e.id, e.affinity])).toEqual(mapInsightsEntities(b).map((e) => [e.id, e.affinity]));
  });
});
