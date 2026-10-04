import { describe, expect, it } from "vitest";
import { EvidenceLedger } from "@/lib/agent/ledger";
import { AliasBook, claimProblems } from "@/lib/agent/orchestrator";
import { orderRoute } from "@/lib/plan/routing";

function ledger() {
  const l = new EvidenceLedger();
  l.cityScores.set("atx", { cityId: "atx", affinity: 0.91, popularity: 0.4, resolvedLocality: "Austin", method: "heatmap-locality" });
  l.cityScores.set("nyc", { cityId: "nyc", affinity: 0.8, popularity: 0.58, resolvedLocality: "New York", method: "heatmap-locality" });
  l.venues.set("atx", [
    { id: "V-UUID-1", name: "Mohawk", type: "urn:entity:place", popularity: 0.71, affinity: 0.88, description: null, imageUrl: null, tags: [], explainedBy: [], address: null, city: null, lat: null, lng: null, businessRating: null },
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
      stops: [{ cityId: " ATX ", reason: "r", venueIds: ["v1", "v9"] }],
      closeCityId: "ATX",
      coHeadliners: [{ id: "a1", role: "support", why: "w" }],
      brandPartners: [],
      audienceNotes: [],
    });
    expect(d.stops[0]).toMatchObject({ cityId: "atx", venueIds: ["V-UUID-1", "v9"] });
    expect(d.closeCityId).toBe("atx");
    expect(d.coHeadliners[0].id).toBe("A-UUID");
  });
});

describe("claimProblems", () => {
  const a = new AliasBook();
  a.alias("v", "V-UUID-1");
  const ctx = { ledger: ledger() };
  const stop = (cityId: string, reason: string, venueIds: string[] = []) => ({ cityId, reason, venueIds });

  it("accepts reasons that cite the stop's own numbers, headroom and chosen venue", () => {
    expect(claimProblems(stop("atx", "Fan affinity 0.91 vs 0.40 local popularity (+0.51), a hidden gem; Mohawk 88%.", ["v1"]), ctx, a)).toEqual([]);
  });

  it("flags numbers that belong to another city", () => {
    expect(claimProblems(stop("atx", "Fan affinity 0.80 vs 0.58."), ctx, a)[0]).toMatch(/cites 0.8, 0.58/);
  });

  it("flags a read label that contradicts the evidence", () => {
    expect(claimProblems(stop("nyc", "A hidden-gem market at 0.80 affinity."), ctx, a)[0]).toMatch(/calls it hidden-gem but its read is stronghold/);
    expect(claimProblems(stop("nyc", "Not a hidden gem; a stronghold at 80%."), ctx, a)).toEqual([]);
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
