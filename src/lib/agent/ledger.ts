import type { CityAffinity, Demographics, HeatCell, Place, TasteEntity, TasteTag } from "../qloo/domain";
import type { ProvenanceRecord } from "../qloo/service";
import { stopScore } from "../plan/routing";

/** Everything Qloo returned during one agent run. The final plan may only cite what is in here. */
export class EvidenceLedger {
  artist: TasteEntity | null = null;
  artistCandidates: TasteEntity[] = [];
  cityScores = new Map<string, CityAffinity>();
  /** Strongest cells of the territory heatmap(s), for the globe. */
  territoryCells: HeatCell[] = [];
  venues = new Map<string, Place[]>();
  /** Locality Qloo resolved each city's name to, from the venue lookups. */
  localities = new Map<string, string>();
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

  /** Cities with data, best Headliner score first. */
  rankedCities(): CityAffinity[] {
    return [...this.cityScores.values()]
      .filter((c) => c.affinity !== null)
      .sort((a, b) => stopScore(b.affinity!, b.popularity) - stopScore(a.affinity!, a.popularity) || (b.affinity ?? 0) - (a.affinity ?? 0));
  }
}
