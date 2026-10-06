import { describe, expect, it } from "vitest";
import { EvidenceLedger } from "@/lib/agent/ledger";
import { AliasBook, claimProblems } from "@/lib/agent/orchestrator";
import { billBand } from "@/lib/agent/tools";
import type { CityAffinity } from "@/lib/qloo/domain";
import { orderRoute } from "@/lib/plan/routing";

const score = (cityId: string, affinity: number, popularity: number, extra: Partial<CityAffinity> = {}): CityAffinity => ({
  cityId,
  affinity,
  popularity,
  peakAffinity: affinity,
  peakKm: 0,
  cell: null,
  area: "North America",
  resolvedLocality: null,
  method: "heatmap-geohash",
  ...extra,
});

function ledger() {
  const l = new EvidenceLedger();
  // Live Khruangbin numbers from the North America heatmap (Oct 6, 2026).
  l.cityScores.set("btv", score("btv", 0.992, 0.976));
  l.cityScores.set("nyc", score("nyc", 0.986, 1.0));
  l.cityScores.set("atl", score("atl", 0.892, 0.986, { peakAffinity: 0.928, peakKm: 18 }));
  l.venues.set("btv", [
    { id: "V-UUID-1", name: "Higher Ground", type: "urn:entity:place", popularity: 0.951, affinity: 0.842, description: null, imageUrl: null, tags: [], explainedBy: [], address: null, city: null, neighborhood: null, category: "Live music venue", primaryCategory: "Live music venue", website: null, lat: null, lng: null, businessRating: null },
  ]);
  return l;
}

describe("AliasBook", () => {
  it("issues stable short aliases and resolves drafts back to Qloo ids", () => {
    const a = new AliasBook();
    expect(a.alias("v", "V-UUID-1")).toBe("v1");
    expect(a.alias("v", "V-UUID-1")).toBe("v1");
    expect(a.alias("a", "A-UUID")).toBe("a1");
    const d = a.resolveDraft({
      headline: "h",
      summary: "s",
      stops: [{ cityId: " BTV ", reason: "r", venueIds: ["v1", "v9"] }],
      closeCityId: "BTV",
      coHeadliners: [{ id: "a1", role: "support", why: "w" }],
      brandPartners: [],
      audienceNotes: [],
    });
    expect(d.stops[0]).toMatchObject({ cityId: "btv", venueIds: ["V-UUID-1", "v9"] });
    expect(d.closeCityId).toBe("btv");
    expect(d.coHeadliners[0].id).toBe("A-UUID");
  });
});

describe("claimProblems", () => {
  const a = new AliasBook();
  a.alias("v", "V-UUID-1");
  const ctx = { ledger: ledger() };
  const stop = (cityId: string, reason: string, venueIds: string[] = []) => ({ cityId, reason, venueIds });

  it("accepts reasons that cite the stop's own share, affinity, popularity, headroom and chosen venue", () => {
    expect(
      claimProblems(stop("btv", "A hidden gem: fans rank in the top 0.8% of North America (affinity 0.992) against 0.976 local popularity, headroom +0.14. Higher Ground 0.842.", ["v1"]), ctx, a),
    ).toEqual([]);
    expect(claimProblems(stop("btv", "Fans at the 99.2nd percentile, well ahead of the market (97.6%)."), ctx, a)).toEqual([]);
  });

  it("accepts a metro-peak citation and ignores distances", () => {
    expect(claimProblems(stop("atl", "Fans peak 18 km from the centre (top 7%, 0.928), not downtown (0.892)."), ctx, a)).toEqual([]);
  });

  it("flags numbers that belong to another city", () => {
    expect(claimProblems(stop("btv", "Fans in the top 1.4% (affinity 0.986) against 1.000 popularity."), ctx, a)[0]).toMatch(/cites 1.4%, 0.986/);
  });

  it("flags a read label that contradicts the evidence", () => {
    expect(claimProblems(stop("nyc", "A hidden-gem market at 0.986 affinity."), ctx, a)[0]).toMatch(/calls it hidden-gem but its read is emerging/);
    expect(claimProblems(stop("nyc", "Not a hidden gem; fans at 0.986 in a saturated market."), ctx, a)).toEqual([]);
  });
});

describe("billBand", () => {
  it("is multiplicative on the distance from the top of the popularity scale", () => {
    expect(billBand("peer", 0.992)).toEqual([0.976, 0.9973]);
    expect(billBand("smaller", 0.992)).toEqual([undefined, 0.976]);
    expect(billBand("bigger", 0.992)).toEqual([0.9973, undefined]);
    expect(billBand("peer", 0.86)[0]).toBeCloseTo(0.58, 2);
  });
});

describe("orderRoute closing city", () => {
  const pts = [
    { id: "lon", lat: 51.5, lng: -0.13 },
    { id: "dub", lat: 53.35, lng: -6.26 },
    { id: "man", lat: 53.48, lng: -2.24 },
    { id: "bri", lat: 51.45, lng: -2.59 },
    { id: "gla", lat: 55.86, lng: -4.25 },
  ];
  it("pins the start and the end", () => {
    const r = orderRoute(pts, "lon", "dub").map((p) => p.id);
    expect(r[0]).toBe("lon");
    expect(r.at(-1)).toBe("dub");
    expect(new Set(r).size).toBe(5);
  });
  it("ignores an end equal to the start", () => {
    expect(orderRoute(pts, "lon", "lon")[0].id).toBe("lon");
  });
});
