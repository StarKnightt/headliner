import { CITY_BY_ID } from "../cities";
import { pct } from "../plan/hydrate";
import { classifyOpportunity, OPPORTUNITY_LABEL, stopScore } from "../plan/routing";
import type { PlanDraft } from "../plan/schema";
import type { EvidenceLedger } from "./ledger";
import { executeTool } from "./runner";
import { TOOL_BY_NAME, type ToolContext } from "./tools";

const AGE_LABEL: Record<string, string> = {
  "24_and_younger": "24 and under",
  "25_to_29": "25–29",
  "30_to_34": "30–34",
  "35_to_44": "35–44",
  "45_to_54": "45–54",
  "55_and_older": "55+",
};

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
  if (!ledger.venueTagIds.length) await call("find_venue_tags", { query: "music venue" }, ctx);
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

export function pickCities(ledger: EvidenceLedger, n: number, startCityId?: string): string[] {
  const ranked = ledger
    .rankedCities()
    .map((c) => ({ id: c.cityId, s: stopScore(c.affinity!, c.popularity) }))
    .sort((a, b) => b.s - a.s)
    .map((c) => c.id);
  const out = startCityId && ranked.includes(startCityId) ? [startCityId] : [];
  for (const id of ranked) {
    if (out.length >= n) break;
    if (!out.includes(id)) out.push(id);
  }
  return out;
}

/** Template-written draft. Every sentence is derived from ledger numbers. */
export function deterministicDraft(ledger: EvidenceLedger, cityIds: string[]): PlanDraft {
  const artist = ledger.artist!;
  const stops = cityIds.map((id) => {
    const s = ledger.cityScores.get(id)!;
    const read = classifyOpportunity(s.affinity!, s.popularity);
    const city = CITY_BY_ID.get(id)!;
    const heat = ledger.heat.get(id) ?? [];
    const hotCells = heat.filter((h) => h.affinity >= 0.7).length;
    const reasonByRead: Record<string, string> = {
      "hidden-gem": `Fan affinity ${pct(s.affinity)} against only ${pct(s.popularity)} local popularity: the audience is here but the market isn't crowded.`,
      stronghold: `Fan affinity ${pct(s.affinity)} with ${pct(s.popularity)} local popularity: a proven market to anchor the run.`,
      emerging: `Fan affinity ${pct(s.affinity)} (${pct(s.popularity)} popularity): a growth market worth a smaller room.`,
      "long-shot": `Fan affinity ${pct(s.affinity)}: included for routing; keep the room small.`,
    };
    const venues = (ledger.venues.get(id) ?? []).slice(0, 2);
    return {
      cityId: id,
      reason: `${OPPORTUNITY_LABEL[read]} in ${city.name}. ${reasonByRead[read]}${hotCells ? ` ${hotCells} neighbourhood ${hotCells === 1 ? "cell" : "cells"} above 70% affinity.` : ""}`,
      venueIds: venues.map((v) => v.id),
      venueNotes: venues.map(
        (v) => `Qloo place affinity ${pct(v.affinity)} for ${artist.name} fans; popularity ${pct(v.popularity)} suits the requested room size.`,
      ),
    };
  });

  const similar = [...ledger.similar.values()].sort((a, b) => (b.affinity ?? 0) - (a.affinity ?? 0));
  const p = artist.popularity ?? 0.7;
  const peers = similar.filter((e) => (e.popularity ?? 0) >= p - 0.1).slice(0, 1);
  const support = similar.filter((e) => (e.popularity ?? 0) < p - 0.03 && !peers.includes(e)).slice(0, 2);
  const coHeadliners = [
    ...peers.map((e) => ({ id: e.id, role: "co-headliner" as const, why: `Shared-audience affinity ${pct(e.affinity)} at a similar popularity (${pct(e.popularity)}); splits draw without splitting the crowd.` })),
    ...support.map((e) => ({ id: e.id, role: "support" as const, why: `Shared-audience affinity ${pct(e.affinity)}; smaller act (${pct(e.popularity)} popularity) whose fans already lean your way.` })),
  ];

  const brandPartners = [...ledger.brands.values()]
    .slice(0, 3)
    .map((b) => ({ id: b.id, pitch: `${artist.name} fans over-index on ${b.name} (affinity ${pct(b.affinity)}). Pitch a co-branded tour item${b.description ? ` in ${b.description.toLowerCase()}` : ""}.` }));

  const age = ledger.demographics?.age ?? [];
  const peak = age.slice().sort((a, b) => b.affinity - a.affinity)[0];
  const g = ledger.demographics?.gender;
  const genderLean = g && g.female !== null && g.male !== null ? (g.female - g.male > 0.1 ? "leans female" : g.male - g.female > 0.1 ? "leans male" : "is gender-balanced") : null;
  const tags = ledger.tasteTags.slice(0, 5).map((t) => t.name);
  const audienceNotes = [
    peak ? `Strongest age affinity: ${AGE_LABEL[peak.band] ?? peak.band}${genderLean ? `; the audience ${genderLean}` : ""}.` : null,
    tags.length ? `Taste signals to design around: ${tags.join(", ")}.` : null,
  ].filter((x): x is string => !!x);

  const top = stops[0] ? CITY_BY_ID.get(stops[0].cityId)!.name : "";
  const gems = cityIds.filter((id) => {
    const s = ledger.cityScores.get(id)!;
    return classifyOpportunity(s.affinity!, s.popularity) === "hidden-gem";
  });
  return {
    headline: `${artist.name}: ${stops.length} Nights Where the Fans Are`,
    summary: `${stops.length} stops picked from ${ledger.cityScores.size} candidate cities by Qloo fan affinity, weighted toward markets with headroom (affinity above local popularity), then routed to minimise travel. ${gems.length ? `${gems.length} hidden-gem market${gems.length > 1 ? "s" : ""} on the run. ` : ""}Highest-scoring stop: ${top}.`,
    stops,
    coHeadliners,
    brandPartners,
    audienceNotes,
  };
}
