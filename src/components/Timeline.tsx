"use client";

import { ArrowClockwiseIcon } from "@phosphor-icons/react";
import { useEffect, useState } from "react";
import type { ProvenanceRecord } from "@/lib/qloo/service";
import { relativeTime } from "./ui";
import type { RunState, Step } from "./useAgentRun";

const KIND_LABEL = { think: "Agent", tool: "Qloo", validate: "Check" } as const;

/** WKT polygons are long; show the shape type and keep the full value in a tooltip. */
const shortValue = (v: string | number | boolean) => {
  const s = String(v);
  return /^(POLYGON|POINT|MULTIPOLYGON)\(/.test(s) && s.length > 28 ? `${s.slice(0, s.indexOf("(") + 1)}…)` : s;
};

export function formatCall(c: ProvenanceRecord, full = false) {
  const qs = Object.entries(c.params)
    .map(([k, v]) => `${k}=${full ? v : shortValue(v)}`)
    .join("&");
  return `GET ${c.path}?${qs}`;
}

export function CallLine({ c, index }: { c: ProvenanceRecord; index?: number }) {
  return (
    <li className="break-all rounded-sm bg-night/70 px-2 py-1.5 font-mono text-[10.5px] leading-relaxed text-dim" title={formatCall(c, true)}>
      {index !== undefined && <span className="text-faint">{String(index + 1).padStart(2, "0")} </span>}
      <span className={c.error ? "text-alarm" : "text-gem"}>{c.error ? (c.note ? "RETRIED" : "ERR") : `${c.resultCount} res`}</span>{" "}
      <span className="text-faint">{c.cached ? "cache" : `${c.durationMs}ms`}</span> {formatCall(c)}
      {c.mode === "mock" && <span className="ml-1 text-amber">[mock]</span>}
      {c.note && <span className="mt-0.5 block text-faint">{c.note}</span>}
    </li>
  );
}

function StatusIcon({ s }: { s: Step["status"] }) {
  if (s === "running") return <span className="pulse-dot mt-1.5 size-2 shrink-0 rounded-full bg-sodium" aria-label="running" />;
  if (s === "error") return <span className="mt-0.5 shrink-0 font-mono text-[11px] text-alarm" aria-label="error">✕</span>;
  return <span className="mt-0.5 shrink-0 font-mono text-[11px] text-gem" aria-label="done">✓</span>;
}

function StepRow({ step }: { step: Step }) {
  const [open, setOpen] = useState(false);
  const calls = step.calls ?? [];
  const cached = calls.filter((c) => c.cached).length;
  return (
    <li className="rise-in border-l border-ink/10 pb-3 pl-3">
      <div className="flex gap-2">
        <StatusIcon s={step.status} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span className={`micro shrink-0 ${step.kind === "tool" ? "text-sodium" : step.kind === "validate" ? "text-gem" : "text-dim"}`}>{KIND_LABEL[step.kind]}</span>
            <span className="text-[13px] leading-snug text-ink">{step.title}</span>
          </div>
          {step.detail && <p className={`mt-0.5 font-mono text-[11px] leading-relaxed ${step.status === "error" ? "text-alarm/90" : "text-dim"}`}>{step.detail}</p>}
          <div className="mt-0.5 flex items-center gap-3">
            {step.ms !== undefined && (
              <span className="font-mono text-[10.5px] text-faint">{step.ms < 20 && calls.length && cached === calls.length ? "from cache" : `${(step.ms / 1000).toFixed(2)}s`}</span>
            )}
            {calls.length > 0 && (
              <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="font-mono text-[10.5px] text-faint underline-offset-2 hover:text-ink hover:underline">
                {open ? "hide" : "show"} {calls.length} Qloo call{calls.length > 1 ? "s" : ""}
                {cached ? ` (${cached} cached)` : ""}
              </button>
            )}
          </div>
          {open && (
            <ul className="mt-1.5 space-y-1">
              {calls.map((c, i) => (
                <CallLine key={i} c={c} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </li>
  );
}

function useNow(active: boolean) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

export function Timeline({ state, onRunFresh }: { state: RunState; onRunFresh?: () => void }) {
  const now = useNow(state.status === "running");
  const all = state.steps.flatMap((s) => s.calls ?? []);
  const cached = all.filter((c) => c.cached).length;
  const end = state.finishedAt ?? Math.max(now, state.startedAt ?? 0);
  const replayOf = state.meta?.replayOf;
  if (state.status === "idle" && !state.steps.length) {
    return (
      <div className="px-1 py-6 text-[13px] leading-relaxed text-dim">
        <p className="font-display text-2xl font-extrabold uppercase text-ink">Soundcheck</p>
        <p className="mt-2">
          Pick an artist and a territory. The agent resolves the artist in Qloo, reads one heatmap across the whole territory, matches rooms whose crowd fits,
          finds acts with shared fans and brands the audience over-indexes on, then routes the run.
        </p>
        <p className="mt-2">Every step and every Qloo request shows up here.</p>
      </div>
    );
  }
  return (
    <div>
      {replayOf && (
        <div className="mb-3 flex items-center justify-between gap-2 rounded-sm border border-ink/10 bg-ink/[0.03] px-2.5 py-2 text-[12px] text-dim">
          <span>Replay of an identical run from {relativeTime(replayOf)}. Same Qloo calls, same plan.</span>
          {onRunFresh && state.status !== "running" && (
            <button onClick={onRunFresh} className="press inline-flex shrink-0 items-center gap-1 rounded-sm bg-ink/10 px-2 py-1 font-mono text-[11px] text-ink hover:bg-ink/20">
              <ArrowClockwiseIcon size={13} aria-hidden /> Run fresh
            </button>
          )}
        </div>
      )}
      <div className="micro mb-3 flex items-center justify-between text-faint">
        <span>
          {state.steps.length} steps · {all.length} Qloo calls{cached ? `, ${cached} cached` : ""}
        </span>
        {state.startedAt && <span>{((end - state.startedAt) / 1000).toFixed(1)}s</span>}
      </div>
      <ol>
        {state.steps.map((s) => (
          <StepRow key={s.id} step={s} />
        ))}
      </ol>
      {state.error && (
        <div className="mt-2 rounded-sm bg-alarm/10 px-2.5 py-2 text-[12px] text-alarm">
          <p>{state.error}</p>
          {onRunFresh && state.status !== "running" && (
            <button onClick={onRunFresh} className="press mt-1.5 inline-flex items-center gap-1 rounded-sm bg-alarm/15 px-2 py-1 font-mono text-[11px] hover:bg-alarm/25">
              <ArrowClockwiseIcon size={13} aria-hidden /> Try again
            </button>
          )}
        </div>
      )}
    </div>
  );
}
