import type { CityAffinity, Demographics, HeatCell, Place, TasteEntity, TasteTag } from "../qloo/domain";
import type { ProvenanceRecord } from "../qloo/service";

/** Everything Qloo returned during one agent run. The final plan may only cite what is in here. */
export class EvidenceLedger {
  artist: TasteEntity | null = null;
  artistCandidates: TasteEntity[] = [];
  cityScores = new Map<string, CityAffinity>();
  venues = new Map<string, Place[]>();
  heat = new Map<string, HeatCell[]>();
  similar = new Map<string, TasteEntity>();
  brands = new Map<string, TasteEntity>();
  demographics: Demographics | null = null;
  tasteTags: TasteTag[] = [];
  venueTagIds: string[] = [];
  calls: ProvenanceRecord[] = [];

  record(calls: ProvenanceRecord[]) {
    this.calls.push(...calls);
  }

  rankedCities(): CityAffinity[] {
    return [...this.cityScores.values()]
      .filter((c) => c.affinity !== null)
      .sort((a, b) => (b.affinity ?? 0) - (a.affinity ?? 0));
  }
}
