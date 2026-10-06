import type { InsightsResponse, RawEntity, RawHeatmapPoint, RawTag, SearchResponse, TagsResponse } from "./types";

/**
 * Qloo payloads are verbose (brands carry ~50 property fields, heatmaps thousands of cells). Before
 * caching, keep only the fields Headliner maps, and pack heatmap cells into tuples. `expand*` restores
 * the documented shape, so the mapping layer never knows whether a response came from cache.
 */
type Packed = [lat: number, lng: number, geohash: string, affinity: number, affinityRank: number, popularity: number];

const r = (x: unknown, d: number) => (typeof x === "number" && Number.isFinite(x) ? Math.round(x * 10 ** d) / 10 ** d : x);

function slimTag(t: RawTag): RawTag {
  return {
    ...(t.id ? { id: t.id } : {}),
    ...(t.tag_id ? { tag_id: t.tag_id } : {}),
    name: t.name,
    ...(t.type ? { type: t.type } : {}),
    ...(t.subtype ? { subtype: t.subtype } : {}),
    ...(t.popularity !== undefined ? { popularity: t.popularity } : {}),
    ...(t.query?.affinity !== undefined ? { query: { affinity: t.query.affinity } } : {}),
  };
}

function slimEntity(e: RawEntity): RawEntity {
  const p = e.properties ?? {};
  const desc = typeof p.description === "string" ? p.description.slice(0, 400) : undefined;
  return {
    name: e.name,
    entity_id: e.entity_id,
    ...(e.type ? { type: e.type } : {}),
    ...(e.subtype ? { subtype: e.subtype } : {}),
    ...(e.types ? { types: e.types } : {}),
    ...(e.popularity !== undefined ? { popularity: e.popularity } : {}),
    ...(e.location ? { location: { lat: e.location.lat, lon: e.location.lon, geohash: e.location.geohash } } : {}),
    properties: {
      ...(p.short_description ? { short_description: p.short_description } : {}),
      ...(desc ? { description: desc } : {}),
      ...(p.image?.url ? { image: { url: p.image.url } } : {}),
      ...(p.address ? { address: p.address } : {}),
      ...(p.geocode ? { geocode: p.geocode } : {}),
      ...(p.business_rating !== undefined ? { business_rating: p.business_rating } : {}),
      ...(p.price_level !== undefined ? { price_level: p.price_level } : {}),
      ...(typeof p.website === "string" ? { website: p.website.split("?")[0] } : {}),
    },
    // Category and genre tags are kept in full: the room-type match and brand categories read them.
    tags: [
      ...(e.tags ?? []).filter((t) => /category|genre/.test(t.type ?? t.subtype ?? "")),
      ...(e.tags ?? []).filter((t) => !/category|genre/.test(t.type ?? t.subtype ?? "")).slice(0, 20),
    ].map(slimTag),
    ...(e.query
      ? {
          query: {
            ...(e.query.affinity !== undefined ? { affinity: e.query.affinity } : {}),
            ...(e.query.explainability ? { explainability: { "signal.interests.entities": e.query.explainability["signal.interests.entities"] } } : {}),
          },
        }
      : {}),
  };
}

export function compactInsights(res: InsightsResponse): InsightsResponse {
  const out: InsightsResponse = { success: res.success, results: {} };
  const q = res.query as Record<string, unknown> | undefined;
  if (q) {
    out.query = {};
    for (const k of ["localities", "locality", "explainability"] as const) if (q[k] !== undefined) (out.query as Record<string, unknown>)[k] = q[k];
  }
  const { heatmap, entities, tags, demographics } = res.results ?? {};
  if (heatmap) {
    (out.results as Record<string, unknown>).heatmapPacked = heatmap.map(
      (p): Packed => [
        r(p.location.latitude, 5) as number,
        r(p.location.longitude, 5) as number,
        p.location.geohash ?? "",
        r(p.query.affinity, 4) as number,
        r(p.query.affinity_rank, 4) as number,
        r(p.query.popularity, 4) as number,
      ],
    );
  }
  if (entities) out.results.entities = entities.map(slimEntity);
  if (tags) out.results.tags = tags.map(slimTag);
  if (demographics) out.results.demographics = demographics;
  return out;
}

export function expandInsights(res: InsightsResponse): InsightsResponse {
  const packed = (res.results as Record<string, unknown> | undefined)?.heatmapPacked as Packed[] | undefined;
  if (!packed) return res;
  const { heatmapPacked: _drop, ...rest } = res.results as Record<string, unknown>;
  void _drop;
  const heatmap: RawHeatmapPoint[] = packed.map(([lat, lng, geohash, affinity, affinity_rank, popularity]) => ({
    location: { latitude: lat, longitude: lng, geohash },
    query: { affinity, affinity_rank, popularity },
  }));
  return { ...res, results: { ...rest, heatmap } };
}

export function compactSearch(res: SearchResponse): SearchResponse {
  return { results: (Array.isArray(res.results) ? res.results : []).map(slimEntity) };
}

export function compactTags(res: TagsResponse): TagsResponse {
  return { success: res.success, results: { tags: (res.results?.tags ?? []).map(slimTag) } };
}
