import type { Demographics, HeatCell, Place, TasteEntity, TasteTag } from "./domain";
import type { InsightsResponse, RawEntity, RawHeatmapPoint, RawTag, SearchResponse } from "./types";

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

function entityType(raw: RawEntity): string {
  return raw.subtype ?? raw.types?.find((t) => t.startsWith("urn:entity:")) ?? raw.types?.[0] ?? raw.type ?? "unknown";
}

export function mapEntity(raw: RawEntity): TasteEntity {
  const explained = raw.query?.explainability?.["signal.interests.entities"] ?? [];
  return {
    id: raw.entity_id,
    name: raw.name,
    type: entityType(raw),
    popularity: num(raw.popularity),
    affinity: num(raw.query?.affinity),
    description: raw.properties?.short_description ?? raw.properties?.description ?? null,
    imageUrl: raw.properties?.image?.url ?? null,
    tags: (raw.tags ?? [])
      .map((t) => ({ id: t.id ?? t.tag_id ?? "", name: t.name }))
      .filter((t) => t.id && t.name)
      .slice(0, 8),
    explainedBy: explained
      .filter((e) => typeof e?.entity_id === "string" && typeof e?.score === "number")
      .map((e) => ({ entityId: e.entity_id, score: e.score })),
  };
}

export function mapPlace(raw: RawEntity): Place {
  const base = mapEntity(raw);
  return {
    ...base,
    address: raw.properties?.address ?? null,
    city: raw.properties?.geocode?.name ?? null,
    lat: num(raw.location?.lat),
    lng: num(raw.location?.lon),
    businessRating: num(raw.properties?.business_rating),
  };
}

export function mapSearch(res: SearchResponse): TasteEntity[] {
  return (Array.isArray(res.results) ? res.results : []).map(mapEntity);
}

export function mapInsightsEntities(res: InsightsResponse): TasteEntity[] {
  return (res.results?.entities ?? []).map(mapEntity);
}

export function mapInsightsPlaces(res: InsightsResponse): Place[] {
  return (res.results?.entities ?? []).map(mapPlace);
}

export function mapHeatmap(res: InsightsResponse): HeatCell[] {
  const points: RawHeatmapPoint[] = res.results?.heatmap ?? [];
  return points
    .filter((p) => num(p?.location?.latitude) !== null && num(p?.location?.longitude) !== null)
    .map((p) => ({
      lat: p.location.latitude,
      lng: p.location.longitude,
      geohash: p.location.geohash ?? null,
      name: typeof p.name === "string" ? p.name : null,
      affinity: num(p.query?.affinity) ?? 0,
      affinityRank: num(p.query?.affinity_rank) ?? 0,
      popularity: num(p.query?.popularity) ?? 0,
    }))
    .sort((a, b) => b.affinity - a.affinity);
}

const AGE_ORDER = ["24_and_younger", "25_to_29", "30_to_34", "35_to_44", "45_to_54", "55_and_older"];

export function mapDemographics(res: InsightsResponse): Demographics | null {
  const first = res.results?.demographics?.[0];
  if (!first) return null;
  const age = Object.entries(first.query?.age ?? {})
    .filter(([, v]) => typeof v === "number")
    .map(([band, v]) => ({ band, affinity: v as number }))
    .sort((a, b) => AGE_ORDER.indexOf(a.band) - AGE_ORDER.indexOf(b.band));
  return {
    age,
    gender: { male: num(first.query?.gender?.male), female: num(first.query?.gender?.female) },
  };
}

export function mapTag(raw: RawTag): TasteTag {
  return {
    id: raw.id ?? raw.tag_id ?? "",
    name: raw.name,
    type: raw.subtype ?? raw.type ?? null,
    affinity: num(raw.query?.affinity) ?? num(raw.affinity),
  };
}

export function mapTags(list: RawTag[] | undefined): TasteTag[] {
  return (list ?? []).map(mapTag).filter((t) => t.id && t.name);
}

/** Locality Qloo matched for a `*.location.query`, used to prove which city a score belongs to. */
export function resolvedLocality(res: InsightsResponse): string | null {
  return res.query?.locality?.signal?.name ?? res.query?.locality?.filter?.name ?? null;
}
