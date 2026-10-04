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

  it("can be disabled explicitly", () => {
    expect(getLlm(env({ LLM_PROVIDER: "none", GROQ_API_KEY: "g" }))).toBeNull();
  });
});
