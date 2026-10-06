import type { Demographics, HeatCell, Place, TasteEntity, TasteTag } from "./domain";
import type { InsightsResponse, RawEntity, RawHeatmapPoint, RawTag, SearchResponse } from "./types";

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Qloo names sometimes carry stray whitespace ("instrumental  hip hop", " psychedelic rock"). */
export const cleanName = (s: string) => {
  const t = s.replace(/\s+/g, " ").trim();
  return t ? t[0].toUpperCase() + t.slice(1) : t;
};

function entityType(raw: RawEntity): string {
  return raw.subtype ?? raw.types?.find((t) => t.startsWith("urn:entity:")) ?? raw.types?.[0] ?? raw.type ?? "unknown";
}

export function mapEntity(raw: RawEntity): TasteEntity {
  const explained = raw.query?.explainability?.["signal.interests.entities"] ?? [];
  return {
    id: raw.entity_id,
    name: raw.name.trim(),
    type: entityType(raw),
    popularity: num(raw.popularity),
    affinity: num(raw.query?.affinity),
    description: raw.properties?.short_description ?? raw.properties?.description ?? null,
    imageUrl: raw.properties?.image?.url ?? null,
    tags: (raw.tags ?? [])
      .map((t) => ({ id: t.id ?? t.tag_id ?? "", name: t.name, type: t.type ?? t.subtype }))
      .filter((t) => t.id && t.name),
    explainedBy: explained
      .filter((e) => typeof e?.entity_id === "string" && typeof e?.score === "number")
      .map((e) => ({ entityId: e.entity_id, score: e.score })),
  };
}

/** Place categories that describe a room a touring act can play, as opposed to a bar or restaurant that hosts gigs. */
const ROOM_CATEGORIES = new Set(
  ["live_music_venue", "concert_hall", "night_club", "jazz_club", "performing_arts_theater", "arena", "amphitheater", "stadium", "event_venue", "music_venue", "opera_house"].map(
    (s) => `urn:tag:category:place:${s}`,
  ),
);

export function mapPlace(raw: RawEntity, roomTagIds: string[] = []): Place {
  const base = mapEntity(raw);
  const geo = raw.properties?.geocode;
  const categories = base.tags.filter((t) => t.id.startsWith("urn:tag:category:place:"));
  const category = categories.find((t) => roomTagIds.includes(t.id))?.name ?? categories[0]?.name ?? null;
  return {
    ...base,
    tags: base.tags.slice(0, 8),
    address: raw.properties?.address ?? null,
    city: (geo?.city as string | undefined) ?? geo?.name ?? null,
    neighborhood: geo?.name && geo.name !== geo.city ? geo.name : null,
    category,
    primaryCategory: categories[0]?.name ?? null,
    website: typeof raw.properties?.website === "string" ? raw.properties.website : null,
    lat: num(raw.location?.lat),
    lng: num(raw.location?.lon),
    businessRating: num(raw.properties?.business_rating),
  };
}

export function mapSearch(res: SearchResponse): TasteEntity[] {
  return (Array.isArray(res.results) ? res.results : []).map(mapEntity).map((e) => ({ ...e, tags: e.tags.slice(0, 8) }));
}

export function mapInsightsEntities(res: InsightsResponse): TasteEntity[] {
  return (res.results?.entities ?? []).map(mapEntity).map((e) => ({ ...e, tags: e.tags.slice(0, 12) }));
}

export function mapInsightsPlaces(res: InsightsResponse, roomTagIds: string[] = []): Place[] {
  return (res.results?.entities ?? []).map((e) => mapPlace(e, roomTagIds));
}

/** True when the place's own first category is a room (not a restaurant or pub that also hosts music). */
export function isRoom(raw: RawEntity): boolean {
  const first = (raw.tags ?? []).find((t) => (t.id ?? t.tag_id ?? "").startsWith("urn:tag:category:place:"));
  return !!first && ROOM_CATEGORIES.has(first.id ?? first.tag_id ?? "");
}

/** Rooms first (stable, so Qloo's affinity order holds within each group). */
export function roomsFirst(res: InsightsResponse, roomTagIds: string[] = []): Place[] {
  const list = res.results?.entities ?? [];
  return [...list.filter(isRoom), ...list.filter((e) => !isRoom(e))].map((e) => mapPlace(e, roomTagIds));
}

/** Brands: Qloo can return regional variants under one name (two Fjällräven ids); keep the best. */
export function dedupeByName<T extends TasteEntity>(list: T[]): T[] {
  const seen = new Set<string>();
  return list.filter((e) => {
    const k = e.name.toLowerCase().replace(/[^a-z0-9]+/g, "");
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/** A short category for a brand from its Qloo brand-genre tags, e.g. "Casual · Fashion". */
export function brandCategory(e: TasteEntity): string | null {
  const genres = e.tags.filter((t) => t.type === "urn:tag:genre:brand").map((t) => t.name);
  return genres.length ? [...new Set(genres)].slice(0, 2).join(" · ") : null;
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
    name: cleanName(raw.name ?? ""),
    type: raw.subtype ?? raw.type ?? null,
    affinity: num(raw.query?.affinity) ?? num(raw.affinity),
  };
}

export function mapTags(list: RawTag[] | undefined): TasteTag[] {
  return (list ?? []).map(mapTag).filter((t) => t.id && t.name);
}

/**
 * Locality Qloo matched for a `filter.location.query`, used to prove which city a result belongs to.
 * Live responses put it under `query.localities.filter[0]` with a full disambiguation string.
 */
export function resolvedLocality(res: InsightsResponse): string | null {
  const q = res.query as
    | { localities?: { filter?: { name?: string; disambiguation?: string }[] }; locality?: { signal?: RawEntity; filter?: RawEntity } }
    | undefined;
  const l = q?.localities?.filter?.[0];
  if (l?.name && l.disambiguation) return l.disambiguation.startsWith(l.name) ? l.disambiguation : `${l.name}, ${l.disambiguation}`;
  return l?.disambiguation ?? l?.name ?? q?.locality?.signal?.name ?? q?.locality?.filter?.name ?? null;
}
