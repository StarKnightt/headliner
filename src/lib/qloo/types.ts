/**
 * Raw Qloo API shapes (hackathon.api.qloo.com), as documented at docs.qloo.com and as consumed
 * by Qloo's own harness (@qloo/qloo-harness). Fields we do not use are left open with an index
 * signature, because the API returns verbose payloads (`akas`, `external`, ...).
 */

export type EntityType =
  | "urn:entity:artist"
  | "urn:entity:book"
  | "urn:entity:brand"
  | "urn:entity:destination"
  | "urn:entity:movie"
  | "urn:entity:person"
  | "urn:entity:place"
  | "urn:entity:podcast"
  | "urn:entity:tv_show"
  | "urn:entity:video_game";

export type InsightsFilterType = EntityType | "urn:heatmap" | "urn:demographics" | "urn:tag";

export type AgeBand =
  | "24_and_younger"
  | "25_to_29"
  | "30_to_34"
  | "35_to_44"
  | "45_to_54"
  | "55_and_older";

export interface RawTag {
  id?: string;
  tag_id?: string;
  name: string;
  type?: string;
  subtype?: string;
  value?: string;
  popularity?: number;
  affinity?: number;
  query?: { affinity?: number };
  [key: string]: unknown;
}

export interface RawGeocode {
  name?: string;
  city?: string;
  metro?: string;
  country?: string;
  admin1_region?: string;
  admin2_region?: string;
  country_code?: string;
  [key: string]: unknown;
}

export interface RawExplainabilityItem {
  entity_id: string;
  score: number;
  [key: string]: unknown;
}

export interface RawEntity {
  entity_id: string;
  name: string;
  type?: string;
  subtype?: string;
  types?: string[];
  popularity?: number;
  location?: { lat?: number; lon?: number; geohash?: string; [key: string]: unknown };
  properties?: {
    short_description?: string;
    description?: string;
    image?: { url?: string };
    address?: string;
    geocode?: RawGeocode;
    business_rating?: number;
    price_level?: number;
    [key: string]: unknown;
  };
  tags?: RawTag[];
  query?: {
    affinity?: number;
    explainability?: { "signal.interests.entities"?: RawExplainabilityItem[]; [key: string]: unknown };
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export interface RawHeatmapPoint {
  location: { latitude: number; longitude: number; geohash?: string; [key: string]: unknown };
  query: { affinity: number; affinity_rank: number; popularity: number; [key: string]: unknown };
  name?: string;
  entity_id?: string;
  [key: string]: unknown;
}

export interface RawDemographics {
  entity_id: string;
  query: {
    age?: Partial<Record<AgeBand, number>>;
    gender?: { male?: number; female?: number };
    [key: string]: unknown;
  };
}

export interface RawAudience {
  entity_id: string;
  name: string;
  parents?: string[];
  [key: string]: unknown;
}

export interface InsightsResponse {
  success?: boolean;
  results: {
    entities?: RawEntity[];
    heatmap?: RawHeatmapPoint[];
    demographics?: RawDemographics[];
    tags?: RawTag[];
    duration?: number;
  };
  query?: {
    locality?: { signal?: RawEntity; filter?: RawEntity };
    explainability?: unknown;
    [key: string]: unknown;
  };
  duration?: number;
  [key: string]: unknown;
}

export interface SearchResponse {
  results: RawEntity[];
  [key: string]: unknown;
}

export interface TagsResponse {
  success?: boolean;
  results: { tags: RawTag[] };
}

export interface AudiencesResponse {
  success?: boolean;
  results: { audiences: RawAudience[] };
}

/** Query-string parameters for GET /v2/insights. Only documented parameter names are allowed. */
export interface InsightsParams {
  "filter.type": InsightsFilterType;
  "signal.interests.entities"?: string;
  "signal.interests.tags"?: string;
  "signal.location.query"?: string;
  "signal.demographics.age"?: string;
  "signal.demographics.audiences"?: string;
  /** WKT POINT/POLYGON or a locality id. */
  "filter.location"?: string;
  "filter.location.query"?: string;
  "filter.location.radius"?: number;
  "filter.tags"?: string;
  "operator.filter.tags"?: "union" | "intersection";
  /** urn:tag insights only: restrict to these tag subtypes. */
  "filter.tag.types"?: string;
  "diversify.by"?: string;
  "diversify.take"?: number;
  "filter.exclude.entities"?: string;
  "filter.results.entities"?: string;
  "filter.popularity.min"?: number;
  "filter.popularity.max"?: number;
  "filter.parents.types"?: string;
  "output.heatmap.boundary"?: string;
  "feature.explainability"?: boolean;
  "bias.trends"?: string;
  "sort_by"?: string;
  take?: number;
  page?: number;
}

export interface SearchParams {
  query: string;
  types?: string;
  take?: number;
}

export interface TagsParams {
  "filter.query": string;
  "feature.semantic_search"?: boolean;
  "filter.parents.types"?: string;
  take?: number;
}

export interface AudiencesParams {
  "filter.parents.types"?: string;
  "filter.query"?: string;
  take?: number;
}

/** Low-level transport. The HTTP provider and the mock provider both implement this. */
export interface QlooTransport {
  readonly mode: "live" | "mock";
  search(params: SearchParams, signal?: AbortSignal): Promise<SearchResponse>;
  insights(params: InsightsParams, signal?: AbortSignal): Promise<InsightsResponse>;
  tags(params: TagsParams, signal?: AbortSignal): Promise<TagsResponse>;
  audiences(params: AudiencesParams, signal?: AbortSignal): Promise<AudiencesResponse>;
}

export class QlooError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string,
  ) {
    super(message);
    this.name = "QlooError";
  }
}
