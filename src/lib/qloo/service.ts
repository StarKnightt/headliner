import { geohash, haversineKm, HEAT_AREAS, type City, type Region } from "../cities";
import { mapLimit } from "./cache";
import type { CityAffinity, Demographics, HeatCell, Place, TasteEntity, TasteTag } from "./domain";
import { brandCategory, dedupeByName, mapDemographics, mapHeatmap, mapInsightsEntities, mapSearch, mapTags, resolvedLocality, roomsFirst } from "./mapping";
import { responseMeta } from "./meta";
import { QlooError, type InsightsParams, type QlooTransport } from "./types";

/** Qloo answers 400 when a `filter.location.query` matches no locality (seen for some Indian cities). */
const unresolved = (err: unknown) => err instanceof QlooError && err.status === 400 && /resolve to a valid locality/i.test(err.message);

/** City location as a locality query, or (fallback) a WKT point with a radius in metres. */
const cityArea = (city: City, mode: "query" | "point"): Partial<InsightsParams> =>
  mode === "query" ? { "filter.location.query": city.query } : { "filter.location": `POINT(${city.lng} ${city.lat})`, "filter.location.radius": 20000 };

/** One Qloo call as shown to the user ("How Qloo powers this"). Never includes the API key. */
export interface ProvenanceRecord {
  path: string;
  params: Record<string, string | number | boolean>;
  durationMs: number;
  resultCount: number;
  mode: "live" | "mock";
  /** Served from Headliner's cache instead of a new request to Qloo. */
  cached?: boolean;
  error?: string;
  /** How Headliner recovered from this call's error, if it did. */
  note?: string;
}

export interface Traced<T> {
  data: T;
  calls: ProvenanceRecord[];
}

export type RoomSize = "auto" | "club" | "theatre" | "hall";

/**
 * Qloo place categories per room size (tag ids verified against GET /v2/tags). Qloo has no venue
 * capacity, so "club" also caps place popularity to lean away from the most prominent rooms.
 */
export const ROOMS: Record<RoomSize, { label: string; query: string; tags: string[]; popularityMax?: number }> = {
  auto: { label: "Live music venues", query: "live music venue", tags: ["urn:tag:category:place:live_music_venue"] },
  club: {
    label: "Clubs",
    query: "night club",
    tags: ["urn:tag:category:place:night_club", "urn:tag:category:place:jazz_club", "urn:tag:category:place:live_music_venue"],
    popularityMax: 0.97,
  },
  theatre: { label: "Theatres", query: "performing arts theater", tags: ["urn:tag:category:place:performing_arts_theater", "urn:tag:category:place:concert_hall"] },
  hall: {
    label: "Halls and arenas",
    query: "arena",
    tags: ["urn:tag:category:place:arena", "urn:tag:category:place:amphitheater", "urn:tag:category:place:stadium", "urn:tag:category:place:concert_hall"],
  },
};

/** Tag subtypes for the audience brief: music, style, audience descriptors, themes, media. */
export const TASTE_TAG_TYPES = [
  "urn:tag:genre:music",
  "urn:tag:music:qloo",
  "urn:tag:style:qloo",
  "urn:tag:audience:qloo",
  "urn:tag:theme:qloo",
  "urn:tag:genre:media",
];

/** Cells within this distance of a city centre count toward its metro peak. */
const METRO_KM = 35;

/**
 * Read a city from a territory heatmap: the cell its centre falls in (geohash prefix match), else the
 * nearest cell within 30 km. Also records the best cell in the metro, because some audiences (country
 * music, for one) sit in the suburbs rather than the core.
 */
export function readCity(city: City, cells: HeatCell[], area: string): CityAffinity {
  const empty: CityAffinity = { cityId: city.id, affinity: null, popularity: null, peakAffinity: null, peakKm: null, cell: null, area, resolvedLocality: null, method: "heatmap-geohash" };
  if (!cells.length) return empty;
  const precision = cells.find((c) => c.geohash)?.geohash?.length ?? 4;
  const gh = geohash(city.lat, city.lng, precision);
  let own: HeatCell | undefined;
  const near: { c: HeatCell; km: number }[] = [];
  for (const c of cells) {
    if (Math.abs(c.lat - city.lat) > 0.6 || Math.abs(c.lng - city.lng) > 0.9) continue;
    if (c.geohash === gh) own = c;
    const km = haversineKm(city, c);
    if (km <= METRO_KM) near.push({ c, km });
  }
  near.sort((a, b) => a.km - b.km);
  const base = own ?? near.find((x) => x.km <= 30)?.c;
  if (!base) return empty;
  const peak = near.reduce((best, x) => (x.c.affinity > best.c.affinity ? x : best), { c: base, km: own ? 0 : haversineKm(city, base) });
  return { ...empty, affinity: base.affinity, popularity: base.popularity, peakAffinity: peak.c.affinity, peakKm: Math.round(peak.km), cell: base.geohash };
}

export class QlooService {
  constructor(readonly transport: QlooTransport) {}

  get mode() {
    return this.transport.mode;
  }

  private async trace<R extends object, T>(
    path: string,
    params: Record<string, unknown>,
    fetch: () => Promise<R>,
    map: (raw: R) => T,
    count: (t: T) => number,
  ): Promise<{ data: T; call: ProvenanceRecord; raw: R }> {
    const t0 = performance.now();
    const clean = Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined && v !== "")) as Record<string, string | number | boolean>;
    try {
      const raw = await fetch();
      const data = map(raw);
      const cached = !!responseMeta.get(raw)?.cache;
      return {
        data,
        raw,
        call: { path, params: clean, durationMs: Math.round(performance.now() - t0), resultCount: count(data), mode: this.mode, ...(cached ? { cached } : {}) },
      };
    } catch (err) {
      const call: ProvenanceRecord = {
        path,
        params: clean,
        durationMs: Math.round(performance.now() - t0),
        resultCount: 0,
        mode: this.mode,
        error: err instanceof Error ? err.message : String(err),
      };
      throw Object.assign(err instanceof Error ? err : new Error(String(err)), { call });
    }
  }

  private insights<T>(params: InsightsParams, map: (r: Awaited<ReturnType<QlooTransport["insights"]>>) => T, count: (t: T) => number) {
    return this.trace("/v2/insights", { ...params }, () => this.transport.insights(params), map, count);
  }

  async searchArtist(name: string, take = 5): Promise<Traced<TasteEntity[]>> {
    const params = { query: name, types: "urn:entity:artist", take };
    const { data, call } = await this.trace("/search", params, () => this.transport.search(params), mapSearch, (d) => d.length);
    return { data, calls: [call] };
  }

  async findTags(query: string, take = 10): Promise<Traced<TasteTag[]>> {
    const params = { "filter.query": query, "feature.semantic_search": true, take };
    const { data, call } = await this.trace("/v2/tags", params, () => this.transport.tags(params), (r) => mapTags(r.results?.tags), (d) => d.length);
    return { data, calls: [call] };
  }

  /** One heatmap across a whole territory: thousands of geohash cells, each a percentile within it. */
  async territoryHeat(artistId: string, region: Region): Promise<Traced<HeatCell[]>> {
    const area = HEAT_AREAS[region];
    const { data, call } = await this.insights(
      {
        "filter.type": "urn:heatmap",
        "signal.interests.entities": artistId,
        ...(area.wkt ? { "filter.location": area.wkt } : { "filter.location.query": area.query }),
      },
      mapHeatmap,
      (d) => d.length,
    );
    return { data, calls: [call] };
  }

  /** Retry once with a WKT point when Qloo cannot resolve the city's name to a locality. */
  private async withCityFallback<T>(city: City, run: (area: Partial<InsightsParams>) => Promise<Traced<T>>): Promise<Traced<T>> {
    try {
      return await run(cityArea(city, "query"));
    } catch (err) {
      if (!unresolved(err)) throw err;
      const first = (err as { call?: ProvenanceRecord }).call;
      const r = await run(cityArea(city, "point"));
      const noted = first ? [{ ...first, note: `“${city.query}” did not resolve; retried as a 20 km WKT point` }] : [];
      return { ...r, calls: [...noted, ...r.calls] };
    }
  }

  /** Geohash heatmap inside one city: where in town the fans are. */
  async cityHeatmap(artistId: string, city: City, keep = 45): Promise<Traced<HeatCell[]>> {
    return this.withCityFallback(city, async (area) => {
      const { data, call } = await this.insights(
        { "filter.type": "urn:heatmap", "signal.interests.entities": artistId, ...area },
        (r) => mapHeatmap(r).slice(0, keep),
        (d) => d.length,
      );
      return { data, calls: [call] };
    });
  }

  /**
   * Fan affinity per candidate city: one territory heatmap per region (1 call for most runs, 6 for a
   * world tour), read at each city centre. Returns the territory's strongest cells for the globe too.
   */
  async scoreCities(artistId: string, cities: City[]): Promise<Traced<CityAffinity[]> & { cells: HeatCell[] }> {
    const calls: ProvenanceRecord[] = [];
    const regions = [...new Set(cities.map((c) => c.region))];
    const heat = new Map<Region, HeatCell[]>();
    await mapLimit(regions, 3, async (r) => {
      try {
        const res = await this.territoryHeat(artistId, r);
        heat.set(r, res.data);
        calls.push(...res.calls);
      } catch (err) {
        const call = (err as { call?: ProvenanceRecord }).call;
        if (call) calls.push(call);
      }
    });
    const data = cities.map((c) => readCity(c, heat.get(c.region) ?? [], HEAT_AREAS[c.region].label));
    const perRegion = regions.length > 1 ? 140 : 420;
    const cells = regions.flatMap((r) => (heat.get(r) ?? []).filter((c) => c.affinity >= 0.8).slice(0, perRegion));
    return { data, calls, cells };
  }

  /**
   * Places whose crowd matches the artist in one city, filtered to room categories. Asks for a few
   * extra and lists real rooms before restaurants or pubs that merely carry a live-music tag.
   */
  async venues(
    artistId: string,
    city: City,
    opts: { tagIds?: string[]; popularityMin?: number; popularityMax?: number; take?: number } = {},
  ): Promise<Traced<Place[]> & { locality: string | null }> {
    const tagIds = opts.tagIds?.length ? opts.tagIds : ROOMS.auto.tags;
    const keep = opts.take ?? 4;
    let locality: string | null = null;
    const r = await this.withCityFallback(city, async (area) => {
      const { data, call, raw } = await this.insights(
        {
          "filter.type": "urn:entity:place",
          "signal.interests.entities": artistId,
          ...area,
          "filter.tags": tagIds.join(","),
          "filter.popularity.min": opts.popularityMin,
          "filter.popularity.max": opts.popularityMax,
          "feature.explainability": true,
          take: keep + 3,
        },
        (res) => roomsFirst(res, tagIds).slice(0, keep),
        (d) => d.length,
      );
      locality = resolvedLocality(raw);
      return { data, calls: [call] };
    });
    return { ...r, locality };
  }

  async similarArtists(
    artistId: string,
    opts: { popularityMin?: number; popularityMax?: number; take?: number; audienceAge?: string } = {},
  ): Promise<Traced<TasteEntity[]>> {
    const { data, call } = await this.insights(
      {
        "filter.type": "urn:entity:artist",
        "signal.interests.entities": artistId,
        "filter.exclude.entities": artistId,
        "filter.popularity.min": opts.popularityMin,
        "filter.popularity.max": opts.popularityMax,
        "signal.demographics.age": opts.audienceAge,
        take: opts.take ?? 8,
      },
      mapInsightsEntities,
      (d) => d.length,
    );
    return { data, calls: [call] };
  }

  async brands(artistId: string, take = 8): Promise<Traced<TasteEntity[]>> {
    const { data, call } = await this.insights(
      { "filter.type": "urn:entity:brand", "signal.interests.entities": artistId, take: take + 4 },
      (r) =>
        dedupeByName(mapInsightsEntities(r))
          .slice(0, take)
          .map((e) => ({ ...e, description: brandCategory(e) ?? e.description })),
      (d) => d.length,
    );
    return { data, calls: [call] };
  }

  async demographics(artistId: string): Promise<Traced<Demographics | null>> {
    const { data, call } = await this.insights(
      { "filter.type": "urn:demographics", "signal.interests.entities": artistId },
      mapDemographics,
      (d) => (d ? 1 : 0),
    );
    return { data, calls: [call] };
  }

  /** Taste analysis: tags across music, style, audience, theme and media that over-index for the fans. */
  async tasteTags(artistId: string): Promise<Traced<TasteTag[]>> {
    const { data, call } = await this.insights(
      {
        "filter.type": "urn:tag",
        "signal.interests.entities": artistId,
        "filter.tag.types": TASTE_TAG_TYPES.join(","),
        "diversify.by": "subtype",
        "diversify.take": 4,
        take: 30,
      },
      (r) => mapTags(r.results?.tags),
      (d) => d.length,
    );
    return { data, calls: [call] };
  }
}
