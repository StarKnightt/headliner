import { getLlm } from "@/lib/agent/llm";

/** Which providers are active. Never returns secrets. */
export function GET() {
  const llm = getLlm();
  return Response.json({
    qloo: process.env.QLOO_API_KEY?.trim() ? "live" : "mock",
    agent: llm ? `${llm.provider}:${llm.model}` : "deterministic",
  });
}
