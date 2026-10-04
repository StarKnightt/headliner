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
  tags: { id: string; name: string }[];
  /** From feature.explainability: which input entities drove this result. */
  explainedBy: { entityId: string; score: number }[];
}

export interface Place extends TasteEntity {
  address: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  businessRating: number | null;
}

export interface HeatCell {
  lat: number;
  lng: number;
  geohash: string | null;
  name: string | null;
  affinity: number;
  affinityRank: number;
  popularity: number;
}

export interface CityAffinity {
  cityId: string;
  /** Qloo affinity of the artist for audiences in this locality, 0..1 (null = no data). */
  affinity: number | null;
  /** Artist popularity percentile within the locality, 0..1 (null = no data). */
  popularity: number | null;
  /** Locality Qloo resolved the query to, for provenance. */
  resolvedLocality: string | null;
  method: "insights-location" | "heatmap-locality";
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
