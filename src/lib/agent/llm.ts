import "server-only";
import OpenAI from "openai";

export interface LlmConfig {
  provider: "groq" | "openai" | "custom";
  model: string;
  client: OpenAI;
}

const DEFAULTS = {
  groq: { baseURL: "https://api.groq.com/openai/v1", model: "openai/gpt-oss-120b" },
  openai: { baseURL: undefined as string | undefined, model: "gpt-4.1-mini" },
};

/**
 * OpenAI-compatible client from env. Precedence:
 *   LLM_PROVIDER (groq|openai|custom) + LLM_API_KEY / LLM_BASE_URL / LLM_MODEL, else
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

  const defaults = provider === "custom" ? { baseURL: undefined, model: "" } : DEFAULTS[provider];
  const baseURL = env.LLM_BASE_URL?.trim() || defaults.baseURL;
  const model = env.LLM_MODEL?.trim() || defaults.model;
  if (!model) return null;
  return { provider, model, client: new OpenAI({ apiKey, baseURL, maxRetries: 1, timeout: 45_000 }) };
}
