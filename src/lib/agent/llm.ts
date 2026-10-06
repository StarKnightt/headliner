import "server-only";
import OpenAI from "openai";

export interface LlmRoute {
  provider: "groq" | "openai" | "custom";
  /** Primary model first, then fallbacks tried on rate limits / provider errors. */
  models: string[];
  model: string;
  client: OpenAI;
  /** Paid per token: every run on this route needs a slot from the daily budget and runs under tighter caps. */
  metered: boolean;
}

export interface LlmConfig extends LlmRoute {
  /** Paid route used only when the primary is rate-limited or unavailable. */
  backup?: LlmRoute;
}

const DEFAULTS = {
  // Groq rate limits are per model, so falling back to a sibling model also sidesteps a 429.
  groq: { baseURL: "https://api.groq.com/openai/v1", models: ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"] },
  // Cheapest current OpenAI model that handles the planner's tool calls well ($0.10 in / $0.60 out per 1M).
  openai: { baseURL: undefined as string | undefined, models: ["gpt-5.6-luna"] },
};

const list = (s: string | undefined) =>
  (s ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

function openaiRoute(env: NodeJS.ProcessEnv, model?: string): LlmRoute | null {
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) return null;
  const primary = model || env.OPENAI_MODEL?.trim() || DEFAULTS.openai.models[0];
  return { provider: "openai", model: primary, models: [primary], client: new OpenAI({ apiKey, maxRetries: 0, timeout: 40_000 }), metered: true };
}

/**
 * OpenAI-compatible client from env. Precedence:
 *   LLM_PROVIDER (groq|openai|custom) + LLM_API_KEY / LLM_BASE_URL / LLM_MODEL / LLM_FALLBACK_MODELS, else
 *   GROQ_API_KEY -> Groq, else OPENAI_API_KEY -> OpenAI, else null (deterministic agent).
 * With Groq primary and OPENAI_API_KEY set, OpenAI (OPENAI_MODEL, default gpt-5.6-luna) is a metered backup;
 * OPENAI_FALLBACK=0 turns the backup off.
 */
export function getLlm(env: NodeJS.ProcessEnv = process.env): LlmConfig | null {
  const explicit = env.LLM_PROVIDER?.trim().toLowerCase();
  if (explicit === "none") return null;
  let provider: LlmRoute["provider"] | null =
    explicit === "groq" || explicit === "openai" || explicit === "custom"
      ? explicit
      : env.GROQ_API_KEY
        ? "groq"
        : env.OPENAI_API_KEY
          ? "openai"
          : null;
  // Groq selected but its key is gone: Groq is disabled and OpenAI (metered) is the only LLM.
  if (provider === "groq" && !env.GROQ_API_KEY?.trim() && !env.LLM_API_KEY?.trim()) provider = env.OPENAI_API_KEY?.trim() ? "openai" : null;
  if (!provider) return null;

  if (provider === "openai" && !env.LLM_API_KEY?.trim() && !env.LLM_BASE_URL?.trim()) {
    const model = env.LLM_MODEL?.trim();
    return openaiRoute(env, model && !model.includes("/") ? model : undefined);
  }

  const apiKey =
    env.LLM_API_KEY?.trim() || (provider === "groq" ? env.GROQ_API_KEY?.trim() : provider === "openai" ? env.OPENAI_API_KEY?.trim() : undefined);
  if (!apiKey) return null;

  const defaults = provider === "custom" ? { baseURL: undefined, models: [] as string[] } : DEFAULTS[provider];
  const baseURL = env.LLM_BASE_URL?.trim() || defaults.baseURL;
  const primary = env.LLM_MODEL?.trim() || defaults.models[0];
  if (!primary) return null;
  const fallbacks = env.LLM_FALLBACK_MODELS !== undefined ? list(env.LLM_FALLBACK_MODELS) : defaults.models;
  const models = [primary, ...fallbacks.filter((m) => m !== primary)];
  const backup = provider === "groq" && env.OPENAI_FALLBACK !== "0" ? (openaiRoute(env) ?? undefined) : undefined;
  return {
    provider,
    model: primary,
    models,
    client: new OpenAI({ apiKey, baseURL, maxRetries: 0, timeout: 40_000 }),
    metered: provider === "openai",
    ...(backup ? { backup } : {}),
  };
}

/** Provider-specific request knobs. Reasoning models spend TPM on hidden reasoning, so keep it low. */
export function modelOptions(model: string): Record<string, unknown> {
  if (model.includes("gpt-oss")) return { reasoning_effort: "low" };
  if (model.startsWith("qwen/")) return { reasoning_effort: "none" };
  // Chat Completions only allows function tools on GPT-5.6+ with reasoning off.
  if (/^gpt-(5\.[6-9]|[6-9])/.test(model)) return { reasoning_effort: "none" };
  if (model.startsWith("gpt-5")) return { reasoning_effort: "minimal" };
  return {};
}

/** USD per 1M tokens (input, cached input, output) for cost logging on metered routes. */
const PRICES: Record<string, [number, number, number]> = {
  "gpt-5.6-luna": [0.1, 0.01, 0.6],
  "gpt-5-nano": [0.05, 0.005, 0.4],
  "gpt-5-mini": [0.25, 0.025, 2],
  "gpt-4.1-nano": [0.1, 0.025, 0.4],
  "gpt-4.1-mini": [0.4, 0.1, 1.6],
};

export function estimateCostUsd(model: string, input: number, cached: number, output: number): number | null {
  const p = PRICES[model];
  return p ? ((input - cached) * p[0] + cached * p[1] + output * p[2]) / 1e6 : null;
}
