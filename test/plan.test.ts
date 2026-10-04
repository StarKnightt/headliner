import { describe, expect, it } from "vitest";
import { EvidenceLedger } from "@/lib/agent/ledger";
import { deterministicDraft, gatherEvidence, pickCities } from "@/lib/agent/deterministic";
import type { AgentEvent } from "@/lib/agent/events";
import type { Place, TasteEntity } from "@/lib/qloo/domain";
import { MockQlooTransport } from "@/lib/qloo/mock/transport";
import { QlooService } from "@/lib/qloo/service";
import { hydratePlan } from "@/lib/plan/hydrate";
import { planToMarkdown } from "@/lib/plan/markdown";
import { classifyOpportunity, orderRoute, routeDistanceKm, stopScore } from "@/lib/plan/routing";
import { PlanDraftSchema, PlanRequestSchema, TourPlanSchema, type PlanDraft } from "@/lib/plan/schema";

const entity = (id: string, name: string, extra: Partial<TasteEntity> = {}): TasteEntity => ({
  id,
  name,
  type: "urn:entity:artist",
  popularity: 0.5,
  affinity: 0.8,
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
  lat: 30.27,
  lng: -97.74,
  businessRating: 4.5,
});

function ledgerFixture() {
  const l = new EvidenceLedger();
  l.artist = entity("A1", "Khruangbin", { popularity: 0.9 });
  const scores: [string, number, number][] = [
    ["atx", 0.91, 0.4],
    ["nyc", 0.84, 0.95],
    ["chi", 0.7, 0.7],
    ["nash", 0.55, 0.3],
    ["la", 0.32, 0.9],
  ];
  for (const [cityId, affinity, popularity] of scores) {
    l.cityScores.set(cityId, { cityId, affinity, popularity, resolvedLocality: cityId.toUpperCase(), method: "heatmap-locality" });
  }
  l.venues.set("atx", [venue("V1", "Mohawk"), venue("V2", "Stubb's")]);
  l.heat.set("atx", [{ lat: 30.3, lng: -97.7, geohash: "9v6k", name: null, affinity: 1.2, affinityRank: 1, popularity: 0.2 }]);
  l.similar.set("S1", entity("S1", "Hermanos Gutiérrez"));
  l.brands.set("B1", entity("B1", "Patagonia", { type: "urn:entity:brand", description: "Outdoor apparel" }));
  return l;
}

const request = PlanRequestSchema.parse({ artist: "Khruangbin", stops: 4 });

describe("PlanRequestSchema", () => {
  it("applies defaults", () => {
    expect(PlanRequestSchema.parse({ artist: " Khruangbin " })).toEqual({
      artist: "Khruangbin",
      region: "north-america",
      stops: 7,
      venueSize: "auto",
    });
  });

  it.each([
    [{ artist: "" }],
    [{ artist: "x", stops: 2 }],
    [{ artist: "x", stops: 13 }],
    [{ artist: "x", region: "mars" }],
    [{ artist: "x", notes: "n".repeat(501) }],
  ])("rejects %j", (input) => {
    expect(PlanRequestSchema.safeParse(input).success).toBe(false);
  });
});

describe("PlanDraftSchema", () => {
  const good: PlanDraft = {
    headline: "Desert Heat Run",
    summary: "Austin leads on fan affinity.",
    stops: [{ cityId: "atx", reason: "91% affinity", venueIds: ["V1"] }],
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

describe("routing + scoring", () => {
  it("classifies opportunities from affinity vs popularity", () => {
    expect(classifyOpportunity(0.9, 0.3)).toBe("hidden-gem");
    expect(classifyOpportunity(0.9, 0.9)).toBe("stronghold");
    expect(classifyOpportunity(0.55, 0.5)).toBe("emerging");
    expect(classifyOpportunity(0.3, null)).toBe("long-shot");
  });

  it("scores within 0..100 and rewards under-served markets", () => {
    expect(stopScore(1, 0)).toBeLessThanOrEqual(100);
    expect(stopScore(0, 1)).toBeGreaterThanOrEqual(0);
    expect(stopScore(0.8, 0.3)).toBeGreaterThan(stopScore(0.8, 0.9));
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
});

describe("hydratePlan", () => {
  it("drops invented cities, venues, artists and brands, and fills from Qloo ranking", () => {
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
    const { plan, dropped } = hydratePlan(draft, ledger, request, { qloo: "mock", agent: "test" });

    expect(dropped).toEqual(expect.arrayContaining([
      expect.stringContaining("atlantis"),
      expect.stringContaining("FAKE-VENUE"),
      expect.stringContaining("GHOST"),
      expect.stringContaining("NOPE"),
    ]));
    expect(plan.stops).toHaveLength(4);
    expect(new Set(plan.stops.map((s) => s.cityId))).toEqual(new Set(["atx", "nyc", "chi", "nash"]));
    const atx = plan.stops.find((s) => s.cityId === "atx")!;
    expect(atx.venues.map((v) => v.id)).toEqual(["V2"]);
    expect(atx.fanAffinity).toBe(0.91);
    expect(atx.hotspots[0].affinity).toBe(1);
    expect(plan.coHeadliners.map((c) => c.id)).toEqual(["S1"]);
    expect(plan.brandPartners).toEqual([{ id: "B1", name: "Patagonia", category: "Outdoor apparel", affinity: 0.8, pitch: "p" }]);
    expect(plan.stops.map((s) => s.order)).toEqual([1, 2, 3, 4]);
    expect(plan.stops[0].legKm).toBe(0);
    expect(plan.totals.distanceKm).toBeGreaterThan(0);
    expect(TourPlanSchema.safeParse(plan).success).toBe(true);
  });

  it("labels mock plans in caveats and markdown", () => {
    const ledger = ledgerFixture();
    const draft = deterministicDraft(ledger, pickCities(ledger, 3));
    const { plan } = hydratePlan(draft, ledger, request, { qloo: "mock", agent: "deterministic" });
    expect(plan.caveats[0]).toMatch(/^MOCK DATA/);
    expect(planToMarkdown(plan)).toMatch(/MOCK DATA/);
    const live = hydratePlan(draft, ledger, request, { qloo: "live", agent: "deterministic" }).plan;
    expect(live.caveats.some((c) => c.startsWith("MOCK"))).toBe(false);
  });

  it("refuses to build a plan without a resolved artist", () => {
    const ledger = ledgerFixture();
    ledger.artist = null;
    expect(() => hydratePlan(deterministicDraft(ledgerFixture(), ["atx"]), ledger, request, { qloo: "mock", agent: "x" })).toThrow();
  });
});

describe("deterministic pipeline on the mock transport", () => {
  it("produces a schema-valid plan whose every reference came from Qloo (mock) calls", async () => {
    const svc = new QlooService(new MockQlooTransport());
    const ledger = new EvidenceLedger();
    const events: AgentEvent[] = [];
    const req = PlanRequestSchema.parse({ artist: "Japanese Breakfast", region: "europe", stops: 6 });
    await gatherEvidence({ svc, ledger, request: req, emit: (e) => events.push(e) });
    const { plan, dropped } = hydratePlan(deterministicDraft(ledger, pickCities(ledger, req.stops)), ledger, req, {
      qloo: "mock",
      agent: "deterministic",
    });
    expect(dropped).toEqual([]);
    expect(plan.artist.name).toBe("Japanese Breakfast");
    expect(plan.stops).toHaveLength(6);
    expect(plan.totals.qlooCalls).toBe(ledger.calls.length);
    expect(ledger.calls.every((c) => c.mode === "mock")).toBe(true);
    for (const s of plan.stops) {
      expect(ledger.cityScores.has(s.cityId)).toBe(true);
      for (const v of s.venues) expect(ledger.venues.get(s.cityId)?.some((x) => x.id === v.id)).toBe(true);
    }
    expect(events.some((e) => e.type === "step")).toBe(true);
  });
});
