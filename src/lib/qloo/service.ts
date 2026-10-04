import { haversineKm, type City, type Region } from "../cities";
import { mapLimit } from "./cache";
import type { CityAffinity, Demographics, HeatCell, Place, TasteEntity, TasteTag } from "./domain";
import {
  mapDemographics,
  mapHeatmap,
  mapInsightsEntities,
  mapInsightsPlaces,
  mapSearch,
  mapTags,
  resolvedLocality,
} from "./mapping";
import type { InsightsParams, QlooTransport } from "./types";

/** One Qloo call as shown to the user ("How Qloo powers this"). Never includes the API key. */
export interface ProvenanceRecord {
  path: string;
  params: Record<string, string | number | boolean>;
  durationMs: number;
  resultCount: number;
  mode: "live" | "mock";
  error?: string;
}

export interface Traced<T> {
  data: T;
  calls: ProvenanceRecord[];
}

/** Locality queries used for region-wide `urn:heatmap` calls with locality boundaries. */
export const REGION_LOCALITY_QUERIES: Record<Region, string[]> = {
  "north-america": ["United States", "Canada"],
  "latin-america": ["Mexico", "Brazil", "Argentina", "Colombia", "Chile"],
  europe: ["Europe"],
  "uk-ireland": ["United Kingdom", "Ireland"],
  "asia-pacific": ["Japan", "South Korea", "Southeast Asia", "Australia", "New Zealand"],
  india: ["India"],
};

/** Boundary value for city-level heatmaps (docs example value for `output.heatmap.boundary`). */
export const LOCALITY_BOUNDARY = "urn:entity:locality";

export const DEFAULT_VENUE_TAG = "urn:tag:category:place:music_venue";

export class QlooService {
  constructor(readonly transport: QlooTransport) {}

  get mode() {
    return this.transport.mode;
  }

  private async trace<T>(
    path: string,
    params: Record<string, unknown>,
    run: () => Promise<T>,
    count: (t: T) => number,
  ): Promise<{ data: T; call: ProvenanceRecord }> {
    const t0 = performance.now();
    const clean = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== ""),
    ) as Record<string, string | number | boolean>;
    try {
      const data = await run();
      return {
        data,
        call: { path, params: clean, durationMs: Math.round(performance.now() - t0), resultCount: count(data), mode: this.mode },
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

  private async insights<T>(params: InsightsParams, map: (r: Awaited<ReturnType<QlooTransport["insights"]>>) => T, count: (t: T) => number) {
    return this.trace("/v2/insights", { ...params }, async () => map(await this.transport.insights(params)), count);
  }

  async searchArtist(name: string, take = 5): Promise<Traced<TasteEntity[]>> {
    const params = { query: name, types: "urn:entity:artist", take };
    const { data, call } = await this.trace("/search", params, async () => mapSearch(await this.transport.search(params)), (d) => d.length);
    return { data, calls: [call] };
  }

  async findTags(query: string, parentType?: string, take = 8): Promise<Traced<TasteTag[]>> {
    const params = { "filter.query": query, "feature.semantic_search": true, "filter.parents.types": parentType, take };
    const { data, call } = await this.trace(
      "/v2/tags",
      params,
      async () => mapTags((await this.transport.tags(params)).results?.tags),
      (d) => d.length,
    );
    return { data, calls: [call] };
  }

  /** City-level heatmap across a broad locality: one call returns affinity for many cities. */
  async localityHeatmap(artistId: string, within: string, take = 50): Promise<Traced<HeatCell[]>> {
    const { data, call } = await this.insights(
      {
        "filter.type": "urn:heatmap",
        "signal.interests.entities": artistId,
        "filter.location.query": within,
        "output.heatmap.boundary": LOCALITY_BOUNDARY,
        take,
      },
      mapHeatmap,
      (d) => d.length,
    );
    return { data, calls: [call] };
  }

  /** Default geohash heatmap inside one city: where in town the fans are. */
  async cityHeatmap(artistId: string, city: City, take = 50): Promise<Traced<HeatCell[]>> {
    const { data, call } = await this.insights(
      { "filter.type": "urn:heatmap", "signal.interests.entities": artistId, "filter.location.query": city.query, take },
      mapHeatmap,
      (d) => d.length,
    );
    return { data, calls: [call] };
  }

  /**
   * Fan affinity per candidate city.
   * Primary: region-wide locality heatmaps, matched to catalogue cities by distance (<= 75 km).
   * Fallback for unmatched cities: summarise that city's geohash heatmap (mean of top cells).
   */
  async scoreCities(artistId: string, cities: City[]): Promise<Traced<CityAffinity[]>> {
    const calls: ProvenanceRecord[] = [];
    const regions = [...new Set(cities.map((c) => c.region))];
    const withins = regions.flatMap((r) => REGION_LOCALITY_QUERIES[r]);
    const cells: HeatCell[] = [];
    await mapLimit(withins, 3, async (w) => {
      try {
        const r = await this.localityHeatmap(artistId, w);
        cells.push(...r.data);
        calls.push(...r.calls);
      } catch (err) {
        const call = (err as { call?: ProvenanceRecord }).call;
        if (call) calls.push(call);
      }
    });

    const out: CityAffinity[] = [];
    const unmatched: City[] = [];
    for (const city of cities) {
      let best: HeatCell | null = null;
      let bestD = Infinity;
      for (const cell of cells) {
        const d = haversineKm(city, cell);
        if (d < bestD) {
          bestD = d;
          best = cell;
        }
      }
      if (best && bestD <= 75) {
        out.push({ cityId: city.id, affinity: best.affinity, popularity: best.popularity, resolvedLocality: best.name, method: "heatmap-locality" });
      } else {
        unmatched.push(city);
      }
    }

    await mapLimit(unmatched, 4, async (city) => {
      try {
        const r = await this.cityHeatmap(artistId, city, 20);
        calls.push(...r.calls);
        const top = r.data.slice(0, 5);
        const affinity = top.length ? top.reduce((s, c) => s + c.affinity, 0) / top.length : null;
        const popularity = top.length ? top.reduce((s, c) => s + c.popularity, 0) / top.length : null;
        out.push({ cityId: city.id, affinity, popularity, resolvedLocality: city.query, method: "insights-location" });
      } catch (err) {
        const call = (err as { call?: ProvenanceRecord }).call;
        if (call) calls.push(call);
        out.push({ cityId: city.id, affinity: null, popularity: null, resolvedLocality: null, method: "insights-location" });
      }
    });

    const order = new Map(cities.map((c, i) => [c.id, i]));
    out.sort((a, b) => order.get(a.cityId)! - order.get(b.cityId)!);
    return { data: out, calls };
  }

  async venues(
    artistId: string,
    city: City,
    opts: { tagIds?: string[]; popularityMin?: number; popularityMax?: number; take?: number } = {},
  ): Promise<Traced<Place[]> & { locality: string | null }> {
    let locality: string | null = null;
    const { data, call } = await this.insights(
      {
        "filter.type": "urn:entity:place",
        "signal.interests.entities": artistId,
        "filter.location.query": city.query,
        "filter.tags": (opts.tagIds?.length ? opts.tagIds : [DEFAULT_VENUE_TAG]).join(","),
        "filter.popularity.min": opts.popularityMin,
        "filter.popularity.max": opts.popularityMax,
        "feature.explainability": true,
        take: opts.take ?? 5,
      },
      (r) => {
        locality = resolvedLocality(r);
        return mapInsightsPlaces(r);
      },
      (d) => d.length,
    );
    return { data, calls: [call], locality };
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
        "feature.explainability": true,
        take: opts.take ?? 8,
      },
      mapInsightsEntities,
      (d) => d.length,
    );
    return { data, calls: [call] };
  }

  async brands(artistId: string, take = 8): Promise<Traced<TasteEntity[]>> {
    const { data, call } = await this.insights(
      { "filter.type": "urn:entity:brand", "signal.interests.entities": artistId, "feature.explainability": true, take },
      mapInsightsEntities,
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

  /** Taste analysis: tags (genres, styles, cross-domain) that over-index for the artist's audience. */
  async tasteTags(artistId: string, take = 12): Promise<Traced<TasteTag[]>> {
    const { data, call } = await this.insights(
      { "filter.type": "urn:tag", "signal.interests.entities": artistId, take },
      (r) => mapTags(r.results?.tags),
      (d) => d.length,
    );
    return { data, calls: [call] };
  }
}
