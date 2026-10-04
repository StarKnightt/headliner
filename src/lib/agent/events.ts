import type { ProvenanceRecord } from "../qloo/service";
import type { TourPlan } from "../plan/schema";

export type StepKind = "think" | "tool" | "validate";

export type AgentEvent =
  | { type: "meta"; qloo: "live" | "mock"; agent: string }
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
  | { type: "preview"; cities: { cityId: string; affinity: number; popularity: number | null }[] }
  | { type: "plan"; plan: TourPlan }
  | { type: "error"; message: string }
  | { type: "done" };
