import { CITY_BY_ID, haversineKm, REGIONS } from "../cities";
import type { EvidenceLedger } from "../agent/ledger";
import { classifyOpportunity, metroPeakNote, orderRoute, routeDistanceKm, shortestRoute, stopScore } from "./routing";
import { TourPlanSchema, type PlanDraft, type PlanRequest, type Stop, type TourPlan } from "./schema";

export interface HydrateResult {
  plan: TourPlan;
  /** Things the draft referenced that Qloo never returned; dropped and surfaced in the timeline. */
  dropped: string[];
}

const BASE_CAVEATS = [
  "Scores are Qloo aggregate taste affinities for audiences in each place, not ticket-sales forecasts or facts about individuals.",
  "Fan affinity and local popularity are percentiles of Qloo heatmap cells (about 40 km across) within each territory. The opportunity labels and the score are Headliner's interpretation of those two numbers.",
  "Qloo has no venue capacities: room size is a place-category filter. Check availability, capacity, routing days and visas before booking.",
];

const MOCK_CAVEAT =
  "MOCK DATA: this plan was generated without a Qloo API key. Every score, venue match and relationship is fixture data for UI development, not Qloo output.";

const r2 = (x: number) => Math.round(x * 100) / 100;

const AGE_LABEL: Record<string, string> = {
  "24_and_younger": "24 and under",
  "25_to_29": "25-29",
  "30_to_34": "30-34",
  "35_to_44": "35-44",
  "45_to_54": "45-54",
  "55_and_older": "55+",
};

/** Notes that make age or gender claims. Those facts come from Qloo demographics, written by the server. */
export const DEMOGRAPHIC_CLAIM =
  /\b(age[ds]?|age[\s-]bands?|year[\s-]olds?|gen[\s-]?z|millennials?|boomers?|demographics?)\b|\b(leans?|leaning|skews?|skewing|mostly|majority)\s+(male|female|men|women)\b|\b(male|female)[\s-](leaning|skewed|dominated|heavy)\b|\b\d{2}\s?(?:-|–|‑|to)\s?\d{2}\b|\b(?:under|over)\s?\d{2}\b|\b\d{2}\s?(?:and|&)\s?(?:under|younger|older|up)\b/i;

/** Headline words that claim more ground than a single-territory run covers. */
export const WIDE_GEOGRAPHY = /\b(global|world(?:wide)?|international|planet|earth)\b/i;

/** "Khruangbin Global Groove Tour" on a North America run becomes "Khruangbin North America Groove Tour". */
export function scopedHeadline(headline: string, region: PlanRequest["region"]) {
  if (region === "world" || !WIDE_GEOGRAPHY.test(headline)) return headline;
  const label = REGIONS.find((r) => r.id === region)?.label ?? "";
  return headline.replace(new RegExp(WIDE_GEOGRAPHY.source, "gi"), label).replace(/\s+/g, " ").trim();
}

const signed2 = (x: number) => `${x >= 0 ? "+" : "-"}${Math.abs(x).toFixed(2)}`;

/** One factual line from Qloo's urn:demographics affinities (−1..1, aggregate). */
export function demographicNote(d: EvidenceLedger["demographics"]): string | null {
  if (!d?.age.length) return null;
  const sorted = d.age.slice().sort((a, b) => b.affinity - a.affinity);
  const top = sorted[0];
  const low = sorted.at(-1)!;
  const g = d.gender;
  const lean =
    g.male !== null && g.female !== null && Math.abs(g.male - g.female) > 0.1
      ? `; the audience leans ${g.male > g.female ? `male (${signed2(g.male)})` : `female (${signed2(g.female)})`}`
      : g.male !== null && g.female !== null
        ? "; the audience is gender-balanced"
        : "";
  return `Qloo demographics: strongest age affinity ${AGE_LABEL[top.band] ?? top.band} (${signed2(top.affinity)}), weakest ${AGE_LABEL[low.band] ?? low.band} (${signed2(low.affinity)})${lean}.`;
}

/** Merge an LLM (or deterministic) draft with ledger evidence into a validated TourPlan. */
export function hydratePlan(draft: PlanDraft, ledger: EvidenceLedger, request: PlanRequest, mode: TourPlan["mode"]): HydrateResult {
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
    draftStops.push({ cityId: c.cityId, reason: "Added from the Qloo ranking to reach the requested stop count.", venueIds: [] });
  }
  const chosen = draftStops.slice(0, request.stops);

  const points = chosen.map((s) => ({ ...s, id: s.cityId, lat: CITY_BY_ID.get(s.cityId)!.lat, lng: CITY_BY_ID.get(s.cityId)!.lng }));
  const startId = request.startCityId && seen.has(request.startCityId) ? request.startCityId : undefined;
  const closeRaw = draft.closeCityId?.trim().toLowerCase();
  const closeId = closeRaw && closeRaw !== startId && seen.has(closeRaw) ? closeRaw : undefined;
  const routed = startId ? orderRoute(points, startId, closeId) : shortestRoute(points, closeId);

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
      neighborhood: v.neighborhood,
      category: v.category,
      kind: v.primaryCategory && v.primaryCategory !== v.category ? v.primaryCategory : null,
      website: v.website,
      lat: v.lat,
      lng: v.lng,
      affinity: v.affinity,
      popularity: v.popularity,
      why: note || `Qloo place affinity ${v.affinity === null ? "n/a" : v.affinity.toFixed(3)} for this artist's audience${v.category ? ` · ${v.category.toLowerCase()}` : ""}.`,
    }));
    const prev = routed[i - 1];
    const peak = metroPeakNote(affinity, score.peakAffinity, score.peakKm) ? { affinity: score.peakAffinity!, km: score.peakKm! } : null;
    return {
      order: i + 1,
      cityId: city.id,
      city: city.name,
      country: city.country,
      lat: city.lat,
      lng: city.lng,
      fanAffinity: affinity,
      marketPopularity: score.popularity,
      area: score.area,
      peak,
      opportunity: classifyOpportunity(affinity, score.popularity),
      score: stopScore(affinity, score.popularity),
      reason: s.reason,
      venues,
      hotspots: (ledger.heat.get(s.cityId) ?? []).slice(0, 45).map((h) => ({ lat: h.lat, lng: h.lng, affinity: clamp01(h.affinity) })),
      legKm: prev ? Math.round(haversineKm(prev, s)) : 0,
      qlooLocality: ledger.localities.get(s.cityId) ?? (score.cell ? `${score.area} heatmap cell ${score.cell}` : null),
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

  const notes = draft.audienceNotes.filter((n) => {
    if (!DEMOGRAPHIC_CLAIM.test(n)) return true;
    dropped.push(`audience note with a demographic claim ("${n.slice(0, 60)}")`);
    return false;
  });
  const fact = demographicNote(ledger.demographics);

  const plan: TourPlan = {
    version: 2,
    generatedAt: new Date().toISOString(),
    mode,
    request,
    artist: {
      id: ledger.artist.id,
      name: ledger.artist.name,
      popularity: ledger.artist.popularity,
      description: ledger.artist.description,
    },
    headline: scopedHeadline(draft.headline, request.region),
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
      tasteTags: ledger.tasteTags.slice(0, 30).map((t) => ({ name: t.name, group: t.type, affinity: t.affinity === null ? null : clamp01(t.affinity) })),
      notes: [...(fact ? [fact] : []), ...notes].slice(0, 6),
    },
    heat: ledger.territoryCells.slice(0, 900).map((c) => [r2(c.lat), r2(c.lng), Math.round(clamp01(c.affinity) * 1000) / 1000] as [number, number, number]),
    totals: {
      stops: stops.length,
      distanceKm: routeDistanceKm(routed),
      qlooCalls: ledger.calls.length,
      cachedCalls: ledger.calls.filter((c) => c.cached).length,
      candidates: ledger.rankedCities().length,
    },
    caveats: [...(mode.qloo === "mock" ? [MOCK_CAVEAT] : []), ...BASE_CAVEATS, ...(draft.caveats ?? [])],
  };

  return { plan: TourPlanSchema.parse(plan), dropped };
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const clampSigned = (x: number) => Math.max(-1, Math.min(1, x));
export const pct = (x: number | null | undefined) => (x === null || x === undefined ? "n/a" : `${Math.round(x * 100)}%`);
