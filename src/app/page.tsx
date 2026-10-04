import { connection } from "next/server";
import Headliner from "@/components/Headliner";
import { getLlm } from "@/lib/agent/llm";

export default async function Home() {
  await connection();
  const llm = getLlm();
  return (
    <Headliner
      qlooMode={process.env.QLOO_API_KEY?.trim() ? "live" : "mock"}
      agentLabel={llm ? `${llm.provider}:${llm.model}` : "deterministic"}
    />
  );
}
