import type { ProvenanceRecord } from "../qloo/service";
import type { TourPlan } from "../plan/schema";

export type StepKind = "think" | "tool" | "validate";

export type AgentEvent =
  /** `replayOf` is set when the run is a replay of a recent identical run (ISO time of the original). */
  | { type: "meta"; qloo: "live" | "mock"; agent: string; replayOf?: string }
  | {
      type: "step";
      id: string;
      kind: StepKind;
      title: string;
      status: "running" | "done" | "error";
      detail?: string;
      calls?: ProvenanceRecord[];
      ms?: number;
    }
  | {
      type: "preview";
      cities: { cityId: string; affinity: number; popularity: number | null }[];
      /** Strongest territory heatmap cells: [lat, lng, affinity]. */
      heat?: [number, number, number][];
    }
  | { type: "plan"; plan: TourPlan }
  | { type: "error"; message: string }
  | { type: "done" };
