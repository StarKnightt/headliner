import "server-only";
import { TtlCache } from "./cache";
import { compactInsights, compactSearch, compactTags, expandInsights } from "./compact";
import { responseMeta, type CallMeta } from "./meta";
import { defaultStore, type DurableStore } from "./store";
import {
  QlooError,
  type AudiencesParams,
  type AudiencesResponse,
  type InsightsParams,
  type InsightsResponse,
  type QlooTransport,
  type SearchParams,
  type SearchResponse,
  type TagsParams,
  type TagsResponse,
} from "./types";

export const QLOO_BASE_URL = "https://hackathon.api.qloo.com";

type Params = Record<string, string | number | boolean | undefined>;

export function buildQuery(params: Params): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === "") continue;
    qs.set(k, String(v));
  }
  return qs.toString();
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface QuotaState {
  /** From x-month-ratelimit-* headers; null until the first live response. */
  remaining: number | null;
  limit: number | null;
  checkedAt: number | null;
}

const MEMORY_TTL_MS = 24 * 60 * 60 * 1000;
const DURABLE_TTL_S = 7 * 24 * 60 * 60;

export interface HttpTransportOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  store?: DurableStore | null;
  /** Minimum spacing between live requests. The hackathon key allows 5 per second. */
  minIntervalMs?: number;
  /** Refuse uncached calls when the monthly quota drops below this. */
  minRemaining?: number;
}

/**
 * Live transport: GET-only, X-Api-Key header, request spacing under the per-second limit, bounded
 * retries on 429/5xx, in-flight de-duplication, and two cache tiers (memory, then a durable store).
 */
export class HttpQlooTransport implements QlooTransport {
  readonly mode = "live" as const;
  readonly quota: QuotaState = { remaining: null, limit: null, checkedAt: null };
  private memory = new TtlCache<unknown>(MEMORY_TTL_MS, 1500);
  private inflight = new Map<string, Promise<unknown>>();
  private nextSlot = 0;
  private readonly baseUrl: string;
  private readonly fetchImpl: typeof fetch;
  private readonly store: DurableStore | null;
  private readonly minIntervalMs: number;
  private readonly minRemaining: number;

  constructor(
    private readonly apiKey: string,
    opts: HttpTransportOptions = {},
  ) {
    this.baseUrl = opts.baseUrl ?? QLOO_BASE_URL;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.store = opts.store === undefined ? defaultStore() : opts.store;
    this.minIntervalMs = opts.minIntervalMs ?? 230;
    this.minRemaining = opts.minRemaining ?? Number(process.env.QLOO_MIN_REMAINING ?? 300);
  }

  private async slot() {
    const now = Date.now();
    const at = Math.max(now, this.nextSlot);
    this.nextSlot = at + this.minIntervalMs;
    if (at > now) await sleep(at - now);
  }

  private readQuota(h: Headers) {
    const remaining = Number(h.get("x-month-ratelimit-remaining"));
    const limit = Number(h.get("x-month-ratelimit-limit"));
    if (h.get("x-month-ratelimit-remaining") !== null && Number.isFinite(remaining)) {
      this.quota.remaining = remaining;
      this.quota.limit = Number.isFinite(limit) ? limit : this.quota.limit;
      this.quota.checkedAt = Date.now();
    }
  }

  private async fetchLive<T>(path: string, url: string, signal?: AbortSignal): Promise<T> {
    if (this.quota.remaining !== null && this.quota.remaining < this.minRemaining) {
      throw new QlooError(`Qloo monthly quota is nearly used (${this.quota.remaining} calls left); serving cached results only`, 429, path);
    }
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      await this.slot();
      const res = await this.fetchImpl(url, {
        headers: { "X-Api-Key": this.apiKey, accept: "application/json" },
        signal: signal ?? AbortSignal.timeout(25_000),
      });
      this.readQuota(res.headers);
      if (res.ok) return (await res.json()) as T;
      const text = await res.text().catch(() => "");
      lastError = new QlooError(`Qloo ${path} ${res.status}: ${text.slice(0, 300)}`, res.status, path);
      if (res.status !== 429 && res.status < 500) break;
      const reset = Number(res.headers.get("x-second-ratelimit-reset") ?? res.headers.get("retry-after"));
      const wait = res.status === 429 && Number.isFinite(reset) && reset > 0 ? reset * 1000 + 60 : 500 * 2 ** attempt;
      this.nextSlot = Math.max(this.nextSlot, Date.now() + wait);
      await sleep(wait);
    }
    throw lastError;
  }

  private async get<T extends object>(
    path: string,
    params: Params,
    signal: AbortSignal | undefined,
    pack: (body: T) => T,
    unpack: (body: T) => T = (b) => b,
  ): Promise<T> {
    const url = `${this.baseUrl}${path}?${buildQuery(params)}`;
    const key = `${path}?${buildQuery(params)}`;
    const tag = (body: T, cache: CallMeta["cache"]) => {
      const copy = { ...body };
      responseMeta.set(copy, { cache });
      return copy;
    };

    const hot = this.memory.get(key) as T | undefined;
    if (hot !== undefined) return tag(hot, "memory");
    const pending = this.inflight.get(key) as Promise<T> | undefined;
    if (pending) return tag(await pending, "memory");

    let cacheKind: CallMeta["cache"] = null;
    const work = (async () => {
      const stored = this.store ? ((await this.store.get(key)) as T | null) : null;
      if (stored) {
        const body = unpack(stored);
        this.memory.set(key, body);
        cacheKind = "durable";
        return body;
      }
      const raw = await this.fetchLive<T>(path, url, signal);
      const packed = pack(raw);
      const body = unpack(packed);
      this.memory.set(key, body);
      if (this.store) await this.store.set(key, packed, DURABLE_TTL_S);
      return body;
    })();
    this.inflight.set(key, work);
    try {
      const body = await work;
      return tag(body, cacheKind);
    } finally {
      this.inflight.delete(key);
    }
  }

  search(params: SearchParams, signal?: AbortSignal) {
    return this.get<SearchResponse>("/search", { ...params }, signal, compactSearch);
  }
  insights(params: InsightsParams, signal?: AbortSignal) {
    return this.get<InsightsResponse>("/v2/insights", { ...params }, signal, compactInsights, expandInsights);
  }
  tags(params: TagsParams, signal?: AbortSignal) {
    return this.get<TagsResponse>("/v2/tags", { ...params }, signal, compactTags);
  }
  audiences(params: AudiencesParams, signal?: AbortSignal) {
    return this.get<AudiencesResponse>("/v2/audiences", { ...params }, signal, (b) => b);
  }
}
