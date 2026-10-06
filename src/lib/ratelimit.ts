/**
 * Per-instance sliding-window limiter for fresh agent runs. Replays of recorded runs are free; a fresh
 * run spends Qloo quota (10,000 calls a month on the hackathon key) and LLM tokens.
 */
const hits = new Map<string, number[]>();
let active = 0;

export const FRESH_RUNS_PER_WINDOW = Number(process.env.FRESH_RUN_LIMIT ?? (process.env.NODE_ENV === "production" ? 6 : 1000));
const WINDOW_MS = 10 * 60 * 1000;
const MAX_CONCURRENT = Number(process.env.FRESH_RUN_CONCURRENCY ?? 3);

export function clientKey(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return fwd || req.headers.get("x-real-ip") || "local";
}

export function takeFreshRun(key: string): { ok: true; release: () => void } | { ok: false; retryAfterS: number; reason: string } {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= FRESH_RUNS_PER_WINDOW) {
    return { ok: false, retryAfterS: Math.ceil((recent[0] + WINDOW_MS - now) / 1000), reason: `Fresh runs are limited to ${FRESH_RUNS_PER_WINDOW} per 10 minutes so the shared Qloo quota lasts through judging.` };
  }
  if (active >= MAX_CONCURRENT) return { ok: false, retryAfterS: 15, reason: "Several tours are being routed right now. Try again in a few seconds." };
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) hits.delete(hits.keys().next().value!);
  active++;
  let released = false;
  return {
    ok: true,
    release: () => {
      if (!released) active--;
      released = true;
    },
  };
}
