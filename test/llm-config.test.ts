import { describe, expect, it } from "vitest";
import { getLlm } from "@/lib/agent/llm";

const env = (e: Record<string, string>) => e as unknown as NodeJS.ProcessEnv;

describe("getLlm", () => {
  it("returns null with no keys (deterministic planner)", () => {
    expect(getLlm(env({}))).toBeNull();
  });

  it("prefers Groq over OpenAI when both keys exist", () => {
    const c = getLlm(env({ GROQ_API_KEY: "g", OPENAI_API_KEY: "o" }))!;
    expect(c.provider).toBe("groq");
    expect(c.model).toBe("openai/gpt-oss-120b");
    expect(c.client.baseURL).toBe("https://api.groq.com/openai/v1");
    expect(c.models).toEqual(["openai/gpt-oss-120b", "openai/gpt-oss-20b", "qwen/qwen3.8-27b"]);
  });

  it("puts LLM_MODEL first and honours LLM_FALLBACK_MODELS (empty disables fallbacks)", () => {
    expect(getLlm(env({ GROQ_API_KEY: "g", LLM_MODEL: "openai/gpt-oss-20b" }))!.models).toEqual(["openai/gpt-oss-20b", "openai/gpt-oss-120b", "qwen/qwen3.8-27b"]);
    expect(getLlm(env({ GROQ_API_KEY: "g", LLM_FALLBACK_MODELS: "" }))!.models).toEqual(["openai/gpt-oss-120b"]);
  });

  it("honours LLM_PROVIDER and LLM_MODEL overrides", () => {
    const c = getLlm(env({ LLM_PROVIDER: "openai", GROQ_API_KEY: "g", OPENAI_API_KEY: "o", LLM_MODEL: "gpt-x" }))!;
    expect(c.provider).toBe("openai");
    expect(c.model).toBe("gpt-x");
  });

  it("requires base URL key and model for custom providers", () => {
    expect(getLlm(env({ LLM_PROVIDER: "custom", LLM_API_KEY: "k" }))).toBeNull();
    const c = getLlm(env({ LLM_PROVIDER: "custom", LLM_API_KEY: "k", LLM_BASE_URL: "https://llm.example/v1", LLM_MODEL: "m" }))!;
    expect(c.client.baseURL).toBe("https://llm.example/v1");
  });

  it("adds OpenAI as a metered backup behind Groq", () => {
    const c = getLlm(env({ GROQ_API_KEY: "g", OPENAI_API_KEY: "o" }))!;
    expect(c.metered).toBe(false);
    expect(c.backup).toMatchObject({ provider: "openai", model: "gpt-5.6-luna", metered: true });
    expect(getLlm(env({ GROQ_API_KEY: "g", OPENAI_API_KEY: "o", OPENAI_FALLBACK: "0" }))!.backup).toBeUndefined();
    expect(getLlm(env({ GROQ_API_KEY: "g", OPENAI_API_KEY: "o", OPENAI_MODEL: "gpt-5-nano" }))!.backup!.model).toBe("gpt-5-nano");
  });

  it("falls back to metered OpenAI when Groq is selected but its key is gone", () => {
    const c = getLlm(env({ LLM_PROVIDER: "groq", LLM_MODEL: "openai/gpt-oss-120b", OPENAI_API_KEY: "o" }))!;
    expect(c).toMatchObject({ provider: "openai", model: "gpt-5.6-luna", metered: true });
    expect(c.backup).toBeUndefined();
    expect(getLlm(env({ LLM_PROVIDER: "groq" }))).toBeNull();
  });

  it("can be disabled explicitly", () => {
    expect(getLlm(env({ LLM_PROVIDER: "none", GROQ_API_KEY: "g" }))).toBeNull();
  });
});
