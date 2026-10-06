import { z } from "zod";
import { CITY_BY_ID, citiesForRegion, HEAT_AREAS, REGIONS, type City } from "../cities";
import { ROOMS, type QlooService, type ProvenanceRecord } from "../qloo/service";
import { classifyOpportunity, headroom, stopScore, topShare } from "../plan/routing";
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
const r3 = (x: number | null | undefined) => (x === null || x === undefined ? null : Math.round(x * 1000) / 1000);

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

/**
 * Popularity band for the bill. Every touring act sits above Qloo's 90th popularity percentile, so
 * bands are multiplicative on the distance from the top: a peer is within 3x of the headliner's
 * "top share", a smaller act is more than 3x further down, a bigger act less than a third.
 */
export function billBand(band: "peer" | "smaller" | "bigger", popularity: number | null): [number | undefined, number | undefined] {
  const t = Math.min(0.5, Math.max(0.0005, 1 - (popularity ?? 0.9)));
  const round = (x: number) => Math.round(x * 10000) / 10000;
  if (band === "peer") return [round(Math.max(0, 1 - 3 * t)), round(1 - t / 3)];
  if (band === "smaller") return [undefined, round(Math.max(0.05, 1 - 3 * t))];
  return [round(1 - t / 3), undefined];
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
    const want = a.name.trim().toLowerCase();
    const exact = r.data.find((e) => e.name.toLowerCase() === want);
    ctx.ledger.artist = exact ?? r.data[0] ?? null;
    if (!ctx.ledger.artist) return { result: { found: false }, detail: "No artist found." };
    const e = ctx.ledger.artist;
    return {
      result: {
        selected: { id: e.id, name: e.name, popularity: r3(e.popularity), genres: e.tags.map((t) => t.name), description: e.description },
        otherCandidates: r.data.filter((x) => x.id !== e.id).slice(0, 3).map((x) => ({ name: x.name, popularity: r3(x.popularity) })),
      },
      detail: `${e.name} · popularity ${e.popularity === null ? "n/a" : `${topShare(e.popularity)} of artists`}${e.tags.length ? ` · ${e.tags.slice(0, 3).map((t) => t.name).join(", ")}` : ""}`,
    };
  },
});

const scoreCities = defineTool({
  name: "score_cities",
  description:
    "Fan affinity for the artist in every candidate city of the requested region: one Qloo urn:heatmap across the whole territory (WKT polygon or country), read at each city centre's geohash cell. Returns cities ranked by Headliner score.",
  args: z.object({
    cityIds: z.array(z.string()).max(80).optional().describe("Optional explicit candidate cityIds; default is the requested region's catalogue"),
  }),
  title: (a, ctx) => {
    const cities = a.cityIds?.length ? resolveCities(a.cityIds) : citiesForRegion(ctx.request.region);
    const n = cities.length;
    const territories = new Set(cities.map((c) => c.region));
    const area = territories.size > 1 ? `${territories.size} territories` : HEAT_AREAS[cities[0]?.region ?? "north-america"].label;
    return `Mapping fan affinity across ${area} (${n} cities)`;
  },
  async run(a, ctx) {
    const artist = requireArtist(ctx);
    const cities = a.cityIds?.length ? resolveCities(a.cityIds) : citiesForRegion(ctx.request.region);
    const r = await ctx.svc.scoreCities(artist.id, cities);
    collectCalls(ctx, r.calls);
    for (const c of r.data) ctx.ledger.cityScores.set(c.cityId, c);
    ctx.ledger.territoryCells = r.cells;
    const ranked = ctx.ledger.rankedCities().map((c) => ({
      cityId: c.cityId,
      city: CITY_BY_ID.get(c.cityId)!.name,
      affinity: r3(c.affinity),
      popularity: r3(c.popularity),
      fans: topShare(c.affinity!),
      headroom: headroom(c.affinity!, c.popularity),
      score: stopScore(c.affinity!, c.popularity),
      read: classifyOpportunity(c.affinity!, c.popularity),
    }));
    ctx.emit({
      type: "preview",
      cities: r.data.filter((c) => c.affinity !== null).map((c) => ({ cityId: c.cityId, affinity: c.affinity!, popularity: c.popularity })),
      heat: r.cells.map((c) => [Math.round(c.lat * 100) / 100, Math.round(c.lng * 100) / 100, Math.round(c.affinity * 1000) / 1000]),
    });
    const noData = r.data.filter((c) => c.affinity === null).map((c) => c.cityId);
    const cells = r.calls.reduce((s, c) => s + c.resultCount, 0);
    const gems = ranked.filter((c) => c.read === "hidden-gem").length;
    return {
      result: { ranked, noData },
      detail: `${cells.toLocaleString("en-US")} heatmap cells · top: ${ranked
        .slice(0, 3)
        .map((c) => `${c.city} (${c.fans})`)
        .join(", ")}${gems ? ` · ${gems} hidden gem${gems > 1 ? "s" : ""}` : ""}${noData.length ? ` · ${noData.length} without data` : ""}`,
    };
  },
});

const findVenueTags = defineTool({
  name: "find_venue_tags",
  description: "Look up valid Qloo place-category tag IDs (GET /v2/tags) for a room type, e.g. 'jazz club', 'concert hall'. Found tags are used by find_venues.",
  args: z.object({ query: z.string().min(2).max(60) }),
  title: (a) => `Finding Qloo place tags for “${a.query}”`,
  async run(a, ctx) {
    const r = await ctx.svc.findTags(a.query);
    collectCalls(ctx, r.calls);
    // The best semantic match among place categories; Qloo ranks keyword and genre tags alongside.
    const best = r.data.find((t) => t.id.startsWith("urn:tag:category:place:"));
    const merged = [...new Set([...ctx.ledger.venueTagIds, ...(best ? [best.id] : [])])].slice(0, 5);
    ctx.ledger.venueTagIds = merged.length ? merged : ROOMS[ctx.request.venueSize].tags;
    const short = (id: string) => id.replace("urn:tag:category:place:", "");
    return {
      result: { tags: r.data.map((t) => ({ id: t.id, name: t.name })), usingForVenues: ctx.ledger.venueTagIds },
      detail: `${best ? best.name : "No place category"} · filtering rooms by ${ctx.ledger.venueTagIds.map(short).join(", ")}`,
    };
  },
});

const findVenues = defineTool({
  name: "find_venues",
  description:
    "Venues in each city whose crowd matches the artist's audience (Qloo urn:entity:place insights: signal = artist, filter.location.query = city, filter.tags = room categories).",
  args: z.object({ cityIds: z.array(z.string()).min(1).max(12) }),
  title: (a) => `Matching rooms in ${a.cityIds.length} ${a.cityIds.length === 1 ? "city" : "cities"}`,
  async run(a, ctx) {
    const artist = requireArtist(ctx);
    const room = ROOMS[ctx.request.venueSize];
    const tagIds = ctx.ledger.venueTagIds.length ? ctx.ledger.venueTagIds : room.tags;
    const out: { cityId: string; venues: unknown[] }[] = [];
    let found = 0;
    const cities = resolveCities(a.cityIds);
    await Promise.all(
      cities.map(async (city) => {
        try {
          const r = await ctx.svc.venues(artist.id, city, { tagIds, popularityMax: room.popularityMax, take: 4 });
          collectCalls(ctx, r.calls);
          let list = r.data;
          let locality = r.locality;
          if (!list.length) {
            const wide = await ctx.svc.venues(artist.id, city, { tagIds: ROOMS.auto.tags, take: 4 });
            collectCalls(ctx, wide.calls);
            list = wide.data;
            locality = wide.locality ?? locality;
          }
          if (locality) ctx.ledger.localities.set(city.id, locality);
          const prior = (ctx.ledger.venues.get(city.id) ?? []).filter((v) => !list.some((x) => x.id === v.id));
          ctx.ledger.venues.set(city.id, [...list, ...prior]);
          found += list.length;
          out.push({
            cityId: city.id,
            venues: list.map((v) => ({ id: v.id, name: v.name, category: v.category, neighborhood: v.neighborhood, affinity: r3(v.affinity), popularity: r3(v.popularity) })),
          });
        } catch (err) {
          const call = (err as { call?: ProvenanceRecord }).call;
          if (call) collectCalls(ctx, [call]);
          out.push({ cityId: city.id, venues: [] });
        }
      }),
    );
    return { result: { cities: out }, detail: `${found} rooms across ${cities.length} ${cities.length === 1 ? "city" : "cities"} · ${room.label.toLowerCase()}` };
  },
});

const cityHeatmap = defineTool({
  name: "city_heatmap",
  description: "Neighbourhood-level fan hotspots inside cities (Qloo urn:heatmap geohash grid). Feeds the 3D globe and street-team notes.",
  args: z.object({ cityIds: z.array(z.string()).min(1).max(12) }),
  title: (a) => `Mapping neighbourhood hotspots in ${a.cityIds.length} ${a.cityIds.length === 1 ? "city" : "cities"}`,
  async run(a, ctx) {
    const artist = requireArtist(ctx);
    const cities = resolveCities(a.cityIds);
    let cells = 0;
    await Promise.all(
      cities.map(async (city) => {
        try {
          const r = await ctx.svc.cityHeatmap(artist.id, city);
          collectCalls(ctx, r.calls);
          ctx.ledger.heat.set(city.id, r.data);
          cells += r.data.length;
        } catch (err) {
          const call = (err as { call?: ProvenanceRecord }).call;
          if (call) collectCalls(ctx, [call]);
        }
      }),
    );
    return { result: { cities: cities.map((c) => c.id) }, detail: `${cells} hotspot cells across ${cities.length} ${cities.length === 1 ? "city" : "cities"}` };
  },
});

const similarArtists = defineTool({
  name: "similar_artists",
  description:
    "Artists with overlapping audiences (Qloo urn:entity:artist insights, signal = artist). band=peer for co-headliners, smaller for support acts, bigger for aspirational. younger=true biases toward a 24-and-under crowd.",
  args: z.object({
    band: z.enum(["peer", "smaller", "bigger"]),
    younger: z.boolean().optional(),
  }),
  title: (a) => `Finding ${a.band === "smaller" ? "support acts" : a.band === "peer" ? "co-headliners" : "bigger acts"} with shared fans${a.younger ? " (younger crowd)" : ""}`,
  async run(a, ctx) {
    const artist = requireArtist(ctx);
    const [min, max] = billBand(a.band, artist.popularity);
    const ask = (popularityMin?: number, popularityMax?: number) =>
      ctx.svc.similarArtists(artist.id, { popularityMin, popularityMax, audienceAge: a.younger ? "24_and_younger" : undefined, take: 6 });
    let r = await ask(min, max);
    collectCalls(ctx, r.calls);
    if (r.data.length < 3) {
      const wide = await ask(a.band === "bigger" ? min : undefined, a.band === "smaller" ? max : undefined);
      collectCalls(ctx, wide.calls);
      r = { ...wide, data: [...r.data, ...wide.data.filter((e) => !r.data.some((x) => x.id === e.id))] };
    }
    for (const e of r.data) ctx.ledger.similar.set(e.id, e);
    return {
      result: {
        artists: r.data.map((e) => ({ id: e.id, name: e.name, affinity: r3(e.affinity), popularity: r3(e.popularity), genres: e.tags.slice(0, 3).map((t) => t.name) })),
      },
      detail: r.data.slice(0, 3).map((e) => e.name).join(", ") || "None",
    };
  },
});

const brandAffinities = defineTool({
  name: "brand_affinities",
  description: "Brands the artist's audience over-indexes on (Qloo urn:entity:brand insights). Use for merch collaborations and sponsorship pitches.",
  args: z.object({}),
  title: () => "Finding brands the audience over-indexes on",
  async run(_a, ctx) {
    const artist = requireArtist(ctx);
    const r = await ctx.svc.brands(artist.id, 8);
    collectCalls(ctx, r.calls);
    for (const e of r.data) ctx.ledger.brands.set(e.id, e);
    return {
      result: { brands: r.data.map((e) => ({ id: e.id, name: e.name, category: e.description, affinity: r3(e.affinity) })) },
      detail: r.data.slice(0, 3).map((e) => e.name).join(", ") || "None",
    };
  },
});

const audienceProfile = defineTool({
  name: "audience_profile",
  description:
    "Aggregate audience profile: age-band and gender affinity (Qloo urn:demographics) plus taste-analysis tags (urn:tag across music, style, audience, theme and media). Aggregate only; never describe individuals.",
  args: z.object({}),
  title: () => "Profiling the audience (demographics and cross-domain taste)",
  async run(_a, ctx) {
    const artist = requireArtist(ctx);
    const [d, t] = await Promise.all([ctx.svc.demographics(artist.id), ctx.svc.tasteTags(artist.id)]);
    collectCalls(ctx, [...d.calls, ...t.calls]);
    ctx.ledger.demographics = d.data;
    ctx.ledger.tasteTags = t.data;
    const peak = d.data?.age.slice().sort((x, y) => y.affinity - x.affinity)[0];
    return {
      result: {
        age: d.data?.age.map((x) => ({ band: x.band, affinity: r2(x.affinity) })) ?? [],
        gender: d.data?.gender ?? null,
        tasteTags: t.data.map((x) => ({ name: x.name, type: x.type, affinity: r3(x.affinity) })),
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
