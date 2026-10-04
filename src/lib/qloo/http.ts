import "server-only";
import { TtlCache } from "./cache";
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

/** Live transport: GET-only, X-Api-Key header, 24h cache, bounded retries on 429/5xx. */
export class HttpQlooTransport implements QlooTransport {
  readonly mode = "live" as const;
  private cache = new TtlCache<unknown>(24 * 60 * 60 * 1000, 2000);

  constructor(
    private readonly apiKey: string,
    private readonly baseUrl = QLOO_BASE_URL,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  private async get<T>(path: string, params: Params, signal?: AbortSignal): Promise<T> {
    const url = `${this.baseUrl}${path}?${buildQuery(params)}`;
    const cached = this.cache.get(url);
    if (cached !== undefined) return cached as T;

    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await this.fetchImpl(url, {
        headers: { "X-Api-Key": this.apiKey, accept: "application/json" },
        signal: signal ?? AbortSignal.timeout(15_000),
      });
      if (res.ok) {
        const body = (await res.json()) as T;
        this.cache.set(url, body);
        return body;
      }
      const text = await res.text().catch(() => "");
      lastError = new QlooError(`Qloo ${path} ${res.status}: ${text.slice(0, 300)}`, res.status, path);
      if (res.status !== 429 && res.status < 500) break;
      await sleep(400 * 2 ** attempt);
    }
    throw lastError;
  }

  search(params: SearchParams, signal?: AbortSignal) {
    return this.get<SearchResponse>("/search", { ...params }, signal);
  }
  insights(params: InsightsParams, signal?: AbortSignal) {
    return this.get<InsightsResponse>("/v2/insights", { ...params }, signal);
  }
  tags(params: TagsParams, signal?: AbortSignal) {
    return this.get<TagsResponse>("/v2/tags", { ...params }, signal);
  }
  audiences(params: AudiencesParams, signal?: AbortSignal) {
    return this.get<AudiencesResponse>("/v2/audiences", { ...params }, signal);
  }
}
