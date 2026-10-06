import { describe, expect, it } from "vitest";
import { CITIES, CITY_BY_ID, geohash, HEAT_AREAS } from "@/lib/cities";
import { EvidenceLedger } from "@/lib/agent/ledger";
import { deterministicDraft, gatherEvidence, pickCities } from "@/lib/agent/deterministic";
import type { AgentEvent } from "@/lib/agent/events";
import type { CityAffinity, HeatCell, Place, TasteEntity } from "@/lib/qloo/domain";
import { MockQlooTransport } from "@/lib/qloo/mock/transport";
import { QlooService, readCity } from "@/lib/qloo/service";
import { DEMOGRAPHIC_CLAIM, demographicNote, hydratePlan, scopedHeadline } from "@/lib/plan/hydrate";
import { planToMarkdown } from "@/lib/plan/markdown";
import { classifyOpportunity, headroom, metroPeakNote, orderRoute, pctIndex, routeDistanceKm, stopScore, topShare } from "@/lib/plan/routing";
import { PlanDraftSchema, PlanRequestSchema, TourPlanSchema, type PlanDraft } from "@/lib/plan/schema";

const entity = (id: string, name: string, extra: Partial<TasteEntity> = {}): TasteEntity => ({
  id,
  name,
  type: "urn:entity:artist",
  popularity: 0.95,
  affinity: 0.96,
  description: null,
  imageUrl: null,
  tags: [],
  explainedBy: [],
  ...extra,
});

const venue = (id: string, name: string): Place => ({
  ...entity(id, name, { type: "urn:entity:place" }),
  address: "1 Main St",
  city: null,
  neighborhood: "Downtown",
  category: "Live music venue",
  primaryCategory: "Live music venue",
  website: null,
  lat: 30.27,
  lng: -97.74,
  businessRating: 4.5,
});

const score = (cityId: string, affinity: number, popularity: number): CityAffinity => ({
  cityId,
  affinity,
  popularity,
  peakAffinity: affinity,
  peakKm: 0,
  cell: "9v6k",
  area: "North America",
  resolvedLocality: null,
  method: "heatmap-geohash",
});

function ledgerFixture() {
  const l = new EvidenceLedger();
  l.artist = entity("A1", "Khruangbin", { popularity: 0.992 });
  // Live Khruangbin readings (North America heatmap, Oct 6, 2026).
  const scores: [string, number, number][] = [
    ["atx", 0.997, 0.999],
    ["btv", 0.992, 0.976],
    ["nyc", 0.986, 1.0],
    ["chi", 0.983, 0.999],
    ["atl", 0.892, 0.986],
  ];
  for (const [cityId, affinity, popularity] of scores) l.cityScores.set(cityId, score(cityId, affinity, popularity));
  l.venues.set("atx", [venue("V1", "Mohawk Austin"), venue("V2", "Swan Dive")]);
  l.localities.set("atx", "Austin, Travis County, Texas, United States");
  l.heat.set("atx", [{ lat: 30.3, lng: -97.7, geohash: "9v6kpyn", name: null, affinity: 1.2, affinityRank: 1, popularity: 0.2 }]);
  l.territoryCells = [{ lat: 30.27, lng: -97.74, geohash: "9v6k", name: null, affinity: 0.997, affinityRank: 0.98, popularity: 0.999 }];
  l.similar.set("S1", entity("S1", "Glass Beams"));
  l.brands.set("B1", entity("B1", "Patagonia", { type: "urn:entity:brand", description: "Casual · Fashion" }));
  return l;
}

const request = PlanRequestSchema.parse({ artist: "Khruangbin", stops: 4 });

describe("city catalogue", () => {
  it("has unique ids and a heat area for every region", () => {
    expect(new Set(CITIES.map((c) => c.id)).size).toBe(CITIES.length);
    for (const c of CITIES) expect(HEAT_AREAS[c.region]).toBeDefined();
    expect(CITIES.length).toBeGreaterThan(150);
  });

  it("encodes geohashes like Qloo's heatmap cells", () => {
    expect(geohash(30.26802, -97.736435, 7)).toBe("9v6kpyn");
    expect(geohash(34.189453, -116.19141, 4)).toBe("9qj6");
  });
});

describe("readCity", () => {
  const cell = (lat: number, lng: number, affinity: number, popularity = 0.99): HeatCell => ({ lat, lng, geohash: geohash(lat, lng, 4), name: null, affinity, affinityRank: affinity, popularity });
  const atl = CITY_BY_ID.get("atl")!;

  it("reads the cell the city centre falls in and notes a stronger suburban cell", () => {
    const own = cell(atl.lat + 0.01, atl.lng + 0.01, 0.499, 0.991);
    const suburb = cell(atl.lat + 0.17, atl.lng - 0.02, 0.803, 0.99);
    const r = readCity(atl, [suburb, own, cell(10, 10, 1)], "North America");
    expect(r).toMatchObject({ affinity: 0.499, popularity: 0.991, peakAffinity: 0.803, area: "North America" });
    expect(r.peakKm).toBeGreaterThan(15);
    expect(metroPeakNote(r.affinity!, r.peakAffinity, r.peakKm)).toMatch(/km from the centre/);
  });

  it("falls back to the nearest cell within 30 km, else no data", () => {
    const near = cell(atl.lat + 0.2, atl.lng, 0.9);
    expect(readCity(atl, [near], "North America").affinity).toBe(0.9);
    expect(readCity(atl, [cell(atl.lat + 1, atl.lng, 0.9)], "North America").affinity).toBeNull();
    expect(readCity(atl, [], "North America").affinity).toBeNull();
  });
});

describe("PlanRequestSchema", () => {
  it("applies defaults", () => {
    expect(PlanRequestSchema.parse({ artist: " Khruangbin " })).toEqual({ artist: "Khruangbin", region: "north-america", stops: 7, venueSize: "auto" });
  });

  it.each([[{ artist: "" }], [{ artist: "x", stops: 2 }], [{ artist: "x", stops: 13 }], [{ artist: "x", region: "mars" }], [{ artist: "x", notes: "n".repeat(501) }]])(
    "rejects %j",
    (input) => {
      expect(PlanRequestSchema.safeParse(input).success).toBe(false);
    },
  );
});

describe("PlanDraftSchema", () => {
  const good: PlanDraft = {
    headline: "Desert Heat Run",
    summary: "Austin leads on fan affinity.",
    stops: [{ cityId: "atx", reason: "fans in the top 0.3%", venueIds: ["V1"] }],
    coHeadliners: [],
    brandPartners: [],
    audienceNotes: [],
  };

  it("accepts a minimal draft", () => {
    expect(PlanDraftSchema.parse(good)).toEqual(good);
  });

  it("caps venue picks, co-headliners and headline length", () => {
    expect(PlanDraftSchema.safeParse({ ...good, headline: "x".repeat(141) }).success).toBe(false);
    expect(PlanDraftSchema.safeParse({ ...good, stops: [{ ...good.stops[0], venueIds: ["a", "b", "c", "d"] }] }).success).toBe(false);
    const co = Array.from({ length: 5 }, (_, i) => ({ id: `S${i}`, role: "support" as const, why: "" }));
    expect(PlanDraftSchema.safeParse({ ...good, coHeadliners: co }).success).toBe(false);
    expect(PlanDraftSchema.safeParse({ ...good, stops: [] }).success).toBe(false);
  });
});

describe("routing + scoring (calibrated on live heatmaps)", () => {
  it("reads percentiles on a log scale of how far into the top they sit", () => {
    expect(pctIndex(0.999)).toBeCloseTo(0.98, 2);
    expect(pctIndex(0.99)).toBeCloseTo(0.85, 2);
    expect(pctIndex(0.97)).toBeCloseTo(0.7, 2);
    expect(pctIndex(0.5)).toBeCloseTo(0.15, 2);
    expect(topShare(0.992)).toBe("top 0.8%");
    expect(topShare(0.97)).toBe("top 3%");
    expect(topShare(1)).toBe("top 0.1%");
  });

  it("classifies live readings the way a booking agent would", () => {
    expect(classifyOpportunity(0.992, 0.976)).toBe("hidden-gem"); // Burlington, VT for Khruangbin
    expect(classifyOpportunity(0.997, 0.999)).toBe("stronghold"); // Austin
    expect(classifyOpportunity(0.986, 1.0)).toBe("emerging"); // New York: big but not over-indexing
    expect(classifyOpportunity(0.892, 0.986)).toBe("long-shot"); // Atlanta
    expect(classifyOpportunity(0.8, null)).toBe("long-shot");
    expect(headroom(0.992, 0.976)).toBe(0.14);
  });

  it("scores within 0..100 and rewards fans who outpace the market", () => {
    expect(stopScore(1, 0)).toBeLessThanOrEqual(100);
    expect(stopScore(0, 1)).toBeGreaterThanOrEqual(0);
    expect(stopScore(0.992, 0.976)).toBeGreaterThan(stopScore(0.992, 0.999));
    expect(stopScore(0.997, 0.999)).toBeGreaterThan(stopScore(0.986, 1.0));
  });

  it("orders a route without zig-zagging and respects the start city", () => {
    const pts = [
      { id: "la", lat: 34.05, lng: -118.24 },
      { id: "nyc", lat: 40.71, lng: -74.0 },
      { id: "den", lat: 39.74, lng: -104.99 },
      { id: "chi", lat: 41.88, lng: -87.63 },
    ];
    const r = orderRoute(pts, "la");
    expect(r.map((p) => p.id)).toEqual(["la", "den", "chi", "nyc"]);
    expect(routeDistanceKm(r)).toBeLessThan(routeDistanceKm([pts[0], pts[1], pts[2], pts[3]]));
  });

  it("does not pick two cities in the same metro while others are available", () => {
    const l = new EvidenceLedger();
    l.cityScores.set("ams", { ...score("ams", 0.999, 0.999), area: "Europe" });
    l.cityScores.set("utr", { ...score("utr", 0.998, 0.99), area: "Europe" });
    l.cityScores.set("ber", { ...score("ber", 0.99, 0.999), area: "Europe" });
    expect(pickCities(l, 2)).toEqual(expect.arrayContaining(["ber"]));
    expect(pickCities(l, 3)).toHaveLength(3);
  });
});

describe("hydratePlan", () => {
  it("drops invented cities, venues, artists and brands, and fills from the Qloo ranking", () => {
    const ledger = ledgerFixture();
    const draft: PlanDraft = {
      headline: "Test Run",
      summary: "s",
      stops: [
        { cityId: "atx", reason: "top affinity", venueIds: ["V2", "FAKE-VENUE"] },
        { cityId: "atlantis", reason: "invented", venueIds: [] },
        { cityId: "atx", reason: "dupe", venueIds: [] },
      ],
      coHeadliners: [
        { id: "S1", role: "co-headliner", why: "close match" },
        { id: "GHOST", role: "support", why: "hallucinated" },
      ],
      brandPartners: [{ id: "B1", pitch: "p" }, { id: "NOPE", pitch: "p" }],
      audienceNotes: ["aggregate only"],
    };
    const { plan, dropped } = hydratePlan(draft, ledger, request, { qloo: "live", agent: "test" });

    expect(dropped).toEqual(expect.arrayContaining([expect.stringContaining("atlantis"), expect.stringContaining("FAKE-VENUE"), expect.stringContaining("GHOST"), expect.stringContaining("NOPE")]));
    expect(plan.stops).toHaveLength(4);
    expect(new Set(plan.stops.map((s) => s.cityId))).toEqual(new Set(["atx", "btv", "nyc", "chi"]));
    const atx = plan.stops.find((s) => s.cityId === "atx")!;
    expect(atx.venues.map((v) => v.id)).toEqual(["V2"]);
    expect(atx.venues[0]).toMatchObject({ category: "Live music venue", neighborhood: "Downtown" });
    expect(atx.fanAffinity).toBe(0.997);
    expect(atx.area).toBe("North America");
    expect(atx.qlooLocality).toBe("Austin, Travis County, Texas, United States");
    expect(atx.hotspots[0].affinity).toBe(1);
    expect(plan.stops.find((s) => s.cityId === "btv")!.opportunity).toBe("hidden-gem");
    expect(plan.heat).toEqual([[30.27, -97.74, 0.997]]);
    expect(plan.coHeadliners.map((c) => c.id)).toEqual(["S1"]);
    expect(plan.brandPartners).toEqual([{ id: "B1", name: "Patagonia", category: "Casual · Fashion", affinity: 0.96, pitch: "p" }]);
    expect(plan.stops.map((s) => s.order)).toEqual([1, 2, 3, 4]);
    expect(plan.stops[0].legKm).toBe(0);
    expect(plan.totals.distanceKm).toBeGreaterThan(0);
    expect(TourPlanSchema.safeParse(plan).success).toBe(true);
  });

  it("labels mock plans in caveats and markdown, and live plans not at all", () => {
    const ledger = ledgerFixture();
    const draft = deterministicDraft(ledger, pickCities(ledger, 3));
    const { plan } = hydratePlan(draft, ledger, request, { qloo: "mock", agent: "deterministic" });
    expect(plan.caveats[0]).toMatch(/^MOCK DATA/);
    expect(planToMarkdown(plan)).toMatch(/MOCK DATA/);
    const live = hydratePlan(draft, ledger, request, { qloo: "live", agent: "deterministic" }).plan;
    expect(live.caveats.some((c) => c.startsWith("MOCK"))).toBe(false);
    expect(planToMarkdown(live)).not.toMatch(/MOCK/);
  });

  it("writes deterministic reasons from the stop's own numbers", () => {
    const ledger = ledgerFixture();
    const draft = deterministicDraft(ledger, ["btv"]);
    expect(draft.stops[0].reason).toMatch(/^Hidden gem in Burlington\. Fans rank in the top 0\.8% of North America \(affinity 0\.992\) against 0\.976 local popularity, headroom \+0\.14/);
  });

  it("writes the demographic fact itself and drops LLM notes that make demographic claims", () => {
    const ledger = ledgerFixture();
    ledger.demographics = {
      age: [
        { band: "24_and_younger", affinity: 0 },
        { band: "25_to_29", affinity: -0.05 },
        { band: "30_to_34", affinity: -0.78 },
        { band: "35_to_44", affinity: 0.29 },
      ],
      gender: { male: 0.16, female: -0.16 },
    };
    expect(demographicNote(ledger.demographics)).toBe("Qloo demographics: strongest age affinity 35-44 (+0.29), weakest 30-34 (-0.78); the audience leans male (+0.16).");
    const draft = { ...deterministicDraft(ledger, ["atx"]), audienceNotes: ["Instrumental grooves resonate with the 24‑to‑29 age band", "Dreamlike, sultry type for the poster", "Teen Focused zine energy"] };
    const { plan, dropped } = hydratePlan(draft, ledger, request, { qloo: "live", agent: "t" });
    expect(plan.audience.notes).toEqual([demographicNote(ledger.demographics), "Dreamlike, sultry type for the poster", "Teen Focused zine energy"]);
    expect(dropped.some((d) => d.includes("demographic claim"))).toBe(true);
    expect(DEMOGRAPHIC_CLAIM.test("Fans aged 25-29")).toBe(true);
    expect(DEMOGRAPHIC_CLAIM.test("Sound: lo-fi, beats")).toBe(false);
  });

  it("keeps headlines to the requested territory", () => {
    expect(scopedHeadline("Khruangbin Global Groove Tour", "north-america")).toBe("Khruangbin North America Groove Tour");
    expect(scopedHeadline("Peggy Gou World Tour", "world")).toBe("Peggy Gou World Tour");
    expect(scopedHeadline("Desert Heat Run", "north-america")).toBe("Desert Heat Run");
  });

  it("keeps headlines to the requested territory", () => {
    expect(scopedHeadline("Khruangbin Global Groove Tour", "north-america")).toBe("Khruangbin North America Groove Tour");
    expect(scopedHeadline("Peggy Gou World Tour", "world")).toBe("Peggy Gou World Tour");
    expect(scopedHeadline("Desert Heat Run", "north-america")).toBe("Desert Heat Run");
  });

  it("refuses to build a plan without a resolved artist", () => {
    const ledger = ledgerFixture();
    ledger.artist = null;
    expect(() => hydratePlan(deterministicDraft(ledgerFixture(), ["atx"]), ledger, request, { qloo: "mock", agent: "x" })).toThrow();
  });
});

describe("deterministic pipeline on the mock transport", () => {
  it("produces a schema-valid plan whose every reference came from Qloo (mock) calls", async () => {
    const svc = new QlooService(new MockQlooTransport([0, 0]));
    const ledger = new EvidenceLedger();
    const events: AgentEvent[] = [];
    const req = PlanRequestSchema.parse({ artist: "Japanese Breakfast", region: "europe", stops: 6 });
    await gatherEvidence({ svc, ledger, request: req, emit: (e) => events.push(e) });
    const { plan, dropped } = hydratePlan(deterministicDraft(ledger, pickCities(ledger, req.stops)), ledger, req, { qloo: "mock", agent: "deterministic" });
    expect(dropped).toEqual([]);
    expect(plan.artist.name).toBe("Japanese Breakfast");
    expect(plan.stops).toHaveLength(6);
    expect(plan.totals.qlooCalls).toBe(ledger.calls.length);
    expect(ledger.calls.every((c) => c.mode === "mock")).toBe(true);
    for (const s of plan.stops) {
      expect(ledger.cityScores.has(s.cityId)).toBe(true);
      for (const v of s.venues) expect(ledger.venues.get(s.cityId)?.some((x) => x.id === v.id)).toBe(true);
    }
    expect(events.some((e) => e.type === "preview" && (e.heat?.length ?? 0) > 0)).toBe(true);
  });
});
