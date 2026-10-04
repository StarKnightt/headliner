"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CITY_BY_ID, citiesForRegion, type Region } from "@/lib/cities";
import { classifyOpportunity } from "@/lib/plan/routing";
import { TourPlanSchema, type PlanRequest } from "@/lib/plan/schema";
import { ControlDeck } from "./ControlDeck";
import type { GlobeMarker, GlobeStop } from "./globe/Globe";
import { Itinerary } from "./Itinerary";
import { PrintSheet } from "./PrintSheet";
import { formatCall, Timeline } from "./Timeline";
import { ModeBadge, OPP_STYLE } from "./ui";
import { useAgentRun } from "./useAgentRun";

const Globe = dynamic(() => import("./globe/Globe"), {
  ssr: false,
  loading: () => <div className="grid h-full w-full place-items-center micro text-faint">Spinning up the globe…</div>,
});

const DEFAULT_REQUEST: PlanRequest = { artist: "Khruangbin", region: "north-america", stops: 7, venueSize: "auto" };
const STORAGE_KEY = "headliner:last-plan:v1";

type Tab = "timeline" | "plan" | "calls";

function regionHome(region: Region | "world") {
  const cs = citiesForRegion(region);
  const lat = cs.reduce((s, c) => s + c.lat, 0) / cs.length;
  const lng = cs.reduce((s, c) => s + c.lng, 0) / cs.length;
  return { lat, lng };
}

export default function Headliner({ qlooMode, agentLabel }: { qlooMode: "live" | "mock"; agentLabel: string }) {
  const { state, start, load } = useAgentRun();
  const [tab, setTab] = useState<Tab>("timeline");
  const [focus, setFocus] = useState<number | null>(null);
  const [region, setRegion] = useState<Region | "world">(DEFAULT_REQUEST.region);
  const [playing, setPlaying] = useState(false);
  const booted = useRef(false);

  const plan = state.plan;
  const running = state.status === "running";
  const mode = state.meta?.qloo ?? plan?.mode.qloo ?? qlooMode;

  const run = useCallback(
    (req: PlanRequest) => {
      setFocus(null);
      setPlaying(false);
      setTab("timeline");
      setRegion(req.region);
      void start(req);
    },
    [start],
  );

  // Restore the last plan, or run the default demo once so first-time visitors see a result.
  useEffect(() => {
    if (booted.current) return;
    booted.current = true;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? TourPlanSchema.safeParse(JSON.parse(raw)) : null;
      if (parsed?.success && parsed.data.mode.qloo === qlooMode) {
        // localStorage is only readable after mount, so this sync has to happen in an effect.
        /* eslint-disable react-hooks/set-state-in-effect */
        load(parsed.data);
        setRegion(parsed.data.request.region);
        setTab("plan");
        /* eslint-enable react-hooks/set-state-in-effect */
        return;
      }
    } catch {
      /* ignore */
    }
    run(DEFAULT_REQUEST);
  }, [load, run, qlooMode]);

  useEffect(() => {
    if (!plan) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(plan));
    } catch {
      /* quota */
    }
  }, [plan]);

  const [seenPlan, setSeenPlan] = useState(plan);
  if (plan !== seenPlan) {
    setSeenPlan(plan);
    if (plan && state.startedAt) setTab("plan");
  }

  useEffect(() => {
    if (!playing || !plan) return;
    const id = setInterval(() => setFocus((f) => (f === null || f >= plan.stops.length - 1 ? 0 : f + 1)), 3800);
    return () => clearInterval(id);
  }, [playing, plan]);

  const markers: GlobeMarker[] = useMemo(() => {
    const scored = state.preview.length
      ? state.preview
      : (plan?.stops.map((s) => ({ cityId: s.cityId, affinity: s.fanAffinity, popularity: s.marketPopularity })) ?? []);
    return scored.flatMap((p) => {
      const c = CITY_BY_ID.get(p.cityId);
      return c ? [{ id: c.id, name: c.name, lat: c.lat, lng: c.lng, affinity: p.affinity, opportunity: classifyOpportunity(p.affinity, p.popularity) }] : [];
    });
  }, [state.preview, plan]);

  const stops: GlobeStop[] = useMemo(
    () =>
      plan?.stops.map((s) => ({
        id: s.cityId,
        name: s.city,
        lat: s.lat,
        lng: s.lng,
        affinity: s.fanAffinity,
        opportunity: s.opportunity,
        order: s.order,
        hotspots: s.hotspots,
      })) ?? [],
    [plan],
  );

  const home = useMemo(() => regionHome(region), [region]);
  const allCalls = useMemo(() => state.steps.flatMap((s) => s.calls ?? []), [state.steps]);

  const focusStop = (i: number) => {
    setPlaying(false);
    setFocus((f) => (f === i ? null : i));
  };

  return (
    <div className="grain min-h-dvh bg-night">
      <div className="screen-only">
        {mode === "mock" && (
          <div className="relative z-40 flex h-7 items-center overflow-hidden lg:fixed lg:inset-x-0 lg:top-0">
            <div className="hazard absolute inset-0 opacity-90" />
            <p className="relative mx-auto rounded-sm bg-night px-2 py-0.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-amber">
              Mock data · no Qloo key configured · scores below are fixtures, not Qloo results
            </p>
          </div>
        )}

        {/* Globe */}
        <div className={`relative h-[56vh] w-full lg:fixed lg:inset-0 lg:h-auto ${mode === "mock" ? "lg:top-7" : ""}`}>
          <Globe markers={markers} stops={stops} focusIndex={focus} home={home} onSelectStop={focusStop} idle={!running && focus === null} />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-night to-transparent lg:hidden" />
        </div>

        {/* Wordmark */}
        <header className={`pointer-events-none absolute left-4 z-30 lg:fixed lg:left-6 ${mode === "mock" ? "top-10 lg:top-11" : "top-4 lg:top-5"}`}>
          <h1 className="font-display text-[44px] font-black uppercase leading-none tracking-[0.04em] text-ink lg:text-[56px]">
            Head<span className="text-sodium">liner</span>
          </h1>
          <p className="micro mt-1 text-dim">Tour where your fans already are · powered by Qloo taste data</p>
          <div className="pointer-events-auto mt-2 flex items-center gap-3">
            <ModeBadge qloo={mode} agent={state.meta?.agent ?? agentLabel} />
            <Link href="/how" className="micro text-dim underline-offset-4 hover:text-ink hover:underline">
              How Qloo powers this →
            </Link>
          </div>
        </header>

        <main className="relative z-20 flex flex-col gap-4 p-4 lg:pointer-events-none lg:fixed lg:inset-0 lg:flex-row lg:items-start lg:justify-between lg:p-6 lg:pt-0">
          {/* Left deck */}
          <aside className={`w-full lg:pointer-events-auto lg:w-[300px] lg:shrink-0 ${mode === "mock" ? "lg:mt-[172px]" : "lg:mt-[150px]"}`}>
            <ControlDeck initial={DEFAULT_REQUEST} running={running} onSubmit={run} onRegionChange={setRegion} />
            <div className="laminate mt-3 hidden rounded-lg p-3 pt-5 lg:block">
              <div className="micro mb-2 text-faint">Legend</div>
              <ul className="grid grid-cols-2 gap-1.5">
                {(Object.keys(OPP_STYLE) as (keyof typeof OPP_STYLE)[]).map((k) => (
                  <li key={k} className="flex items-center gap-1.5 text-[11.5px] text-dim">
                    <span className="size-2 rounded-full" style={{ background: OPP_STYLE[k].color }} />
                    {k === "hidden-gem" ? "Hidden gem" : k === "long-shot" ? "Long shot" : k[0].toUpperCase() + k.slice(1)}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[10.5px] leading-snug text-faint">Dot size = fan affinity. Pillar height = affinity at a stop. Neighbourhood hotspots are drawn at 7× spatial scale.</p>
            </div>
          </aside>

          {/* Right panel */}
          <section className={`laminate flex w-full flex-col rounded-lg lg:pointer-events-auto lg:w-[430px] lg:shrink-0 ${mode === "mock" ? "lg:mt-11 lg:h-[calc(100dvh-3.75rem-1.5rem)]" : "lg:mt-6 lg:h-[calc(100dvh-3rem)]"}`}>
            <nav className="flex gap-1 border-b border-ink/10 px-3 pb-2 pt-6" role="tablist">
              {(
                [
                  ["timeline", "Soundcheck", state.steps.length],
                  ["plan", "Itinerary", plan?.stops.length ?? 0],
                  ["calls", "Qloo calls", allCalls.length],
                ] as const
              ).map(([id, label, n]) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  className={`micro flex items-center gap-1.5 rounded-sm px-2 py-1.5 ${tab === id ? "bg-ink text-night" : "text-dim hover:text-ink"}`}
                >
                  {label}
                  {n > 0 && <span className={tab === id ? "text-night/60" : "text-faint"}>{n}</span>}
                  {id === "timeline" && running && <span className="pulse-dot size-1.5 rounded-full bg-sodium" />}
                </button>
              ))}
            </nav>
            <div className="scroll-thin flex-1 overflow-y-auto px-4 py-4">
              {tab === "timeline" && <Timeline state={state} />}
              {tab === "plan" &&
                (plan ? (
                  <Itinerary plan={plan} focusIndex={focus} onFocus={focusStop} />
                ) : (
                  <p className="text-[13px] text-dim">{running ? "The agent is still gathering evidence…" : "No plan yet."}</p>
                ))}
              {tab === "calls" && (
                <div>
                  <p className="mb-3 text-[12px] leading-relaxed text-dim">
                    Every request the agent sent to {mode === "mock" ? "the mock Qloo provider" : "hackathon.api.qloo.com"} on this run. Requests run server-side; the API
                    key never reaches the browser and is not shown here.
                  </p>
                  {allCalls.length === 0 && <p className="text-[12px] text-faint">No calls yet{plan ? " (restored plan: run again to see calls)" : ""}.</p>}
                  <ol className="space-y-1">
                    {allCalls.map((c, i) => (
                      <li key={i} className="break-all rounded-sm bg-night/70 px-2 py-1.5 font-mono text-[10.5px] leading-relaxed text-dim">
                        <span className="text-faint">{String(i + 1).padStart(2, "0")}</span> <span className={c.error ? "text-alarm" : "text-gem"}>{c.error ? "ERR" : `${c.resultCount} res`}</span>{" "}
                        <span className="text-faint">{c.durationMs}ms</span> {formatCall(c)}
                        {c.mode === "mock" && <span className="ml-1 text-amber">[mock]</span>}
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </div>
          </section>
        </main>

        {/* Stop strip */}
        {plan && (
          <div className="relative z-30 px-4 pb-6 lg:pointer-events-none lg:fixed lg:inset-x-[350px] lg:bottom-6 lg:right-[480px] lg:px-0 lg:pb-0">
            <div className="laminate scroll-thin flex items-center gap-1 overflow-x-auto rounded-lg p-2 pt-5 lg:pointer-events-auto">
              <button
                onClick={() => {
                  setPlaying((p) => !p);
                  setFocus((f) => f ?? 0);
                }}
                className="micro shrink-0 rounded-sm bg-sodium px-2.5 py-2 font-bold text-night"
                aria-label={playing ? "Pause tour flythrough" : "Play tour flythrough"}
              >
                {playing ? "❚❚ Pause" : "▶ Fly the tour"}
              </button>
              <button onClick={() => { setPlaying(false); setFocus(null); }} className={`micro shrink-0 rounded-sm px-2 py-2 ${focus === null ? "bg-ink text-night" : "bg-ink/6 text-dim hover:text-ink"}`}>
                All
              </button>
              {plan.stops.map((s, i) => (
                <button
                  key={s.cityId}
                  onClick={() => focusStop(i)}
                  className={`flex shrink-0 items-center gap-1.5 rounded-sm px-2 py-1.5 text-[12px] ${focus === i ? "bg-ink text-night" : "bg-ink/6 text-ink/80 hover:bg-ink/12"}`}
                >
                  <span className="font-mono text-[10px]" style={{ color: focus === i ? undefined : OPP_STYLE[s.opportunity].color }}>
                    {String(s.order).padStart(2, "0")}
                  </span>
                  {s.city}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {plan && <PrintSheet plan={plan} />}
    </div>
  );
}
