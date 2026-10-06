import { beforeAll, describe, expect, it } from "vitest";
import type { RecordedRun } from "@/lib/agent/replay";
import type { TourPlan } from "@/lib/plan/schema";

let replay: typeof import("@/lib/agent/replay");

beforeAll(async () => {
  process.env.QLOO_DURABLE_CACHE = "0";
  replay = await import("@/lib/agent/replay");
});

const run = (agent: string, at: string): RecordedRun => ({
  at,
  events: [{ t: 0, e: { type: "meta", qloo: "live", agent } }],
  plan: { mode: { qloo: "live", agent }, request: { artist: "Khruangbin", region: "north-america", stops: 7, venueSize: "auto" } } as unknown as TourPlan,
});

describe("run recordings", () => {
  const req = { artist: " Khruangbin ", region: "north-america" as const, stops: 7, venueSize: "auto" as const };

  it("keys identical requests together regardless of artist case and spacing", () => {
    expect(replay.runKey(req, "live")).toBe(replay.runKey({ ...req, artist: "khruangbin" }, "live"));
    expect(replay.runKey(req, "live")).not.toBe(replay.runKey(req, "mock"));
    expect(replay.runKey(req, "live")).not.toBe(replay.runKey({ ...req, stops: 6 }, "live"));
  });

  it("never replaces a plan the LLM wrote with a deterministic fallback", async () => {
    const key = replay.runKey(req, "live");
    await replay.putRun(key, run("groq:openai/gpt-oss-120b", "2026-10-06T08:00:00Z"));
    await replay.putRun(key, run("groq:openai/gpt-oss-120b → deterministic fallback", "2026-10-06T09:00:00Z"));
    expect((await replay.getRun(key))?.at).toBe("2026-10-06T08:00:00Z");
    await replay.putRun(key, run("groq:openai/gpt-oss-20b", "2026-10-06T10:00:00Z"));
    expect((await replay.getRun(key))?.plan.mode.agent).toBe("groq:openai/gpt-oss-20b");
  });

  it("marks replayed meta events with the original run time", async () => {
    const seen: unknown[] = [];
    await replay.replayRun(run("groq:openai/gpt-oss-120b", "2026-10-06T08:00:00Z"), (e) => seen.push(e));
    expect(seen[0]).toMatchObject({ type: "meta", replayOf: "2026-10-06T08:00:00Z" });
  });
});
