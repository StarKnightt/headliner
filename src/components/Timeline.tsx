"use client";

import { useEffect, useState } from "react";
import type { ProvenanceRecord } from "@/lib/qloo/service";
import type { RunState, Step } from "./useAgentRun";

const KIND_LABEL = { think: "Agent", tool: "Qloo", validate: "Check" } as const;

export function formatCall(c: ProvenanceRecord) {
  const qs = Object.entries(c.params)
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  return `GET ${c.path}?${qs}`;
}

function StatusIcon({ s }: { s: Step["status"] }) {
  if (s === "running") return <span className="pulse-dot mt-1 size-2 shrink-0 rounded-full bg-sodium" />;
  if (s === "error") return <span className="mt-0.5 shrink-0 font-mono text-[11px] text-alarm">✕</span>;
  return <span className="mt-0.5 shrink-0 font-mono text-[11px] text-gem">✓</span>;
}

function StepRow({ step }: { step: Step }) {
  const [open, setOpen] = useState(false);
  const calls = step.calls ?? [];
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
            {step.ms !== undefined && <span className="font-mono text-[10px] text-faint">{(step.ms / 1000).toFixed(2)}s</span>}
            {calls.length > 0 && (
              <button onClick={() => setOpen((v) => !v)} className="font-mono text-[10px] text-faint underline-offset-2 hover:text-ink hover:underline">
                {open ? "hide" : "show"} {calls.length} Qloo call{calls.length > 1 ? "s" : ""}
              </button>
            )}
          </div>
          {open && (
            <ul className="mt-1.5 space-y-1">
              {calls.map((c, i) => (
                <li key={i} className="break-all rounded-sm bg-night/70 px-2 py-1 font-mono text-[10px] leading-relaxed text-dim">
                  <span className={c.error ? "text-alarm" : "text-gem"}>{c.error ? "ERR" : c.resultCount}</span> {formatCall(c)}
                  {c.mode === "mock" && <span className="ml-1 text-amber">[mock]</span>}
                </li>
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

export function Timeline({ state }: { state: RunState }) {
  const now = useNow(state.status === "running");
  const calls = state.steps.reduce((n, s) => n + (s.calls?.length ?? 0), 0);
  const end = state.finishedAt ?? Math.max(now, state.startedAt ?? 0);
  if (state.status === "idle" && !state.steps.length) {
    return (
      <div className="px-1 py-6 text-[13px] leading-relaxed text-dim">
        <p className="font-display text-2xl font-extrabold uppercase text-ink">Soundcheck</p>
        <p className="mt-2">
          Pick an artist and a territory. The agent resolves the artist in Qloo, scores fan affinity city by city, maps neighbourhood hotspots, matches venues
          whose crowd fits, finds acts with shared fans and brands the audience over-indexes on, then routes the run.
        </p>
        <p className="mt-2">Every step and every Qloo request shows up here.</p>
      </div>
    );
  }
  return (
    <div>
      <div className="micro mb-3 flex items-center justify-between text-faint">
        <span>
          {state.steps.length} steps · {calls} Qloo calls
        </span>
        {state.startedAt && <span>{((end - state.startedAt) / 1000).toFixed(1)}s</span>}
      </div>
      <ol>
        {state.steps.map((s) => (
          <StepRow key={s.id} step={s} />
        ))}
      </ol>
      {state.error && <p className="mt-2 rounded-sm bg-alarm/10 px-2 py-1.5 font-mono text-[11px] text-alarm">{state.error}</p>}
    </div>
  );
}
