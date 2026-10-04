import { z } from "zod";

const unit = z.number().min(0).max(1);
const regionIds = ["north-america", "latin-america", "europe", "uk-ireland", "asia-pacific", "india", "world"] as const;

export const PlanRequestSchema = z.object({
  artist: z.string().trim().min(1).max(120),
  region: z.enum(regionIds).default("north-america"),
  stops: z.number().int().min(3).max(12).default(7),
  venueSize: z.enum(["auto", "club", "theatre", "hall"]).default("auto"),
  startCityId: z.string().max(10).optional(),
  notes: z.string().max(500).optional(),
});
export type PlanRequest = z.infer<typeof PlanRequestSchema>;

export const OpportunitySchema = z.enum(["stronghold", "hidden-gem", "emerging", "long-shot"]);
export type Opportunity = z.infer<typeof OpportunitySchema>;

export const VenueSchema = z.object({
  id: z.string(),
  name: z.string(),
  address: z.string().nullable(),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  affinity: unit.nullable(),
  popularity: unit.nullable(),
  why: z.string(),
});

export const HotspotSchema = z.object({ lat: z.number(), lng: z.number(), affinity: unit });

export const StopSchema = z.object({
  order: z.number().int().min(1),
  cityId: z.string(),
  city: z.string(),
  country: z.string().length(2),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  fanAffinity: unit,
  marketPopularity: unit.nullable(),
  opportunity: OpportunitySchema,
  score: z.number().min(0).max(100),
  reason: z.string().min(1),
  venues: z.array(VenueSchema).max(5),
  hotspots: z.array(HotspotSchema).max(60),
  legKm: z.number().min(0),
  qlooLocality: z.string().nullable(),
});
export type Stop = z.infer<typeof StopSchema>;

export const TourPlanSchema = z.object({
  version: z.literal(1),
  generatedAt: z.string(),
  mode: z.object({
    qloo: z.enum(["live", "mock"]),
    agent: z.string(),
  }),
  request: PlanRequestSchema,
  artist: z.object({
    id: z.string(),
    name: z.string(),
    popularity: unit.nullable(),
    description: z.string().nullable(),
  }),
  headline: z.string().min(1).max(140),
  summary: z.string().min(1),
  stops: z.array(StopSchema).min(1).max(12),
  coHeadliners: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        role: z.enum(["co-headliner", "support"]),
        affinity: unit.nullable(),
        popularity: unit.nullable(),
        why: z.string(),
      }),
    )
    .max(6),
  brandPartners: z
    .array(
      z.object({
        id: z.string(),
        name: z.string(),
        category: z.string().nullable(),
        affinity: unit.nullable(),
        pitch: z.string(),
      }),
    )
    .max(6),
  audience: z.object({
    age: z.array(z.object({ band: z.string(), affinity: z.number().min(-1).max(1) })),
    gender: z.object({ male: z.number().min(-1).max(1).nullable(), female: z.number().min(-1).max(1).nullable() }),
    tasteTags: z.array(z.object({ name: z.string(), affinity: unit.nullable() })).max(16),
    notes: z.array(z.string()).max(6),
  }),
  totals: z.object({ stops: z.number().int(), distanceKm: z.number().min(0), qlooCalls: z.number().int().min(0) }),
  caveats: z.array(z.string()),
});
export type TourPlan = z.infer<typeof TourPlanSchema>;

/**
 * What the LLM submits. It may only reference IDs that the tools returned; numbers, coordinates
 * and routing are filled in server-side from the evidence ledger (see hydrate.ts).
 */
export const PlanDraftSchema = z.object({
  headline: z.string().min(1).max(140).describe("Poster-style tour title, max ~10 words"),
  summary: z.string().min(1).max(900).describe("2-4 sentences: the routing logic, grounded in the Qloo evidence"),
  stops: z
    .array(
      z.object({
        cityId: z.string().describe("cityId exactly as returned by score_cities"),
        reason: z.string().min(1).max(320).describe("Why this city, citing the fan affinity / popularity numbers"),
        venueIds: z.array(z.string()).max(3).describe("venue ids returned by find_venues for this city, best first"),
        venueNotes: z.array(z.string().max(200)).max(3).optional().describe("one short note per venueId, same order"),
      }),
    )
    .min(1)
    .max(12),
  coHeadliners: z
    .array(
      z.object({
        id: z.string().describe("artist id from similar_artists"),
        role: z.enum(["co-headliner", "support"]),
        why: z.string().max(240),
      }),
    )
    .max(4),
  brandPartners: z
    .array(z.object({ id: z.string().describe("brand id from brand_affinities"), pitch: z.string().max(240) }))
    .max(4),
  audienceNotes: z.array(z.string().max(240)).max(4).describe("Briefing notes for poster/merch designers, aggregate only"),
  caveats: z.array(z.string().max(240)).max(4).optional(),
});
export type PlanDraft = z.infer<typeof PlanDraftSchema>;
