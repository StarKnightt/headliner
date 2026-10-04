import { CITY_BY_ID, haversineKm } from "../cities";
import type { EvidenceLedger } from "../agent/ledger";
import { classifyOpportunity, orderRoute, routeDistanceKm, stopScore } from "./routing";
import { TourPlanSchema, type PlanDraft, type PlanRequest, type Stop, type TourPlan } from "./schema";

export interface HydrateResult {
  plan: TourPlan;
  /** Things the draft referenced that Qloo never returned; dropped and surfaced in the timeline. */
  dropped: string[];
}

const BASE_CAVEATS = [
  "Scores are Qloo aggregate taste affinities for audiences in each place, not ticket-sales forecasts or facts about individuals.",
  "Fan affinity compares interest in this artist to other entities locally; popularity is a percentile of signal density. Opportunity labels are Headliner's interpretation of those two numbers.",
  "Check venue availability, capacity, routing days and visas with the venues and your agent before booking.",
];

const MOCK_CAVEAT =
  "MOCK DATA: this plan was generated without a Qloo API key. Every score, venue match and relationship is fixture data for UI development, not Qloo output.";

/** Merge an LLM (or deterministic) draft with ledger evidence into a validated TourPlan. */
export function hydratePlan(
  draft: PlanDraft,
  ledger: EvidenceLedger,
  request: PlanRequest,
  mode: TourPlan["mode"],
): HydrateResult {
  const dropped: string[] = [];
  if (!ledger.artist) throw new Error("No artist resolved; cannot build a plan.");

  const seen = new Set<string>();
  const draftStops = draft.stops.filter((s) => {
    const score = ledger.cityScores.get(s.cityId);
    if (!CITY_BY_ID.has(s.cityId) || !score || score.affinity === null) {
      dropped.push(`city "${s.cityId}" (no Qloo affinity evidence)`);
      return false;
    }
    if (seen.has(s.cityId)) return false;
    seen.add(s.cityId);
    return true;
  });

  // Fill up from the ranked evidence if the draft came back short.
  for (const c of ledger.rankedCities()) {
    if (draftStops.length >= request.stops) break;
    if (seen.has(c.cityId)) continue;
    seen.add(c.cityId);
    draftStops.push({ cityId: c.cityId, reason: "Added from Qloo ranking to reach the requested stop count.", venueIds: [] });
  }
  const chosen = draftStops.slice(0, request.stops);

  const points = chosen.map((s) => ({ ...s, id: s.cityId, lat: CITY_BY_ID.get(s.cityId)!.lat, lng: CITY_BY_ID.get(s.cityId)!.lng }));
  const startId = request.startCityId && seen.has(request.startCityId) ? request.startCityId : points[0]?.id;
  const routed = orderRoute(points, startId);

  const stops: Stop[] = routed.map((s, i) => {
    const city = CITY_BY_ID.get(s.cityId)!;
    const score = ledger.cityScores.get(s.cityId)!;
    const affinity = score.affinity ?? 0;
    const venuesHere = ledger.venues.get(s.cityId) ?? [];
    const picked = s.venueIds
      .map((id, idx) => {
        const v = venuesHere.find((x) => x.id === id);
        if (!v) dropped.push(`venue "${id}" in ${city.name}`);
        return v ? { v, note: s.venueNotes?.[idx] } : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
    const venues = (picked.length ? picked : venuesHere.slice(0, 2).map((v) => ({ v, note: undefined }))).map(({ v, note }) => ({
      id: v.id,
      name: v.name,
      address: v.address,
      lat: v.lat,
      lng: v.lng,
      affinity: v.affinity,
      popularity: v.popularity,
      why: note || `Qloo place affinity ${pct(v.affinity)} for this artist's audience${v.popularity !== null ? `, popularity ${pct(v.popularity)}` : ""}.`,
    }));
    const prev = routed[i - 1];
    return {
      order: i + 1,
      cityId: city.id,
      city: city.name,
      country: city.country,
      lat: city.lat,
      lng: city.lng,
      fanAffinity: affinity,
      marketPopularity: score.popularity,
      opportunity: classifyOpportunity(affinity, score.popularity),
      score: stopScore(affinity, score.popularity),
      reason: s.reason,
      venues,
      hotspots: (ledger.heat.get(s.cityId) ?? []).slice(0, 40).map((h) => ({ lat: h.lat, lng: h.lng, affinity: clamp01(h.affinity) })),
      legKm: prev ? Math.round(haversineKm(prev, s)) : 0,
      qlooLocality: score.resolvedLocality,
    };
  });

  const coHeadliners = draft.coHeadliners.flatMap((c) => {
    const e = ledger.similar.get(c.id);
    if (!e) {
      dropped.push(`artist "${c.id}"`);
      return [];
    }
    return [{ id: e.id, name: e.name, role: c.role, affinity: e.affinity, popularity: e.popularity, why: c.why }];
  });

  const brandPartners = draft.brandPartners.flatMap((b) => {
    const e = ledger.brands.get(b.id);
    if (!e) {
      dropped.push(`brand "${b.id}"`);
      return [];
    }
    return [{ id: e.id, name: e.name, category: e.description, affinity: e.affinity, pitch: b.pitch }];
  });

  const plan: TourPlan = {
    version: 1,
    generatedAt: new Date().toISOString(),
    mode,
    request,
    artist: {
      id: ledger.artist.id,
      name: ledger.artist.name,
      popularity: ledger.artist.popularity,
      description: ledger.artist.description,
    },
    headline: draft.headline,
    summary: draft.summary,
    stops,
    coHeadliners,
    brandPartners,
    audience: {
      age: ledger.demographics?.age.map((a) => ({ band: a.band, affinity: clampSigned(a.affinity) })) ?? [],
      gender: {
        male: ledger.demographics?.gender.male ?? null,
        female: ledger.demographics?.gender.female ?? null,
      },
      tasteTags: ledger.tasteTags.slice(0, 12).map((t) => ({ name: t.name, affinity: t.affinity === null ? null : clamp01(t.affinity) })),
      notes: draft.audienceNotes,
    },
    totals: { stops: stops.length, distanceKm: routeDistanceKm(routed), qlooCalls: ledger.calls.length },
    caveats: [...(mode.qloo === "mock" ? [MOCK_CAVEAT] : []), ...BASE_CAVEATS, ...(draft.caveats ?? [])],
  };

  return { plan: TourPlanSchema.parse(plan), dropped };
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const clampSigned = (x: number) => Math.max(-1, Math.min(1, x));
export const pct = (x: number | null | undefined) => (x === null || x === undefined ? "n/a" : `${Math.round(x * 100)}%`);
