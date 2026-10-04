import { planTour } from "@/lib/agent/orchestrator";
import type { AgentEvent } from "@/lib/agent/events";
import { PlanRequestSchema } from "@/lib/plan/schema";

export const maxDuration = 120;

/** POST /api/plan → NDJSON stream of AgentEvents (one JSON object per line). */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = PlanRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (e: AgentEvent) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(e)}\n`));
        } catch {
          /* client went away */
        }
      };
      try {
        const plan = await planTour(parsed.data, emit);
        emit({ type: "plan", plan });
      } catch (err) {
        emit({ type: "error", message: err instanceof Error ? err.message : String(err) });
      } finally {
        emit({ type: "done" });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
}
