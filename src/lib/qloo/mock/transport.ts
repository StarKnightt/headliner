/**
 * MockQlooTransport: answers the same documented query parameters as hackathon.api.qloo.com with
 * deterministic, raw-shaped fixture data. Used only when QLOO_API_KEY is absent. Nothing here is
 * Qloo data; every response carries `mock: true` and the UI shows a MOCK DATA banner.
 */
import { CITIES, findCity, type City } from "../../cities";
import type {
  AudiencesParams,
  AudiencesResponse,
  InsightsParams,
  InsightsResponse,
  QlooTransport,
  RawEntity,
  RawHeatmapPoint,
  RawTag,
  SearchParams,
  SearchResponse,
  TagsParams,
  TagsResponse,
} from "../types";
import {
  AGE_BANDS,
  MOCK_ARTISTS,
  MOCK_BRANDS,
  MOCK_GENRE_LABELS,
  MOCK_VENUES,
  SCENE_BONUS,
  type MockArtist,
  type RegionWeights,
} from "./fixtures";

// ---------- deterministic helpers ----------

export function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Seeded uniform in [0,1). */
export const rand = (seed: string) => hash32(seed) / 0x100000000;

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
const round = (x: number, d = 4) => Math.round(x * 10 ** d) / 10 ** d;

/** Qloo-style uppercase UUID derived from a name, so IDs are stable across runs. */
export function mockId(name: string): string {
  const hex = [0, 1, 2, 3].map((i) => hash32(`${i}:${name}`).toString(16).padStart(8, "0")).join("").toUpperCase();
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

const B32 = "0123456789bcdefghjkmnpqrstuvwxyz";
export function geohash(lat: number, lng: number, precision = 6): string {
  let latR = [-90, 90];
  let lngR = [-180, 180];
  let bit = 0;
  let ch = 0;
  let even = true;
  let out = "";
  while (out.length < precision) {
    const r = even ? lngR : latR;
    const v = even ? lng : lat;
    const mid = (r[0] + r[1]) / 2;
    if (v >= mid) {
      ch = (ch << 1) | 1;
      r[0] = mid;
    } else {
      ch = ch << 1;
      r[1] = mid;
    }
    if (even) lngR = r;
    else latR = r;
    even = !even;
    if (++bit === 5) {
      out += B32[ch];
      bit = 0;
      ch = 0;
    }
  }
  return out;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------- mock world model ----------

const tagId = (kind: "genre" | "keyword", slug: string) =>
  kind === "genre" ? `urn:tag:genre:music:${slug}` : `urn:tag:keyword:qloo:${slug}`;

const label = (slug: string) => MOCK_GENRE_LABELS[slug] ?? slug.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());

interface ArtistRecord extends MockArtist {
  id: string;
  synthetic: boolean;
}

const registry = new Map<string, ArtistRecord>();
for (const a of MOCK_ARTISTS) registry.set(mockId(a.name), { ...a, id: mockId(a.name), synthetic: false });

function synthesizeArtist(name: string): ArtistRecord {
  const id = mockId(name);
  const existing = registry.get(id);
  if (existing) return existing;
  const r = (k: string) => rand(`${name}:${k}`);
  const genrePool = Object.keys(MOCK_GENRE_LABELS);
  const vibePool = ["vinyl_culture", "cafes", "streetwear", "film_photography", "poetry", "club_culture", "thrift", "craft_beer", "design", "travel"];
  const weights: RegionWeights = {
    "north-america": 0.45 + r("na") * 0.5,
    "latin-america": 0.2 + r("la") * 0.6,
    europe: 0.3 + r("eu") * 0.6,
    "uk-ireland": 0.3 + r("uk") * 0.6,
    "asia-pacific": 0.2 + r("ap") * 0.6,
    india: 0.1 + r("in") * 0.7,
  };
  const rec: ArtistRecord = {
    id,
    name,
    synthetic: true,
    popularity: round(0.45 + r("pop") * 0.45, 3),
    genres: [0, 1, 2].map((i) => genrePool[Math.floor(r(`g${i}`) * genrePool.length)]),
    description: "Synthetic mock artist (not in fixtures).",
    weights,
    agePeak: Math.floor(r("age") * 4),
    genderSkew: r("gender") * 0.8 - 0.4,
    vibe: [0, 1, 2].map((i) => vibePool[Math.floor(r(`v${i}`) * vibePool.length)]),
  };
  registry.set(id, rec);
  return rec;
}

function artistFromSignal(params: InsightsParams): ArtistRecord | undefined {
  const first = params["signal.interests.entities"]?.split(",")[0]?.trim();
  return first ? registry.get(first) : undefined;
}

export function mockCityScore(a: ArtistRecord | MockArtist, city: City) {
  const seed = `${a.name}:${city.id}`;
  const affinity = clamp01(0.62 * a.weights[city.region] + 1.6 * (SCENE_BONUS[city.id] ?? 0.03) + (rand(seed) - 0.5) * 0.28);
  const popularity = clamp01(0.22 + a.popularity * 0.2 + (SCENE_BONUS[city.id] ?? 0.03) * 2.6 + (rand(`${seed}:pop`) - 0.5) * 0.7);
  return { affinity: round(affinity), popularity: round(popularity) };
}

function artistEntity(a: ArtistRecord, extra: Partial<RawEntity> = {}): RawEntity {
  return {
    name: a.name,
    entity_id: a.id,
    type: "urn:entity",
    subtype: "urn:entity:artist",
    types: ["urn:entity:artist"],
    popularity: a.popularity,
    properties: { short_description: a.description },
    tags: a.genres.map((g) => ({ id: tagId("genre", g), name: label(g), type: "urn:tag:genre:music" })),
    ...extra,
  };
}

function overlap(a: string[], b: string[]) {
  const sa = new Set(a);
  const inter = b.filter((x) => sa.has(x)).length;
  return inter / Math.max(1, new Set([...a, ...b]).size);
}

const COUNTRY_QUERIES: Record<string, string[]> = {
  "united states": ["US"], canada: ["CA"], mexico: ["MX"], brazil: ["BR"], argentina: ["AR"], colombia: ["CO"],
  chile: ["CL"], europe: ["FR", "DE", "NL", "ES", "PT", "DK", "SE", "IT", "BE", "CZ", "PL"], "united kingdom": ["GB"],
  ireland: ["IE"], japan: ["JP"], "south korea": ["KR"], "southeast asia": ["SG", "TH", "PH", "ID"], australia: ["AU"],
  "new zealand": ["NZ"], india: ["IN"],
};

function citiesWithin(query: string): City[] {
  const codes = COUNTRY_QUERIES[query.trim().toLowerCase()];
  if (codes) return CITIES.filter((c) => codes.includes(c.country));
  const city = findCity(query);
  return city ? [city] : [];
}

// ---------- transport ----------

export class MockQlooTransport implements QlooTransport {
  readonly mode = "mock" as const;
  constructor(private readonly latencyMs: [number, number] = [60, 220]) {}

  private async delay(seed: string) {
    const [lo, hi] = this.latencyMs;
    if (hi > 0) await sleep(lo + rand(seed) * (hi - lo));
  }

  async search(params: SearchParams): Promise<SearchResponse> {
    await this.delay(`search:${params.query}`);
    const q = params.query.trim().toLowerCase();
    if (!q) return { results: [], mock: true };
    const matches = [...registry.values()]
      .filter((a) => !a.synthetic)
      .filter((a) => a.name.toLowerCase().includes(q) || q.includes(a.name.toLowerCase()))
      .sort((a, b) => b.popularity - a.popularity);
    const list = matches.length ? matches : [synthesizeArtist(params.query.trim())];
    return { results: list.slice(0, params.take ?? 5).map((a) => artistEntity(a)), mock: true };
  }

  async tags(params: TagsParams): Promise<TagsResponse> {
    await this.delay(`tags:${params["filter.query"]}`);
    const q = params["filter.query"].toLowerCase();
    const venueTags: RawTag[] = [
      { id: "urn:tag:category:place:music_venue", name: "Music Venue", type: "urn:tag:category:place" },
      { id: "urn:tag:category:place:concert_hall", name: "Concert Hall", type: "urn:tag:category:place" },
      { id: "urn:tag:category:place:live_music_venue", name: "Live Music Venue", type: "urn:tag:category:place" },
      { id: "urn:tag:category:place:jazz_club", name: "Jazz Club", type: "urn:tag:category:place" },
      { id: "urn:tag:category:place:night_club", name: "Night Club", type: "urn:tag:category:place" },
    ];
    const slug = q.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    const tags = /venue|music|concert|club|gig|live/.test(q)
      ? venueTags.filter((t) => t.name.toLowerCase().split(" ").some((w) => q.includes(w))).concat(venueTags).slice(0, params.take ?? 8)
      : [{ id: `urn:tag:keyword:qloo:${slug}`, name: label(slug), type: "urn:tag:keyword:qloo" }];
    const unique = [...new Map(tags.map((t) => [t.id, t])).values()];
    return { success: true, results: { tags: unique }, mock: true } as TagsResponse;
  }

  async audiences(params: AudiencesParams): Promise<AudiencesResponse> {
    await this.delay(`aud:${params["filter.parents.types"]}`);
    const parent = params["filter.parents.types"] ?? "urn:audience:hobbies_and_interests";
    const names = ["Live Music Fans", "Vinyl Collectors", "Festival Goers", "Indie Film Buffs", "Coffee Enthusiasts"];
    return {
      success: true,
      results: {
        audiences: names.map((n) => ({ entity_id: `urn:audience:mock:${n.toLowerCase().replace(/\s+/g, "_")}`, name: n, parents: [parent] })),
      },
    };
  }

  async insights(params: InsightsParams): Promise<InsightsResponse> {
    await this.delay(`ins:${JSON.stringify(params)}`);
    const artist = artistFromSignal(params);
    const take = Math.min(params.take ?? 20, 50);
    const base = { success: true, mock: true } as const;
    if (!artist) return { ...base, results: { entities: [] } };

    switch (params["filter.type"]) {
      case "urn:heatmap":
        return { ...base, results: { heatmap: this.heatmap(artist, params, take) } };
      case "urn:demographics":
        return { ...base, results: { demographics: [this.demographics(artist)] } };
      case "urn:tag":
        return { ...base, results: { tags: this.tasteTags(artist, take) } };
      case "urn:entity:artist":
        return { ...base, results: { entities: this.similar(artist, params, take) } };
      case "urn:entity:brand":
        return { ...base, results: { entities: this.brands(artist, take) } };
      case "urn:entity:place": {
        const city = findCity(params["filter.location.query"] ?? "");
        return {
          ...base,
          results: { entities: city ? this.venues(artist, city, params, take) : [] },
          query: city ? { locality: { filter: { entity_id: mockId(`locality:${city.id}`), name: city.name } } } : {},
        };
      }
      default:
        return { ...base, results: { entities: [] } };
    }
  }

  private heatmap(a: ArtistRecord, params: InsightsParams, take: number): RawHeatmapPoint[] {
    const within = params["filter.location.query"] ?? "";
    if (params["output.heatmap.boundary"]) {
      return citiesWithin(within)
        .map((c) => {
          const s = mockCityScore(a, c);
          return {
            name: c.name,
            entity_id: mockId(`locality:${c.id}`),
            location: { latitude: c.lat, longitude: c.lng, geohash: geohash(c.lat, c.lng, 5) },
            query: { affinity: s.affinity, affinity_rank: s.affinity, popularity: s.popularity },
          };
        })
        .sort((x, y) => y.query.affinity - x.query.affinity)
        .slice(0, take);
    }
    const city = findCity(within);
    if (!city) return [];
    const s = mockCityScore(a, city);
    const pts: RawHeatmapPoint[] = [];
    for (let i = 0; i < take; i++) {
      const ang = rand(`${a.id}:${city.id}:a${i}`) * Math.PI * 2;
      const rad = Math.sqrt(rand(`${a.id}:${city.id}:r${i}`)) * 0.18;
      const lat = city.lat + Math.sin(ang) * rad;
      const lng = city.lng + (Math.cos(ang) * rad) / Math.cos((city.lat * Math.PI) / 180);
      const falloff = 1 - rad / 0.22;
      const aff = clamp01(s.affinity * (0.55 + 0.6 * falloff) + (rand(`${a.id}:${city.id}:n${i}`) - 0.5) * 0.15);
      pts.push({
        location: { latitude: round(lat, 5), longitude: round(lng, 5), geohash: geohash(lat, lng, 6) },
        query: { affinity: round(aff), affinity_rank: round(clamp01(aff * 1.1)), popularity: round(clamp01(s.popularity * falloff + 0.1)) },
      });
    }
    return pts.sort((x, y) => y.query.affinity - x.query.affinity);
  }

  private demographics(a: ArtistRecord) {
    const age: Record<string, number> = {};
    AGE_BANDS.forEach((band, i) => {
      const d = Math.abs(i - a.agePeak);
      age[band] = round(Math.max(-0.6, 0.45 - d * 0.28 + (rand(`${a.id}:${band}`) - 0.5) * 0.12), 2);
    });
    return {
      entity_id: a.id,
      query: { age, gender: { male: round(-a.genderSkew * 0.5, 2), female: round(a.genderSkew * 0.5, 2) } },
    };
  }

  private tasteTags(a: ArtistRecord, take: number): RawTag[] {
    const genres = a.genres.map((g, i) => ({ id: tagId("genre", g), name: label(g), subtype: "urn:tag:genre:music", query: { affinity: round(0.95 - i * 0.04) } }));
    const vibes = a.vibe.map((v, i) => ({ id: tagId("keyword", v), name: label(v), subtype: "urn:tag:keyword:qloo", query: { affinity: round(0.82 - i * 0.05 + rand(`${a.id}:${v}`) * 0.04) } }));
    return [...genres, ...vibes].slice(0, take);
  }

  private explain(a: ArtistRecord, extraSeed: string) {
    return { "signal.interests.entities": [{ entity_id: a.id, score: round(0.7 + rand(extraSeed) * 0.3, 3) }] };
  }

  private similar(a: ArtistRecord, params: InsightsParams, take: number): RawEntity[] {
    const exclude = new Set((params["filter.exclude.entities"] ?? "").split(",").map((s) => s.trim()));
    const min = params["filter.popularity.min"] ?? 0;
    const max = params["filter.popularity.max"] ?? 1;
    const youth = params["signal.demographics.age"]?.includes("24_and_younger") ? 1 : 0;
    return [...registry.values()]
      .filter((o) => !o.synthetic && o.id !== a.id && !exclude.has(o.id) && o.popularity >= min && o.popularity <= max)
      .map((o) => {
        const sim = overlap([...a.genres, ...a.vibe], [...o.genres, ...o.vibe]);
        const youthBoost = youth ? (3 - o.agePeak) * 0.04 : 0;
        const affinity = clamp01(0.35 + sim * 1.4 + youthBoost + (rand(`${a.id}:${o.id}`) - 0.5) * 0.2);
        return artistEntity(o, { query: { affinity: round(affinity), explainability: this.explain(a, o.id) } });
      })
      .sort((x, y) => (y.query?.affinity ?? 0) - (x.query?.affinity ?? 0))
      .slice(0, take);
  }

  private brands(a: ArtistRecord, take: number): RawEntity[] {
    const profile = [...a.genres, ...a.vibe];
    return MOCK_BRANDS.map((b) => {
      const hits = b.affinityTo.filter((t) => profile.includes(t)).length;
      const affinity = clamp01(0.3 + hits * 0.2 + (rand(`${a.id}:${b.name}`) - 0.5) * 0.2);
      return {
        name: b.name,
        entity_id: mockId(`brand:${b.name}`),
        type: "urn:entity",
        subtype: "urn:entity:brand",
        popularity: b.popularity,
        properties: { short_description: b.category },
        tags: [{ id: `urn:tag:category:brand:${b.category.toLowerCase().replace(/\W+/g, "_")}`, name: b.category }],
        query: { affinity: round(affinity), explainability: this.explain(a, b.name) },
      } satisfies RawEntity;
    })
      .sort((x, y) => (y.query.affinity ?? 0) - (x.query.affinity ?? 0))
      .slice(0, take);
  }

  private venues(a: ArtistRecord, city: City, params: InsightsParams, take: number): RawEntity[] {
    const min = params["filter.popularity.min"] ?? 0;
    const max = params["filter.popularity.max"] ?? 1;
    const tierPop = { club: 0.62, theatre: 0.8, hall: 0.92 } as const;
    const tierTag = { club: "Club", theatre: "Theatre", hall: "Concert Hall" } as const;
    return (MOCK_VENUES[city.id] ?? [])
      .map(([name, tier, address]) => {
        const seed = `${city.id}:${name}`;
        const popularity = round(clamp01(tierPop[tier] + (rand(seed) - 0.5) * 0.1), 3);
        const fit = 1 - Math.abs(popularity - a.popularity) * 1.4;
        const affinity = round(clamp01(0.45 + fit * 0.4 + (rand(`${a.id}:${seed}`) - 0.5) * 0.2));
        const lat = city.lat + (rand(`${seed}:lat`) - 0.5) * 0.06;
        const lng = city.lng + (rand(`${seed}:lng`) - 0.5) * 0.08;
        return {
          name,
          entity_id: mockId(`place:${seed}`),
          type: "urn:entity",
          subtype: "urn:entity:place",
          popularity,
          location: { lat: round(lat, 5), lon: round(lng, 5), geohash: geohash(lat, lng, 9) },
          properties: {
            address: `${address}, ${city.name}`,
            geocode: { name: city.name, country_code: city.country },
            business_rating: round(3.9 + rand(`${seed}:rating`) * 1.0, 1),
          },
          tags: [
            { id: "urn:tag:category:place:music_venue", name: "Music Venue" },
            { id: `urn:tag:category:place:${tier}`, name: tierTag[tier] },
          ],
          query: { affinity, explainability: this.explain(a, seed) },
        } satisfies RawEntity;
      })
      .filter((v) => v.popularity >= min && v.popularity <= max)
      .sort((x, y) => (y.query.affinity ?? 0) - (x.query.affinity ?? 0))
      .slice(0, take);
  }
}
