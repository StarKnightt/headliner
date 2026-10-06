import "server-only";
import { defaultStore, sha, type DurableStore } from "../qloo/store";
import type { PlanRequest, TourPlan } from "../plan/schema";
import type { AgentEvent } from "./events";

/** A finished run: every event the client saw, in order, with its offset from the start. */
export interface RecordedRun {
  at: string;
  events: { t: number; e: AgentEvent }[];
  plan: TourPlan;
}

const TTL_S = 7 * 24 * 60 * 60;
const memory = new Map<string, RecordedRun>();
let store: DurableStore | null | undefined;
const durable = () => (store === undefined ? (store = defaultStore()) : store);

export function runKey(req: PlanRequest, qloo: "live" | "mock") {
  const norm = { ...req, artist: req.artist.trim().toLowerCase(), notes: req.notes?.trim() || undefined };
  return `plan:v2:${qloo}:${sha(JSON.stringify(norm)).slice(0, 32)}`;
}

export async function getRun(key: string): Promise<RecordedRun | null> {
  const hit = memory.get(key);
  if (hit) return hit;
  const stored = (await durable()?.get(key)) as RecordedRun | null | undefined;
  if (stored?.plan && Array.isArray(stored.events)) {
    if (!stored.plan.mode.agent.includes("fallback")) memory.set(key, stored);
    return stored;
  }
  return null;
}

/** Plans the LLM wrote are kept for a week; deterministic fallbacks only briefly, so a later run can use the LLM. */
export async function putRun(key: string, run: RecordedRun) {
  const fallback = run.plan.mode.agent.includes("fallback");
  if (!fallback) {
    if (memory.size > 200) memory.delete(memory.keys().next().value!);
    memory.set(key, run);
  }
  await durable()?.set(key, run, fallback ? 30 * 60 : TTL_S);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Re-emit a recorded run, compressed to about two seconds so the timeline still reads as a sequence. */
export async function replayRun(run: RecordedRun, emit: (e: AgentEvent) => void) {
  const span = Math.max(1, run.events.at(-1)?.t ?? 1);
  const scale = Math.min(1, 2200 / span);
  let last = 0;
  for (const { t, e } of run.events) {
    const at = t * scale;
    if (at > last) await sleep(Math.min(180, at - last));
    last = at;
    emit(e.type === "meta" ? { ...e, replayOf: run.at } : e);
  }
}
