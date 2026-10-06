import { planTour } from "@/lib/agent/orchestrator";
import type { AgentEvent } from "@/lib/agent/events";
import { getRun, putRun, replayRun, runKey, type RecordedRun } from "@/lib/agent/replay";
import { getQloo } from "@/lib/qloo";
import { scopedHeadline } from "@/lib/plan/hydrate";
import { PlanRequestSchema } from "@/lib/plan/schema";
import { clientKey, takeFreshRun } from "@/lib/ratelimit";

export const maxDuration = 120;

/**
 * POST /api/plan → NDJSON stream of AgentEvents (one JSON object per line).
 * An identical request from the last 7 days is replayed from its recording unless `fresh: true`.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = PlanRequestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ") }, { status: 400 });
  }
  const request = parsed.data;
  const fresh = (body as { fresh?: unknown }).fresh === true;
  const key = runKey(request, getQloo().mode);
  const recorded = fresh ? null : await getRun(key);

  let release = () => {};
  if (!recorded) {
    const slot = takeFreshRun(clientKey(req));
    if (!slot.ok) return Response.json({ error: slot.reason }, { status: 429, headers: { "retry-after": String(slot.retryAfterS) } });
    release = slot.release;
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
        if (recorded) {
          await replayRun(recorded, emit);
          emit({ type: "plan", plan: { ...recorded.plan, headline: scopedHeadline(recorded.plan.headline, recorded.plan.request.region) } });
          return;
        }
        const t0 = Date.now();
        const events: RecordedRun["events"] = [];
        const plan = await planTour(request, (e) => {
          events.push({ t: Date.now() - t0, e });
          emit(e);
        });
        emit({ type: "plan", plan });
        await putRun(key, { at: new Date().toISOString(), events, plan });
      } catch (err) {
        emit({ type: "error", message: err instanceof Error ? err.message : String(err) });
      } finally {
        release();
        emit({ type: "done" });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" },
  });
}
