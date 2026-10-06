import "server-only";
import { defaultStore } from "@/lib/qloo/store";

/** Paid-LLM runs allowed per UTC day across every visitor (OPENAI_DAILY_RUNS overrides). */
export const METERED_RUNS_PER_DAY = Number(process.env.OPENAI_DAILY_RUNS ?? 40);

const day = () => new Date().toISOString().slice(0, 10);
const memory = new Map<string, number>();
const TTL_S = 2 * 24 * 3600;

/** Upstash Redis REST (atomic INCR) when configured; the counter that survives across instances. */
async function upstashIncr(key: string): Promise<number | null> {
  const url = (process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL)?.trim();
  const token = (process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN)?.trim();
  if (!url || !token) return null;
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/pipeline`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify([
        ["INCR", key],
        ["EXPIRE", key, String(TTL_S)],
      ]),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const [incr] = (await res.json()) as { result?: number }[];
    return typeof incr?.result === "number" ? incr.result : null;
  } catch {
    return null;
  }
}

export interface BudgetSlot {
  ok: boolean;
  used: number;
  limit: number;
  store: "upstash" | "runtime-cache" | "disk" | "memory";
}

/**
 * Claims one paid-LLM run for today. Upstash is exact; otherwise the Vercel Runtime Cache (shared, not atomic)
 * and this instance's own count are combined, so concurrent instances may overshoot by a few runs at most.
 */
export async function claimMeteredRun(limit = METERED_RUNS_PER_DAY): Promise<BudgetSlot> {
  const key = `llm-budget:metered:${day()}`;
  if (limit <= 0) return { ok: false, used: 0, limit, store: "memory" };

  const exact = await upstashIncr(key);
  if (exact !== null) return { ok: exact <= limit, used: Math.min(exact, limit), limit, store: "upstash" };

  const store = defaultStore();
  const shared = Number((await store?.get(key)) ?? 0) || 0;
  const used = Math.max(shared, memory.get(key) ?? 0);
  if (used >= limit) return { ok: false, used, limit, store: store?.kind ?? "memory" };
  memory.set(key, used + 1);
  await store?.set(key, used + 1, TTL_S);
  return { ok: true, used: used + 1, limit, store: store?.kind ?? "memory" };
}
