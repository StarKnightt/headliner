import "server-only";
import OpenAI from "openai";

export interface LlmConfig {
  provider: "groq" | "openai" | "custom";
  /** Primary model first, then fallbacks tried on rate limits / provider errors. */
  models: string[];
  model: string;
  client: OpenAI;
}

const DEFAULTS = {
  // Groq rate limits are per model, so falling back to a sibling model also sidesteps a 429.
  groq: { baseURL: "https://api.groq.com/openai/v1", models: ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"] },
  openai: { baseURL: undefined as string | undefined, models: ["gpt-4.1-mini"] },
};

const list = (s: string | undefined) =>
  (s ?? "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

/**
 * OpenAI-compatible client from env. Precedence:
 *   LLM_PROVIDER (groq|openai|custom) + LLM_API_KEY / LLM_BASE_URL / LLM_MODEL / LLM_FALLBACK_MODELS, else
 *   GROQ_API_KEY -> Groq, else OPENAI_API_KEY -> OpenAI, else null (deterministic agent).
 */
export function getLlm(env: NodeJS.ProcessEnv = process.env): LlmConfig | null {
  const explicit = env.LLM_PROVIDER?.trim().toLowerCase();
  const provider =
    explicit === "groq" || explicit === "openai" || explicit === "custom"
      ? explicit
      : env.GROQ_API_KEY
        ? "groq"
        : env.OPENAI_API_KEY
          ? "openai"
          : null;
  if (!provider || explicit === "none") return null;

  const apiKey =
    env.LLM_API_KEY?.trim() || (provider === "groq" ? env.GROQ_API_KEY?.trim() : provider === "openai" ? env.OPENAI_API_KEY?.trim() : undefined);
  if (!apiKey) return null;

  const defaults = provider === "custom" ? { baseURL: undefined, models: [] as string[] } : DEFAULTS[provider];
  const baseURL = env.LLM_BASE_URL?.trim() || defaults.baseURL;
  const primary = env.LLM_MODEL?.trim() || defaults.models[0];
  if (!primary) return null;
  const fallbacks = env.LLM_FALLBACK_MODELS !== undefined ? list(env.LLM_FALLBACK_MODELS) : defaults.models;
  const models = [primary, ...fallbacks.filter((m) => m !== primary)];
  return { provider, model: primary, models, client: new OpenAI({ apiKey, baseURL, maxRetries: 0, timeout: 40_000 }) };
}

/** Provider-specific request knobs. Reasoning models spend TPM on hidden reasoning, so keep it low. */
export function modelOptions(model: string): Record<string, unknown> {
  if (model.includes("gpt-oss")) return { reasoning_effort: "low" };
  if (model.startsWith("qwen/")) return { reasoning_effort: "none" };
  return {};
}
