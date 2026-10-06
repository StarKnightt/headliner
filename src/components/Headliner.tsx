"use client";

import { PauseIcon, PlayIcon } from "@phosphor-icons/react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { CITY_BY_ID, citiesForRegion, type Region } from "@/lib/cities";
import { classifyOpportunity } from "@/lib/plan/routing";
import { TourPlanSchema, type PlanRequest } from "@/lib/plan/schema";
import { ControlDeck, DEMOS, DemoStrip } from "./ControlDeck";
import type { GlobeMarker, GlobeStop } from "./globe/Globe";
import { Itinerary } from "./Itinerary";
import { PrintSheet } from "./PrintSheet";
import { CallLine, Timeline } from "./Timeline";
import { ModeBadge, OPP_STYLE } from "./ui";
import { useAgentRun } from "./useAgentRun";

const Globe = dynamic(() => import("./globe/Globe"), {
  ssr: false,
  loading: () => <div className="grid h-full w-full place-items-center font-mono text-[11px] text-faint">Loading the night globe…</div>,
});

const DEFAULT_REQUEST: PlanRequest = DEMOS[0].req;
const STORAGE_KEY = "headliner:last-plan:v2";

type Tab = "timeline" | "plan" | "calls";

function regionHome(region: Region | "world") {
  const cs = citiesForRegion(region).filter((c) => c.tier === 1);
  const lat = cs.reduce((s, c) => s + c.lat, 0) / cs.length;
  const lng = cs.reduce((s, c) => s + c.lng, 0) / cs.length;
  return { lat, lng };
}

const DESKTOP = "(min-width: 1024px)";
/** Desktop panels: left column (24 + 312 px) and right panel (440 + 24 px). */
const DESKTOP_INSET = { left: 336, right: 464 };

function useDesktop() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(DESKTOP);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(DESKTOP).matches,
    () => false,
  );
}

const LEGEND: [keyof typeof OPP_STYLE, string][] = [
  ["stronghold", "Stronghold"],
  ["hidden-gem", "Hidden gem"],
  ["emerging", "Emerging"],
  ["long-shot", "Long shot"],
];

export default function Headliner({ qlooMode, agentLabel }: { qlooMode: "live" | "mock"; agentLabel: string }) {
  const { state, start, load } = useAgentRun();
  const [tab, setTab] = useState<Tab>("timeline");
  const [focus, setFocus] = useState<number | null>(null);
  const [region, setRegion] = useState<Region | "world">(DEFAULT_REQUEST.region);
  const [deck, setDeck] = useState<PlanRequest>(DEFAULT_REQUEST);
  const [playing, setPlaying] = useState(false);
  const booted = useRef(false);
  const desktop = useDesktop();

  const plan = state.plan;
  const running = state.status === "running";
  const mode = state.meta?.qloo ?? plan?.mode.qloo ?? qlooMode;

  const run = useCallback(
    (req: PlanRequest, opts: { fresh?: boolean } = {}) => {
      setFocus(null);
      setPlaying(false);
      setTab("timeline");
      setRegion(req.region);
      setDeck(req);
      void start(req, opts);
    },
    [start],
  );

  // Restore the last plan, or run the first demo so a first-time visitor sees a result.
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
        setDeck(parsed.data.request);
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

  const heat = state.heat.length ? state.heat : (plan?.heat ?? []);
  const home = useMemo(() => regionHome(region), [region]);
  const allCalls = useMemo(() => state.steps.flatMap((s) => s.calls ?? []), [state.steps]);
  const cachedCalls = allCalls.filter((c) => c.cached).length;

  const focusStop = (i: number) => {
    setPlaying(false);
    setFocus((f) => (f === i ? null : i));
  };
  const runFresh = state.request ? () => run(state.request!, { fresh: true }) : undefined;

  return (
    <div className="grain min-h-dvh bg-night">
      <div className="screen-only">
        {mode === "mock" && (
          <div className="relative z-40 flex h-7 items-center overflow-hidden lg:fixed lg:inset-x-0 lg:top-0">
            <div className="hazard absolute inset-0 opacity-90" />
            <p className="relative mx-auto rounded-sm bg-night px-2 py-0.5 font-mono text-[10.5px] font-bold uppercase tracking-[0.14em] text-amber">
              No Qloo key configured: showing labelled mock fixtures, not Qloo results
            </p>
          </div>
        )}

        {/* Wordmark: in the flow on phones, floating over the globe on desktop */}
        <header className={`pointer-events-none relative z-30 px-4 pt-4 lg:fixed lg:left-6 lg:px-0 ${mode === "mock" ? "lg:top-11" : "lg:top-5"} lg:pt-0`}>
          <h1 className="font-display text-[44px] font-black uppercase leading-none tracking-[0.04em] text-ink lg:text-[56px]">
            Head<span className="text-sodium">liner</span>
          </h1>
          <p className="mt-1 max-w-[300px] text-[12.5px] leading-snug text-dim">Tour where your fans already are. A booking agent built on Qloo taste data.</p>
          <div className="pointer-events-auto mt-2 flex flex-wrap items-center gap-3">
            <ModeBadge qloo={mode} agent={state.meta?.agent ?? agentLabel} />
            <Link href="/how" className="font-mono text-[11px] text-dim underline-offset-4 hover:text-ink hover:underline">
              How Qloo powers this
            </Link>
          </div>
        </header>

        {/* Globe */}
        <div className={`relative h-[46vh] w-full lg:fixed lg:inset-0 lg:h-auto ${mode === "mock" ? "lg:top-7" : ""}`}>
          <Globe
            markers={markers}
            stops={stops}
            heat={heat}
            focusIndex={focus}
            home={home}
            onSelectStop={focusStop}
            idle={!running && focus === null}
            inset={desktop ? DESKTOP_INSET : undefined}
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-night to-transparent lg:hidden" />
        </div>

        <main className="relative z-20 flex flex-col gap-4 p-4 lg:pointer-events-none lg:fixed lg:inset-0 lg:flex-row lg:items-start lg:justify-between lg:p-6 lg:pt-0">
          {/* Left column */}
          <aside
            className={`scroll-thin w-full space-y-3 lg:pointer-events-auto lg:w-[312px] lg:shrink-0 lg:overflow-y-auto lg:pb-2 lg:pr-1 ${
              mode === "mock" ? "lg:mt-[188px] lg:h-[calc(100dvh-188px-1.5rem)]" : "lg:mt-[160px] lg:h-[calc(100dvh-160px-1.5rem)]"
            }`}
          >
            <DemoStrip running={running} current={state.request} onRun={(r) => run(r)} />
            <ControlDeck key={JSON.stringify(deck)} initial={deck} running={running} onSubmit={(r) => run(r)} onRegionChange={setRegion} />
            <div className="laminate rounded-lg p-3 pt-5">
              <h2 className="mb-2 text-[12.5px] font-semibold text-ink">Reading the globe</h2>
              <ul className="grid grid-cols-2 gap-1.5">
                {LEGEND.map(([k, label]) => (
                  <li key={k} className="flex items-center gap-1.5 text-[11.5px] text-dim">
                    <span className="size-2 rounded-full" style={{ background: OPP_STYLE[k].color }} aria-hidden />
                    {label}
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[11.5px] leading-snug text-dim">
                Gold glow is Qloo&apos;s heatmap: the 40 km cells where this artist&apos;s fans rank highest in the territory. City lights dim so the fans stand out. Pillars
                are stops; columns in a focused city are neighbourhood hotspots, drawn 7× wider.
              </p>
            </div>
          </aside>

          {/* Right panel */}
          <section
            aria-label="Agent run"
            className={`laminate flex w-full flex-col rounded-lg lg:pointer-events-auto lg:w-[440px] lg:shrink-0 ${
              mode === "mock" ? "lg:mt-11 lg:h-[calc(100dvh-3.75rem-1.5rem)]" : "lg:mt-6 lg:h-[calc(100dvh-3rem)]"
            }`}
          >
            <nav className="flex gap-1 border-b border-ink/10 px-3 pb-2 pt-6" role="tablist" aria-label="Run views">
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
                  className={`press micro flex min-h-8 items-center gap-1.5 rounded-sm px-2 py-1.5 ${tab === id ? "bg-ink text-night" : "text-dim hover:text-ink"}`}
                >
                  {label}
                  {n > 0 && <span className={tab === id ? "text-night/60" : "text-faint"}>{n}</span>}
                  {id === "timeline" && running && <span className="pulse-dot size-1.5 rounded-full bg-sodium" aria-hidden />}
                </button>
              ))}
            </nav>
            <div className="scroll-thin flex-1 overflow-y-auto px-4 py-4" role="tabpanel">
              {tab === "timeline" && <Timeline state={state} onRunFresh={runFresh} />}
              {tab === "plan" &&
                (plan ? (
                  <Itinerary plan={plan} focusIndex={focus} onFocus={focusStop} />
                ) : (
                  <div className="space-y-2" aria-busy={running}>
                    <p className="text-[13px] text-dim">{running ? "The agent is still gathering Qloo evidence." : "No plan yet. Pick a demo or route a tour."}</p>
                    {running && [0, 1, 2].map((i) => <div key={i} className="h-24 animate-pulse rounded-md bg-ink/[0.04]" />)}
                  </div>
                ))}
              {tab === "calls" && (
                <div>
                  <p className="mb-3 text-[12px] leading-relaxed text-dim">
                    Every request the agent sent to {mode === "mock" ? "the mock Qloo provider" : "hackathon.api.qloo.com"} on this run
                    {allCalls.length ? `: ${allCalls.length - cachedCalls} live, ${cachedCalls} served from Headliner's cache` : ""}. Requests run server-side; the API key
                    never reaches the browser. Hover a line for the full query.
                  </p>
                  {allCalls.length === 0 && <p className="text-[12px] text-faint">No calls yet{plan ? " (restored plan: run it again to see its calls)" : ""}.</p>}
                  <ol className="space-y-1">
                    {allCalls.map((c, i) => (
                      <CallLine key={i} c={c} index={i} />
                    ))}
                  </ol>
                </div>
              )}
            </div>
          </section>
        </main>

        {/* Stop strip */}
        {plan && (
          <div className="relative z-30 px-4 pb-6 lg:pointer-events-none lg:fixed lg:inset-x-[350px] lg:bottom-6 lg:right-[490px] lg:px-0 lg:pb-0">
            <div className="laminate scroll-thin flex items-center gap-1 overflow-x-auto rounded-lg p-2 pt-5 lg:pointer-events-auto">
              <button
                onClick={() => {
                  setPlaying((p) => !p);
                  setFocus((f) => f ?? 0);
                }}
                className="press inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-sm bg-sodium px-2.5 font-mono text-[11px] font-bold uppercase tracking-wider text-night"
                aria-label={playing ? "Pause tour flythrough" : "Play tour flythrough"}
              >
                {playing ? <PauseIcon size={14} weight="fill" aria-hidden /> : <PlayIcon size={14} weight="fill" aria-hidden />}
                {playing ? "Pause" : "Fly the tour"}
              </button>
              <button
                onClick={() => {
                  setPlaying(false);
                  setFocus(null);
                }}
                className={`press min-h-9 shrink-0 rounded-sm px-2.5 font-mono text-[11px] uppercase ${focus === null ? "bg-ink text-night" : "bg-ink/6 text-dim hover:text-ink"}`}
              >
                All
              </button>
              {plan.stops.map((s, i) => (
                <button
                  key={s.cityId}
                  onClick={() => focusStop(i)}
                  aria-pressed={focus === i}
                  className={`press flex min-h-9 shrink-0 items-center gap-1.5 rounded-sm px-2 text-[12px] ${focus === i ? "bg-ink text-night" : "bg-ink/6 text-ink/80 hover:bg-ink/12"}`}
                >
                  <span className="font-mono text-[10.5px]" style={{ color: focus === i ? undefined : OPP_STYLE[s.opportunity].color }}>
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
