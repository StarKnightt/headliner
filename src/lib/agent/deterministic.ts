import { CITY_BY_ID, haversineKm } from "../cities";
import { ROOMS } from "../qloo/service";
import { classifyOpportunity, headroom, metroPeakNote, OPPORTUNITY_LABEL, topShare } from "../plan/routing";
import type { PlanDraft } from "../plan/schema";
import type { EvidenceLedger } from "./ledger";
import { executeTool } from "./runner";
import { billBand, TOOL_BY_NAME, type ToolContext } from "./tools";

export const AGE_LABEL: Record<string, string> = {
  "24_and_younger": "24 and under",
  "25_to_29": "25-29",
  "30_to_34": "30-34",
  "35_to_44": "35-44",
  "45_to_54": "45-54",
  "55_and_older": "55+",
};

export const f3 = (x: number | null | undefined) => (x === null || x === undefined ? "n/a" : x.toFixed(3));
const signed = (x: number) => `${x >= 0 ? "+" : ""}${x.toFixed(2)}`;

async function call(name: string, args: unknown, ctx: ToolContext) {
  return executeTool(TOOL_BY_NAME.get(name)!, args, ctx);
}

/** Runs the full tool chain in a fixed order. Used when no LLM is configured, or as a fallback. */
export async function gatherEvidence(ctx: ToolContext, opts: { skipSearch?: boolean } = {}) {
  const { ledger, request } = ctx;
  if (!opts.skipSearch || !ledger.artist) {
    await call("search_artist", { name: request.artist }, ctx);
    if (!ledger.artist) throw new Error(`Qloo found no artist matching “${request.artist}”.`);
  }
  if (!ledger.venueTagIds.length) {
    ledger.venueTagIds = [...ROOMS[request.venueSize].tags];
    await call("find_venue_tags", { query: ROOMS[request.venueSize].query }, ctx);
  }
  if (!ledger.cityScores.size) await call("score_cities", {}, ctx);
  const top = pickCities(ledger, request.stops, request.startCityId);
  const needHeat = top.filter((id) => !ledger.heat.has(id));
  const needVenues = top.filter((id) => !ledger.venues.has(id));
  await Promise.all([
    needHeat.length ? call("city_heatmap", { cityIds: needHeat }, ctx) : null,
    needVenues.length ? call("find_venues", { cityIds: needVenues }, ctx) : null,
    ledger.similar.size ? null : call("similar_artists", { band: "peer" }, ctx).then(() => call("similar_artists", { band: "smaller" }, ctx)),
    ledger.brands.size ? null : call("brand_affinities", {}, ctx),
    ledger.demographics ? null : call("audience_profile", {}, ctx),
  ]);
  return top;
}

/** Best-scoring cities, skipping ones within 60 km of a city already picked (one show per metro). */
export function pickCities(ledger: EvidenceLedger, n: number, startCityId?: string): string[] {
  const ranked = ledger.rankedCities().map((c) => c.cityId);
  const out: string[] = startCityId && ranked.includes(startCityId) ? [startCityId] : [];
  const skipped: string[] = [];
  for (const id of ranked) {
    if (out.length >= n) break;
    if (out.includes(id)) continue;
    const c = CITY_BY_ID.get(id)!;
    if (out.some((o) => haversineKm(CITY_BY_ID.get(o)!, c) < 60)) skipped.push(id);
    else out.push(id);
  }
  for (const id of skipped) if (out.length < n) out.push(id);
  return out;
}

/** Template-written draft. Every sentence is derived from ledger numbers. */
export function deterministicDraft(ledger: EvidenceLedger, cityIds: string[]): PlanDraft {
  const artist = ledger.artist!;
  const stops = cityIds.map((id) => {
    const s = ledger.cityScores.get(id)!;
    const a = s.affinity!;
    const read = classifyOpportunity(a, s.popularity);
    const city = CITY_BY_ID.get(id)!;
    const fans = `Fans rank in the ${topShare(a)} of ${s.area} (affinity ${f3(a)})`;
    const byRead: Record<string, string> = {
      "hidden-gem": `${fans} against ${f3(s.popularity)} local popularity, headroom ${signed(headroom(a, s.popularity))}: the audience is ahead of the market.`,
      stronghold: `${fans}, local popularity ${f3(s.popularity)}: a proven market to anchor the run.`,
      emerging: `${fans}: a growth market for a smaller room.`,
      "long-shot": `${fans}: kept for routing; keep the room small.`,
    };
    const peak = metroPeakNote(a, s.peakAffinity, s.peakKm);
    const venues = (ledger.venues.get(id) ?? []).slice(0, 2);
    return {
      cityId: id,
      reason: `${OPPORTUNITY_LABEL[read]} in ${city.name}. ${byRead[read]}${peak ? ` In the metro, ${peak}.` : ""}`,
      venueIds: venues.map((v) => v.id),
      venueNotes: venues.map(
        (v) => `Qloo place affinity ${f3(v.affinity)} for ${artist.name} fans${v.category ? ` · ${v.category.toLowerCase()}` : ""}${v.neighborhood ? ` in ${v.neighborhood}` : ""}.`,
      ),
    };
  });

  const similar = [...ledger.similar.values()].sort((x, y) => (y.affinity ?? 0) - (x.affinity ?? 0));
  const [peerMin] = billBand("peer", artist.popularity);
  const peers = similar.filter((e) => (e.popularity ?? 0) >= (peerMin ?? 0)).slice(0, 1);
  const support = similar.filter((e) => (e.popularity ?? 0) < (peerMin ?? 0) && !peers.includes(e)).slice(0, 2);
  const pop = (p: number | null) => (p === null ? "popularity n/a" : p >= 0.5 ? `${topShare(p)} of artists` : `popularity ${p.toFixed(2)}`);
  const coHeadliners = [
    ...peers.map((e) => ({
      id: e.id,
      role: "co-headliner" as const,
      why: `Shared-audience affinity ${f3(e.affinity)} at a similar popularity (${pop(e.popularity)}): splits the draw without splitting the crowd.`,
    })),
    ...support.map((e) => ({
      id: e.id,
      role: "support" as const,
      why: `Shared-audience affinity ${f3(e.affinity)}; a smaller act (${pop(e.popularity)}) whose fans already lean your way.`,
    })),
  ];

  const brandPartners = [...ledger.brands.values()]
    .slice(0, 3)
    .map((b) => ({ id: b.id, pitch: `${artist.name} fans over-index on ${b.name} (affinity ${f3(b.affinity)}). Pitch a co-branded tour item${b.description ? ` (${b.description.toLowerCase()})` : ""}.` }));

  const byType = (t: string, n = 3) => ledger.tasteTags.filter((x) => x.type === t).slice(0, n).map((x) => x.name);
  const music = [...byType("urn:tag:genre:music"), ...byType("urn:tag:music:qloo", 2)].slice(0, 4);
  const style = byType("urn:tag:style:qloo");
  const crossover = [...byType("urn:tag:genre:media", 2), ...byType("urn:tag:audience:qloo", 2)];
  // The age and gender fact is added by hydratePlan for every planner.
  const audienceNotes = [
    music.length ? `Sound to brief the poster around: ${music.join(", ")}.` : null,
    style.length ? `Style words Qloo ties to these fans: ${style.join(", ")}.` : null,
    crossover.length ? `Beyond music they over-index on: ${crossover.join(", ")} (Qloo taste tags, aggregate).` : null,
  ].filter((x): x is string => !!x);

  const top = stops[0] ? CITY_BY_ID.get(stops[0].cityId)!.name : "";
  const gems = cityIds.filter((id) => {
    const s = ledger.cityScores.get(id)!;
    return classifyOpportunity(s.affinity!, s.popularity) === "hidden-gem";
  });
  const gemNames = gems.map((id) => CITY_BY_ID.get(id)!.name);
  return {
    headline: `${artist.name}: ${stops.length} Nights Where the Fans Are`,
    summary: `${stops.length} stops picked from ${ledger.rankedCities().length} candidate cities on one Qloo heatmap of the territory, ranked by how far into the top the fans sit, then routed to minimise travel. ${
      gems.length ? `${gemNames.join(", ")} ${gems.length > 1 ? "are hidden gems" : "is a hidden gem"}: fans outrank the local market. ` : ""
    }Strongest stop: ${top}.`,
    stops,
    coHeadliners,
    brandPartners,
    audienceNotes,
  };
}
