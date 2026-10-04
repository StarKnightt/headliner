"use client";

import { useState } from "react";
import { citiesForRegion, REGIONS, type Region } from "@/lib/cities";
import type { PlanRequest } from "@/lib/plan/schema";

export const PRESET_ARTISTS = ["Khruangbin", "Japanese Breakfast", "Prateek Kuhad", "Fred again..", "Men I Trust", "Hiatus Kaiyote"];

const SIZES: { id: PlanRequest["venueSize"]; label: string; hint: string }[] = [
  { id: "auto", label: "Auto", hint: "from artist popularity" },
  { id: "club", label: "Club", hint: "≤ 72nd pct venues" },
  { id: "theatre", label: "Theatre", hint: "68–90th pct" },
  { id: "hall", label: "Hall", hint: "≥ 85th pct" },
];

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
  const [showNotes, setShowNotes] = useState(false);
  const cities = citiesForRegion(region);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!artist.trim() || running) return;
    onSubmit({ artist: artist.trim(), region, stops: Math.min(stops, cities.length), venueSize, startCityId: startCityId || undefined, notes: notes.trim() || undefined });
  };

  return (
    <form onSubmit={submit} className="laminate rounded-lg p-4 pt-6">
      <div className="micro mb-3 flex items-center justify-between text-dim">
        <span>Book a run</span>
        <span className="text-faint">step 01</span>
      </div>

      <label className="micro mb-1 block text-faint" htmlFor="artist">
        Artist
      </label>
      <input
        id="artist"
        value={artist}
        onChange={(e) => setArtist(e.target.value)}
        placeholder="Who's touring?"
        autoComplete="off"
        className="w-full border-b border-ink/20 bg-transparent pb-1 font-display text-3xl font-extrabold uppercase tracking-wide text-ink outline-none placeholder:text-faint focus:border-sodium"
      />
      <div className="mt-2 flex flex-wrap gap-1">
        {PRESET_ARTISTS.map((a) => (
          <button
            key={a}
            type="button"
            onClick={() => setArtist(a)}
            className={`rounded-sm px-1.5 py-0.5 font-mono text-[10.5px] transition-colors ${
              artist === a ? "bg-sodium text-night" : "bg-ink/6 text-dim hover:bg-ink/12 hover:text-ink"
            }`}
          >
            {a}
          </button>
        ))}
      </div>

      <div className="micro mb-1.5 mt-4 text-faint">Territory</div>
      <div className="grid grid-cols-2 gap-1">
        {REGIONS.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => {
              setRegion(r.id);
              setStartCityId("");
              onRegionChange?.(r.id);
            }}
            className={`rounded-sm px-2 py-1.5 text-left text-[12.5px] transition-colors ${
              region === r.id ? "bg-ink text-night" : "bg-ink/5 text-dim hover:bg-ink/10 hover:text-ink"
            } ${r.id === "world" ? "col-span-2" : ""}`}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="mt-4 flex items-end justify-between">
        <label className="micro text-faint" htmlFor="stops">
          Stops
        </label>
        <span className="font-display text-3xl font-black leading-none text-sodium tabular-nums">{String(Math.min(stops, cities.length)).padStart(2, "0")}</span>
      </div>
      <input id="stops" type="range" min={3} max={Math.min(12, cities.length)} value={Math.min(stops, cities.length)} onChange={(e) => setStops(Number(e.target.value))} className="mt-1 w-full" />

      <div className="micro mb-1.5 mt-3 text-faint">Room size</div>
      <div className="grid grid-cols-4 gap-1">
        {SIZES.map((s) => (
          <button
            key={s.id}
            type="button"
            title={s.hint}
            onClick={() => setVenueSize(s.id)}
            className={`rounded-sm px-1 py-1.5 text-[12px] transition-colors ${venueSize === s.id ? "bg-ink text-night" : "bg-ink/5 text-dim hover:bg-ink/10 hover:text-ink"}`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <label className="micro mb-1.5 mt-3 block text-faint" htmlFor="start">
        Open in
      </label>
      <select
        id="start"
        value={startCityId}
        onChange={(e) => setStartCityId(e.target.value)}
        className="w-full rounded-sm border border-ink/10 bg-night/60 px-2 py-1.5 text-[13px] text-ink outline-none focus:border-sodium"
      >
        <option value="">Strongest market (agent decides)</option>
        {cities.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <button type="button" onClick={() => setShowNotes((v) => !v)} className="micro mt-3 text-dim hover:text-ink">
        {showNotes ? "− " : "+ "}Constraints for the agent
      </button>
      {showNotes && (
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="e.g. avoid Texas in August, we want one festival-adjacent date, younger crowd for openers"
          className="mt-1.5 w-full resize-none rounded-sm border border-ink/10 bg-night/60 px-2 py-1.5 text-[12.5px] text-ink outline-none placeholder:text-faint focus:border-sodium"
        />
      )}

      <button
        type="submit"
        disabled={running || !artist.trim()}
        className="group mt-4 flex w-full items-center justify-between rounded-sm bg-sodium px-3 py-2.5 font-display text-xl font-extrabold uppercase tracking-wider text-night transition hover:brightness-110 disabled:cursor-wait disabled:opacity-60"
      >
        <span>{running ? "Routing…" : "Route the tour"}</span>
        <span className="transition-transform group-hover:translate-x-1">→</span>
      </button>
    </form>
  );
}
