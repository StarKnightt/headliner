import "server-only";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { getCache } from "@vercel/functions";

/** Durable second-tier cache for Qloo responses, shared across function instances and deploys. */
export interface DurableStore {
  readonly kind: "runtime-cache" | "disk";
  get(key: string): Promise<unknown | null>;
  set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
}

export const sha = (s: string) => createHash("sha256").update(s).digest("hex");

/** Vercel Runtime Cache (regional, survives deploys, LRU-evicted, 2 MB per item). */
class RuntimeCacheStore implements DurableStore {
  readonly kind = "runtime-cache" as const;
  private cache = getCache({ namespace: "headliner", keyHashFunction: sha });
  async get(key: string) {
    try {
      return await this.cache.get(key);
    } catch {
      return null;
    }
  }
  async set(key: string, value: unknown, ttlSeconds: number) {
    try {
      await this.cache.set(key, value, { ttl: ttlSeconds, name: key.split("?")[0] });
    } catch {
      /* oversize or unavailable: the in-memory tier still has it */
    }
  }
}

/** Local development cache under .cache/qloo (gitignored) so restarts don't spend API quota. */
class DiskStore implements DurableStore {
  readonly kind = "disk" as const;
  constructor(private readonly dir: string) {}
  private file(key: string) {
    return path.join(this.dir, `${sha(key).slice(0, 40)}.json`);
  }
  async get(key: string) {
    try {
      const { exp, value } = JSON.parse(await readFile(this.file(key), "utf8")) as { exp: number; value: unknown };
      return exp > Date.now() ? value : null;
    } catch {
      return null;
    }
  }
  async set(key: string, value: unknown, ttlSeconds: number) {
    try {
      await mkdir(this.dir, { recursive: true });
      await writeFile(this.file(key), JSON.stringify({ exp: Date.now() + ttlSeconds * 1000, value }));
    } catch {
      /* read-only filesystem */
    }
  }
}

export function defaultStore(): DurableStore | null {
  if (process.env.QLOO_DURABLE_CACHE === "0") return null;
  if (process.env.VERCEL) return new RuntimeCacheStore();
  return new DiskStore(path.join(process.cwd(), ".cache", "qloo"));
}
