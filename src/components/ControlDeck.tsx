"use client";

import { ArrowRightIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { citiesForRegion, REGIONS, type Region } from "@/lib/cities";
import type { PlanRequest } from "@/lib/plan/schema";

/** One-click demos. Each hook is a fact from that territory's live Qloo heatmap. */
export const DEMOS: { hook: string; req: PlanRequest }[] = [
  { hook: "Finds Burlington, VT as a hidden gem", req: { artist: "Khruangbin", region: "north-america", stops: 7, venueSize: "auto" } },
  { hook: "A Punjabi diaspora run through Canada", req: { artist: "AP Dhillon", region: "north-america", stops: 6, venueSize: "auto" } },
  { hook: "Indian indie, booked into theatres", req: { artist: "Prateek Kuhad", region: "india", stops: 6, venueSize: "theatre" } },
  { hook: "Brighton and Bristol outrank their size", req: { artist: "Arlo Parks", region: "uk-ireland", stops: 5, venueSize: "auto" } },
  { hook: "Guadalajara and Tijuana over-index", req: { artist: "Men I Trust", region: "latin-america", stops: 5, venueSize: "club" } },
  { hook: "Bali, Sydney and Melbourne lead", req: { artist: "Peggy Gou", region: "asia-pacific", stops: 7, venueSize: "auto" } },
];

const REGION_LABEL = Object.fromEntries(REGIONS.map((r) => [r.id, r.label]));

const SIZES: { id: PlanRequest["venueSize"]; label: string; hint: string }[] = [
  { id: "auto", label: "Any room", hint: "Qloo live music venues" },
  { id: "club", label: "Club", hint: "Night clubs, jazz clubs and less prominent live rooms" },
  { id: "theatre", label: "Theatre", hint: "Performing arts theatres and concert halls" },
  { id: "hall", label: "Hall", hint: "Arenas, amphitheatres and concert halls" },
];

export function DemoStrip({ running, current, onRun }: { running: boolean; current?: PlanRequest | null; onRun: (r: PlanRequest) => void }) {
  return (
    <div className="laminate rounded-lg p-3 pt-5">
      <h2 className="mb-2 text-[12.5px] font-semibold text-ink">Try a demo run</h2>
      <ul className="grid grid-cols-2 gap-1.5">
        {DEMOS.map((d) => {
          const on = current?.artist === d.req.artist && current?.region === d.req.region;
          return (
            <li key={d.req.artist}>
              <button
                type="button"
                disabled={running}
                onClick={() => onRun(d.req)}
                aria-pressed={on}
                className={`press group flex h-full w-full flex-col items-start rounded-sm px-2 py-1.5 text-left transition-colors duration-150 disabled:cursor-wait ${
                  on ? "bg-sodium text-night" : "bg-ink/[0.05] text-ink hover:bg-ink/10"
                }`}
              >
                <span className="font-display text-[15px] font-extrabold uppercase leading-tight tracking-wide">{d.req.artist}</span>
                <span className={`font-mono text-[10px] ${on ? "text-night/70" : "text-faint"}`}>{REGION_LABEL[d.req.region]}</span>
                <span className={`mt-0.5 text-[11px] leading-snug ${on ? "text-night/85" : "text-dim"}`}>{d.hook}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ControlDeck({
  initial,
  running,
  onSubmit,
  onRegionChange,
}: {
  initial: PlanRequest;
  running: boolean;
  onSubmit: (r: PlanRequest) => void;
  onRegionChange?: (r: Region | "world") => void;
}) {
  const [artist, setArtist] = useState(initial.artist);
  const [region, setRegion] = useState<PlanRequest["region"]>(initial.region);
  const [stops, setStops] = useState(initial.stops);
  const [venueSize, setVenueSize] = useState(initial.venueSize);
  const [startCityId, setStartCityId] = useState(initial.startCityId ?? "");
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [showNotes, setShowNotes] = useState(!!initial.notes);
  const cities = citiesForRegion(region);
  const maxStops = Math.min(12, cities.length);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!artist.trim() || running) return;
    onSubmit({ artist: artist.trim(), region, stops: Math.min(stops, maxStops), venueSize, startCityId: startCityId || undefined, notes: notes.trim() || undefined });
  };

  return (
    <form onSubmit={submit} className="laminate rounded-lg p-4 pt-6">
      <label className="micro mb-1 block text-faint" htmlFor="artist">
        Artist
      </label>
      <input
        id="artist"
        value={artist}
        onChange={(e) => setArtist(e.target.value)}
        placeholder="Who's touring?"
        autoComplete="off"
        spellCheck={false}
        className="w-full border-b border-ink/20 bg-transparent pb-1 font-display text-3xl font-extrabold uppercase tracking-wide text-ink outline-none placeholder:text-faint focus:border-sodium"
      />

      <fieldset className="mt-4">
        <legend className="micro mb-1.5 text-faint">Territory</legend>
        <div className="grid grid-cols-2 gap-1">
          {REGIONS.map((r) => (
            <button
              key={r.id}
              type="button"
              aria-pressed={region === r.id}
              onClick={() => {
                setRegion(r.id);
                setStartCityId("");
                onRegionChange?.(r.id);
              }}
              className={`press min-h-9 rounded-sm px-2 py-1.5 text-left text-[12.5px] transition-colors duration-150 ${
                region === r.id ? "bg-ink text-night" : "bg-ink/5 text-dim hover:bg-ink/10 hover:text-ink"
              } ${r.id === "world" ? "col-span-2" : ""}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </fieldset>

      <div className="mt-4 flex items-end justify-between">
        <label className="micro text-faint" htmlFor="stops">
          Stops
        </label>
        <span className="font-display text-3xl font-black leading-none text-sodium tabular-nums">{String(Math.min(stops, maxStops)).padStart(2, "0")}</span>
      </div>
      <input id="stops" type="range" min={3} max={maxStops} value={Math.min(stops, maxStops)} onChange={(e) => setStops(Number(e.target.value))} className="mt-1 w-full" />

      <fieldset className="mt-3">
        <legend className="micro mb-1.5 text-faint">Room size</legend>
        <div className="grid grid-cols-4 gap-1">
          {SIZES.map((s) => (
            <button
              key={s.id}
              type="button"
              title={s.hint}
              aria-pressed={venueSize === s.id}
              onClick={() => setVenueSize(s.id)}
              className={`press min-h-9 rounded-sm px-1 py-1.5 text-[12px] transition-colors duration-150 ${venueSize === s.id ? "bg-ink text-night" : "bg-ink/5 text-dim hover:bg-ink/10 hover:text-ink"}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className="mt-1 text-[11px] text-faint">{SIZES.find((s) => s.id === venueSize)?.hint}</p>
      </fieldset>

      <label className="micro mb-1.5 mt-3 block text-faint" htmlFor="start">
        Open in
      </label>
      <select
        id="start"
        value={startCityId}
        onChange={(e) => setStartCityId(e.target.value)}
        className="min-h-9 w-full rounded-sm border border-ink/10 bg-night/60 px-2 py-1.5 text-[13px] text-ink outline-none focus:border-sodium"
      >
        <option value="">Shortest route (agent decides)</option>
        {[...cities]
          .sort((a, b) => a.name.localeCompare(b.name))
          .map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
      </select>

      <button type="button" onClick={() => setShowNotes((v) => !v)} aria-expanded={showNotes} className="micro mt-3 text-dim hover:text-ink">
        {showNotes ? "− " : "+ "}Constraints for the agent
      </button>
      {showNotes && (
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={500}
          rows={3}
          aria-label="Constraints for the agent"
          placeholder="e.g. finish in Dublin, only one London date, younger crowd for the openers"
          className="mt-1.5 w-full resize-none rounded-sm border border-ink/10 bg-night/60 px-2 py-1.5 text-[12.5px] text-ink outline-none placeholder:text-faint focus:border-sodium"
        />
      )}

      <button
        type="submit"
        disabled={running || !artist.trim()}
        className="press group mt-4 flex min-h-11 w-full items-center justify-between rounded-sm bg-sodium px-3 py-2.5 font-display text-xl font-extrabold uppercase tracking-wider text-night transition-[filter] duration-150 hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
      >
        <span>{running ? "Routing…" : "Route the tour"}</span>
        <ArrowRightIcon size={20} weight="bold" className="transition-transform duration-200 group-hover:translate-x-1" aria-hidden />
      </button>
    </form>
  );
}
