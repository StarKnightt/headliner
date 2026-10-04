import { z } from "zod";
import { CITY_BY_ID, citiesForRegion, REGIONS, type City } from "../cities";
import type { QlooService, ProvenanceRecord } from "../qloo/service";
import { classifyOpportunity, stopScore } from "../plan/routing";
import { PlanDraftSchema, type PlanRequest } from "../plan/schema";
import type { AgentEvent } from "./events";
import type { EvidenceLedger } from "./ledger";

export interface ToolContext {
  svc: QlooService;
  ledger: EvidenceLedger;
  request: PlanRequest;
  emit: (e: AgentEvent) => void;
  /** Set by executeTool to attribute Qloo calls to the step that made them. */
  collect?: (calls: ProvenanceRecord[]) => void;
}

export interface AgentTool<A extends z.ZodType = z.ZodType> {
  name: string;
  description: string;
  args: A;
  /** Human title for the timeline. */
  title: (args: z.infer<A>, ctx: ToolContext) => string;
  run: (args: z.infer<A>, ctx: ToolContext) => Promise<{ result: unknown; detail: string }>;
}

export function defineTool<A extends z.ZodType>(t: AgentTool<A>): AgentTool<A> {
  return t;
}

const r2 = (x: number | null | undefined) => (x === null || x === undefined ? null : Math.round(x * 100) / 100);

function requireArtist(ctx: ToolContext) {
  if (!ctx.ledger.artist) throw new Error("No artist resolved yet. Call search_artist first.");
  return ctx.ledger.artist;
}

function resolveCities(ids: string[]): City[] {
  return ids.map((id) => CITY_BY_ID.get(id.trim().toLowerCase())).filter((c): c is City => !!c);
}

function collectCalls(ctx: ToolContext, calls: ProvenanceRecord[]) {
  ctx.ledger.record(calls);
  ctx.collect?.(calls);
  return calls;
}

export function venuePopularityRange(request: PlanRequest, artistPopularity: number | null): [number, number] {
  switch (request.venueSize) {
    case "club":
      return [0, 0.72];
    case "theatre":
      return [0.68, 0.9];
    case "hall":
      return [0.85, 1];
    default: {
      const p = artistPopularity ?? 0.7;
      if (p >= 0.9) return [0.75, 1];
      if (p >= 0.8) return [0.65, 0.92];
      return [0, 0.8];
    }
  }
}

const searchArtist = defineTool({
  name: "search_artist",
  description: "Resolve an artist name to a Qloo entity (GET /search, types=urn:entity:artist). Always call first.",
  args: z.object({ name: z.string().min(1).describe("Artist name as the user wrote it") }),
  title: (a) => `Resolving “${a.name}” in Qloo`,
  async run(a, ctx) {
    const r = await ctx.svc.searchArtist(a.name);
    collectCalls(ctx, r.calls);
    ctx.ledger.artistCandidates = r.data;
    const exact = r.data.find((e) => e.name.toLowerCase() === a.name.trim().toLowerCase());
    ctx.ledger.artist = exact ?? r.data[0] ?? null;
    if (!ctx.ledger.artist) return { result: { found: false }, detail: "No artist found." };
    const e = ctx.ledger.artist;
    return {
      result: {
        selected: { id: e.id, name: e.name, popularity: r2(e.popularity), genres: e.tags.map((t) => t.name), description: e.description },
        otherCandidates: r.data.filter((x) => x.id !== e.id).slice(0, 3).map((x) => ({ name: x.name, popularity: r2(x.popularity) })),
      },
      detail: `${e.name} · popularity ${Math.round((e.popularity ?? 0) * 100)}th pct${e.tags.length ? ` · ${e.tags.slice(0, 3).map((t) => t.name).join(", ")}` : ""}`,
    };
  },
});

const scoreCities = defineTool({
  name: "score_cities",
  description:
    "Fan affinity for the artist in every candidate city of the requested region (Qloo urn:heatmap with locality boundaries, falling back to per-city geohash heatmaps). Returns cities ranked by Headliner score with Qloo affinity and local popularity.",
  args: z.object({
    cityIds: z.array(z.string()).max(30).optional().describe("Optional explicit candidate cityIds; default is the requested region's catalogue"),
  }),
  title: (a, ctx) => `Scoring fan affinity across ${a.cityIds?.length ?? citiesForRegion(ctx.request.region).length} cities`,
  async run(a, ctx) {
    const artist = requireArtist(ctx);
    const cities = a.cityIds?.length ? resolveCities(a.cityIds) : citiesForRegion(ctx.request.region);
    const r = await ctx.svc.scoreCities(artist.id, cities);
    collectCalls(ctx, r.calls);
    for (const c of r.data) ctx.ledger.cityScores.set(c.cityId, c);
    const ranked = r.data
      .filter((c) => c.affinity !== null)
      .map((c) => ({
        cityId: c.cityId,
        city: CITY_BY_ID.get(c.cityId)!.name,
        affinity: r2(c.affinity),
        popularity: r2(c.popularity),
        score: stopScore(c.affinity!, c.popularity),
        read: classifyOpportunity(c.affinity!, c.popularity),
      }))
      .sort((x, y) => y.score - x.score);
    ctx.emit({
      type: "preview",
      cities: r.data.filter((c) => c.affinity !== null).map((c) => ({ cityId: c.cityId, affinity: c.affinity!, popularity: c.popularity })),
    });
    const noData = r.data.filter((c) => c.affinity === null).map((c) => c.cityId);
    return {
      result: { ranked, noData },
      detail: `Top: ${ranked.slice(0, 3).map((c) => `${c.city} ${Math.round((c.affinity ?? 0) * 100)}`).join(" · ")}${noData.length ? ` · ${noData.length} without data` : ""}`,
    };
  },
});

const findVenueTags = defineTool({
  name: "find_venue_tags",
  description: "Look up valid Qloo tag IDs (GET /v2/tags) for venue types, e.g. 'music venue', 'concert hall', 'jazz club'. Found place tags are used by find_venues.",
  args: z.object({ query: z.string().min(2).max(60) }),
  title: (a) => `Finding Qloo tags for “${a.query}”`,
  async run(a, ctx) {
    const r = await ctx.svc.findTags(a.query, "urn:entity:place");
    collectCalls(ctx, r.calls);
    const placeTags = r.data.filter((t) => t.id.startsWith("urn:tag:category:place:"));
    if (placeTags.length) ctx.ledger.venueTagIds = [...new Set([...ctx.ledger.venueTagIds, ...placeTags.slice(0, 2).map((t) => t.id)])];
    return {
      result: { tags: r.data.map((t) => ({ id: t.id, name: t.name })), usingForVenues: ctx.ledger.venueTagIds },
      detail: r.data.slice(0, 3).map((t) => t.name).join(", ") || "No tags",
    };
  },
});

const findVenues = defineTool({
  name: "find_venues",
  description:
    "Venues in each city whose crowd matches the artist's audience (Qloo urn:entity:place insights, signal = artist, filter.location.query = city, filter.tags = venue tags, popularity band from the requested venue size, with explainability).",
  args: z.object({ cityIds: z.array(z.string()).min(1).max(12) }),
  title: (a) => `Matching venues in ${a.cityIds.length} cities`,
  async run(a, ctx) {
    const artist = requireArtist(ctx);
    const [min, max] = venuePopularityRange(ctx.request, artist.popularity);
    const out: { cityId: string; venues: unknown[] }[] = [];
    let found = 0;
    const cities = resolveCities(a.cityIds);
    await Promise.all(
      cities.map(async (city) => {
        try {
          const r = await ctx.svc.venues(artist.id, city, { tagIds: ctx.ledger.venueTagIds, popularityMin: min, popularityMax: max, take: 4 });
          collectCalls(ctx, r.calls);
          let list = r.data;
          if (!list.length) {
            const wide = await ctx.svc.venues(artist.id, city, { tagIds: ctx.ledger.venueTagIds, take: 4 });
            collectCalls(ctx, wide.calls);
            list = wide.data;
          }
          ctx.ledger.venues.set(city.id, list);
          found += list.length;
          out.push({
            cityId: city.id,
            venues: list.map((v) => ({ id: v.id, name: v.name, affinity: r2(v.affinity), popularity: r2(v.popularity), address: v.address })),
          });
        } catch (err) {
          const call = (err as { call?: ProvenanceRecord }).call;
          if (call) collectCalls(ctx, [call]);
          out.push({ cityId: city.id, venues: [] });
        }
      }),
    );
    return { result: { popularityBand: [min, max], cities: out }, detail: `${found} venues across ${cities.length} cities (popularity ${min}–${max})` };
  },
});

const cityHeatmap = defineTool({
  name: "city_heatmap",
  description: "Neighbourhood-level fan hotspots inside cities (Qloo urn:heatmap geohash grid). Use for the cities you plan to route through; feeds the 3D globe and street-team notes.",
  args: z.object({ cityIds: z.array(z.string()).min(1).max(12) }),
  title: (a) => `Mapping fan hotspots in ${a.cityIds.length} cities`,
  async run(a, ctx) {
    const artist = requireArtist(ctx);
    const cities = resolveCities(a.cityIds);
    const summary: unknown[] = [];
    await Promise.all(
      cities.map(async (city) => {
        try {
          const r = await ctx.svc.cityHeatmap(artist.id, city, 40);
          collectCalls(ctx, r.calls);
          ctx.ledger.heat.set(city.id, r.data);
          summary.push({ cityId: city.id, cells: r.data.length, peakAffinity: r2(r.data[0]?.affinity) });
        } catch (err) {
          const call = (err as { call?: ProvenanceRecord }).call;
          if (call) collectCalls(ctx, [call]);
          summary.push({ cityId: city.id, cells: 0 });
        }
      }),
    );
    return { result: { cities: summary }, detail: `${summary.length} heatmaps` };
  },
});

const similarArtists = defineTool({
  name: "similar_artists",
  description:
    "Artists with overlapping audiences (Qloo urn:entity:artist insights, signal = artist, explainability on). band=peer for co-headliners, smaller for support acts, bigger for aspirational. younger=true biases toward a 24-and-under crowd.",
  args: z.object({
    band: z.enum(["peer", "smaller", "bigger"]),
    younger: z.boolean().optional(),
  }),
  title: (a) => `Finding ${a.band === "smaller" ? "support acts" : a.band === "peer" ? "co-headliners" : "bigger acts"} with shared fans`,
  async run(a, ctx) {
    const artist = requireArtist(ctx);
    const p = artist.popularity ?? 0.7;
    const range: [number | undefined, number | undefined] =
      a.band === "peer" ? [Math.max(0, p - 0.1), Math.min(1, p + 0.08)] : a.band === "smaller" ? [undefined, Math.max(0.05, p - 0.03)] : [p, undefined];
    const r = await ctx.svc.similarArtists(artist.id, {
      popularityMin: range[0] === undefined ? undefined : Math.round(range[0] * 100) / 100,
      popularityMax: range[1] === undefined ? undefined : Math.round(range[1] * 100) / 100,
      audienceAge: a.younger ? "24_and_younger" : undefined,
      take: 6,
    });
    collectCalls(ctx, r.calls);
    for (const e of r.data) ctx.ledger.similar.set(e.id, e);
    return {
      result: {
        artists: r.data.map((e) => ({
          id: e.id,
          name: e.name,
          affinity: r2(e.affinity),
          popularity: r2(e.popularity),
          genres: e.tags.slice(0, 3).map((t) => t.name),
          explainedBy: e.explainedBy.map((x) => ({ entityId: x.entityId, score: r2(x.score) })),
        })),
      },
      detail: r.data.slice(0, 3).map((e) => e.name).join(", ") || "None",
    };
  },
});

const brandAffinities = defineTool({
  name: "brand_affinities",
  description: "Brands the artist's audience over-indexes on (Qloo urn:entity:brand insights, explainability on). Use for merch collaborations and sponsorship pitches.",
  args: z.object({}),
  title: () => "Finding brands the audience over-indexes on",
  async run(_a, ctx) {
    const artist = requireArtist(ctx);
    const r = await ctx.svc.brands(artist.id, 8);
    collectCalls(ctx, r.calls);
    for (const e of r.data) ctx.ledger.brands.set(e.id, e);
    return {
      result: { brands: r.data.map((e) => ({ id: e.id, name: e.name, category: e.description, affinity: r2(e.affinity), popularity: r2(e.popularity) })) },
      detail: r.data.slice(0, 3).map((e) => e.name).join(", ") || "None",
    };
  },
});

const audienceProfile = defineTool({
  name: "audience_profile",
  description:
    "Aggregate audience profile: age-band and gender affinity (Qloo urn:demographics) plus taste-analysis tags (urn:tag) that over-index for fans. Aggregate only; never describe individuals.",
  args: z.object({}),
  title: () => "Profiling the audience (demographics + taste)",
  async run(_a, ctx) {
    const artist = requireArtist(ctx);
    const [d, t] = await Promise.all([ctx.svc.demographics(artist.id), ctx.svc.tasteTags(artist.id, 12)]);
    collectCalls(ctx, [...d.calls, ...t.calls]);
    ctx.ledger.demographics = d.data;
    ctx.ledger.tasteTags = t.data;
    const peak = d.data?.age.slice().sort((x, y) => y.affinity - x.affinity)[0];
    return {
      result: {
        age: d.data?.age.map((x) => ({ band: x.band, affinity: r2(x.affinity) })) ?? [],
        gender: d.data?.gender ?? null,
        tasteTags: t.data.map((x) => ({ name: x.name, type: x.type, affinity: r2(x.affinity) })),
      },
      detail: `${peak ? `Peak age ${peak.band.replace(/_/g, " ")}` : "No demographics"} · ${t.data.slice(0, 3).map((x) => x.name).join(", ")}`,
    };
  },
});

export const submitTourPlanDescription =
  "Submit the final tour plan. Reference only cityIds, venue ids, artist ids and brand ids returned by earlier tools. Scores, coordinates and route order are filled in server-side from Qloo evidence.";

export const AGENT_TOOLS = [
  searchArtist,
  findVenueTags,
  scoreCities,
  cityHeatmap,
  findVenues,
  similarArtists,
  brandAffinities,
  audienceProfile,
] as unknown as AgentTool[];

export const TOOL_BY_NAME = new Map(AGENT_TOOLS.map((t) => [t.name, t]));

export { PlanDraftSchema, REGIONS };
