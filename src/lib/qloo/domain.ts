/** Normalised shapes the agent and UI work with, mapped from raw Qloo responses in mapping.ts. */

export interface TasteEntity {
  id: string;
  name: string;
  type: string;
  /** Qloo popularity percentile, 0..1. */
  popularity: number | null;
  /** Query-relative Qloo affinity, 0..1 (null when the endpoint does not score). */
  affinity: number | null;
  description: string | null;
  imageUrl: string | null;
  tags: { id: string; name: string; type?: string }[];
  /** From feature.explainability: which input entities drove this result. */
  explainedBy: { entityId: string; score: number }[];
}

export interface Place extends TasteEntity {
  address: string | null;
  /** properties.geocode.city (or name) */
  city: string | null;
  /** properties.geocode.name: usually the neighbourhood */
  neighborhood: string | null;
  /** Qloo place category matched by the room-type filter, e.g. "Live music venue" */
  category: string | null;
  /** The place's first Qloo category, e.g. "Afghan restaurant" for a restaurant that also hosts gigs. */
  primaryCategory: string | null;
  website: string | null;
  lat: number | null;
  lng: number | null;
  businessRating: number | null;
}

export interface HeatCell {
  lat: number;
  lng: number;
  geohash: string | null;
  name: string | null;
  /** Qloo heatmap affinity: percentile of this cell among all cells in the queried area. */
  affinity: number;
  affinityRank: number;
  /** Qloo heatmap popularity: percentile of signal volume among cells in the queried area. */
  popularity: number;
}

export interface CityAffinity {
  cityId: string;
  /** Affinity of the heatmap cell the city centre falls in (percentile within the territory), null = no data. */
  affinity: number | null;
  /** Popularity of that cell (percentile within the territory), null = no data. */
  popularity: number | null;
  /** Best cell within 35 km of the centre, for metros whose fans sit outside the core. */
  peakAffinity: number | null;
  peakKm: number | null;
  /** Geohash of the cell used. */
  cell: string | null;
  /** Territory the percentiles are relative to, e.g. "North America". */
  area: string;
  /** Locality Qloo resolved this city's name to (from the venue lookup), for provenance. */
  resolvedLocality: string | null;
  method: "heatmap-geohash";
}

export interface Demographics {
  age: { band: string; affinity: number }[];
  gender: { male: number | null; female: number | null };
}

export interface TasteTag {
  id: string;
  name: string;
  type: string | null;
  affinity: number | null;
}
