import type { ProvenanceRecord } from "../qloo/service";
import type { AgentTool, ToolContext } from "./tools";

let seq = 0;
export const stepId = () => `s${Date.now().toString(36)}${(seq++).toString(36)}`;

/** Validate args, run a tool, and emit running/done/error timeline steps with its Qloo calls. */
export async function executeTool(tool: AgentTool, rawArgs: unknown, parent: ToolContext): Promise<{ ok: boolean; result: unknown }> {
  const mine: ProvenanceRecord[] = [];
  const ctx: ToolContext = { ...parent, collect: (c) => mine.push(...c) };
  const parsed = tool.args.safeParse(rawArgs ?? {});
  const id = stepId();
  if (!parsed.success) {
    const msg = parsed.error.issues.map((i) => `${i.path.join(".") || "args"}: ${i.message}`).join("; ");
    ctx.emit({ type: "step", id, kind: "tool", title: `${tool.name}: invalid arguments`, status: "error", detail: msg });
    return { ok: false, result: { error: `Invalid arguments: ${msg}` } };
  }
  const title = tool.title(parsed.data, ctx);
  const t0 = performance.now();
  ctx.emit({ type: "step", id, kind: "tool", title, status: "running" });
  try {
    const { result, detail } = await tool.run(parsed.data, ctx);
    ctx.emit({
      type: "step",
      id,
      kind: "tool",
      title,
      status: "done",
      detail,
      calls: mine,
      ms: Math.round(performance.now() - t0),
    });
    return { ok: true, result };
  } catch (err) {
    const call = (err as { call?: ProvenanceRecord }).call;
    if (call) {
      ctx.ledger.record([call]);
      mine.push(call);
    }
    const message = err instanceof Error ? err.message : String(err);
    ctx.emit({
      type: "step",
      id,
      kind: "tool",
      title,
      status: "error",
      detail: message.slice(0, 240),
      calls: mine,
      ms: Math.round(performance.now() - t0),
    });
    return { ok: false, result: { error: message.slice(0, 500) } };
  }
}
