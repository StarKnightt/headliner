"use client";

import { useCallback, useRef, useState } from "react";
import type { AgentEvent } from "@/lib/agent/events";
import type { PlanRequest, TourPlan } from "@/lib/plan/schema";

export type Step = Extract<AgentEvent, { type: "step" }> & { startedAt: number };
export type PreviewCity = Extract<AgentEvent, { type: "preview" }>["cities"][number];

export interface RunState {
  status: "idle" | "running" | "done" | "error";
  steps: Step[];
  preview: PreviewCity[];
  plan: TourPlan | null;
  error: string | null;
  meta: { qloo: "live" | "mock"; agent: string } | null;
  startedAt: number | null;
  finishedAt: number | null;
}

const initial: RunState = { status: "idle", steps: [], preview: [], plan: null, error: null, meta: null, startedAt: null, finishedAt: null };

export function useAgentRun(initialPlan: TourPlan | null = null) {
  const [state, setState] = useState<RunState>(initialPlan ? { ...initial, status: "done", plan: initialPlan } : initial);
  const abort = useRef<AbortController | null>(null);

  const apply = useCallback((e: AgentEvent) => {
    setState((s) => {
      switch (e.type) {
        case "meta":
          return { ...s, meta: { qloo: e.qloo, agent: e.agent } };
        case "step": {
          const idx = s.steps.findIndex((x) => x.id === e.id);
          if (idx === -1) return { ...s, steps: [...s.steps, { ...e, startedAt: Date.now() }] };
          const steps = s.steps.slice();
          steps[idx] = { ...steps[idx], ...e };
          return { ...s, steps };
        }
        case "preview": {
          const map = new Map(s.preview.map((p) => [p.cityId, p]));
          for (const c of e.cities) map.set(c.cityId, c);
          return { ...s, preview: [...map.values()] };
        }
        case "plan":
          return { ...s, plan: e.plan };
        case "error":
          return { ...s, error: e.message, status: "error" };
        case "done":
          return { ...s, status: s.status === "error" ? "error" : "done", finishedAt: Date.now() };
      }
    });
  }, []);

  const start = useCallback(
    async (req: PlanRequest) => {
      abort.current?.abort();
      const ctrl = new AbortController();
      abort.current = ctrl;
      setState({ ...initial, status: "running", startedAt: Date.now() });
      try {
        const res = await fetch("/api/plan", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(req),
          signal: ctrl.signal,
        });
        if (!res.ok || !res.body) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error ?? `Request failed (${res.status})`);
        }
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (line) apply(JSON.parse(line) as AgentEvent);
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setState((s) => ({ ...s, status: "error", error: (err as Error).message, finishedAt: Date.now() }));
      }
    },
    [apply],
  );

  const load = useCallback((plan: TourPlan) => setState({ ...initial, status: "done", plan }), []);

  return { state, start, load };
}
