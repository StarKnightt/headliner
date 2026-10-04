"use client";

import { planToMarkdown } from "@/lib/plan/markdown";
import type { TourPlan } from "@/lib/plan/schema";
import { AGE_LABEL, Meter, ModeBadge, OPP_STYLE, OpportunityChip } from "./ui";

function download(name: string, body: string, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function ExportBar({ plan }: { plan: TourPlan }) {
  const base = `headliner-${slug(plan.artist.name)}`;
  return (
    <div className="flex flex-wrap gap-1">
      <button onClick={() => download(`${base}.md`, planToMarkdown(plan), "text/markdown")} className="micro rounded-sm bg-ink px-2 py-1.5 font-bold text-night hover:bg-sodium">
        ↓ Markdown
      </button>
      <button onClick={() => window.print()} className="micro rounded-sm bg-ink/10 px-2 py-1.5 text-ink hover:bg-ink/20">
        ⎙ Booking sheet
      </button>
      <button onClick={() => download(`${base}.json`, JSON.stringify(plan, null, 2), "application/json")} className="micro rounded-sm bg-ink/10 px-2 py-1.5 text-ink hover:bg-ink/20">
        {"{ }"} JSON
      </button>
    </div>
  );
}

export function Itinerary({ plan, focusIndex, onFocus }: { plan: TourPlan; focusIndex: number | null; onFocus: (i: number) => void }) {
  const maxAge = Math.max(0.01, ...plan.audience.age.map((a) => Math.abs(a.affinity)));
  return (
    <div className="space-y-5">
      <header>
        <div className="mb-2 flex items-center justify-between">
          <ModeBadge qloo={plan.mode.qloo} agent={plan.mode.agent} />
        </div>
        <p className="micro text-sodium">{plan.artist.name} · tour laminate</p>
        <h2 className="mt-1 font-display text-[34px] font-black uppercase leading-[0.92] tracking-wide text-ink">{plan.headline}</h2>
        <div className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-sm bg-ink/10">
          {[
            ["Stops", String(plan.totals.stops)],
            ["Routed", `${plan.totals.distanceKm.toLocaleString("en-US")} km`],
            ["Qloo calls", String(plan.totals.qlooCalls)],
          ].map(([k, v]) => (
            <div key={k} className="bg-deck px-2 py-1.5">
              <div className="micro text-faint">{k}</div>
              <div className="font-mono text-[15px] text-ink">{v}</div>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[13.5px] leading-relaxed text-ink/85">{plan.summary}</p>
        <div className="mt-3">
          <ExportBar plan={plan} />
        </div>
      </header>

      <section>
        <h3 className="micro mb-2 text-dim">The run</h3>
        <ol className="space-y-2">
          {plan.stops.map((s, i) => {
            const active = i === focusIndex;
            return (
              <li key={s.cityId}>
                <button
                  onClick={() => onFocus(i)}
                  className={`w-full rounded-md border text-left transition-colors ${active ? "border-sodium/60 bg-sodium/[0.06]" : "border-ink/10 bg-ink/[0.025] hover:border-ink/25"}`}
                >
                  <div className="flex items-start gap-3 p-3">
                    <span className="font-display text-4xl font-black leading-none tabular-nums" style={{ color: OPP_STYLE[s.opportunity].color }}>
                      {String(s.order).padStart(2, "0")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <span className="font-display text-xl font-extrabold uppercase tracking-wide text-ink">
                          {s.city} <span className="text-faint">{s.country}</span>
                        </span>
                        <OpportunityChip value={s.opportunity} />
                      </div>
                      <div className="mt-1.5 space-y-1">
                        <Meter label="Fan affinity" value={s.fanAffinity} color={OPP_STYLE[s.opportunity].color} />
                        <Meter label="Local pop." value={s.marketPopularity} color="#5d5a52" />
                      </div>
                      <p className="mt-2 text-[12.5px] leading-relaxed text-ink/80">{s.reason}</p>
                    </div>
                  </div>
                  {s.venues.length > 0 && (
                    <div className="perf mx-3 space-y-1.5 py-2.5">
                      {s.venues.map((v) => (
                        <div key={v.id} className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-[13px] font-semibold text-ink">{v.name}</div>
                            {v.address && <div className="truncate font-mono text-[10.5px] text-faint">{v.address}</div>}
                            {active && <div className="mt-0.5 text-[11.5px] leading-snug text-dim">{v.why}</div>}
                          </div>
                          <span className="shrink-0 font-mono text-[11px] text-sodium">{v.affinity === null ? "" : `${Math.round(v.affinity * 100)}`}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="micro flex justify-between border-t border-ink/5 px-3 py-1.5 text-faint">
                    <span>{s.legKm ? `+${s.legKm.toLocaleString("en-US")} km` : "Opening night"}</span>
                    <span>score {s.score}</span>
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      {plan.coHeadliners.length > 0 && (
        <section>
          <h3 className="micro mb-2 text-dim">On the bill</h3>
          <ul className="space-y-2">
            {plan.coHeadliners.map((c) => (
              <li key={c.id} className="rounded-md border border-ink/10 p-3">
                <div className="flex items-center justify-between">
                  <span className="font-display text-lg font-extrabold uppercase text-ink">{c.name}</span>
                  <span className="micro text-dim">{c.role}</span>
                </div>
                <Meter label="Shared fans" value={c.affinity} color="#38e1c6" />
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink/80">{c.why}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {plan.brandPartners.length > 0 && (
        <section>
          <h3 className="micro mb-2 text-dim">Merch & brand partners</h3>
          <ul className="grid gap-2">
            {plan.brandPartners.map((b) => (
              <li key={b.id} className="rounded-md border border-ink/10 p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[14px] font-semibold text-ink">{b.name}</span>
                  <span className="micro text-faint">{b.category}</span>
                </div>
                <Meter label="Affinity" value={b.affinity} color="#f5c84b" />
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink/80">{b.pitch}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="micro mb-2 text-dim">Audience brief (aggregate)</h3>
        {plan.audience.age.length > 0 && (
          <div className="mb-3 grid grid-cols-6 items-end gap-1" aria-label="Age band affinity">
            {plan.audience.age.map((a) => (
              <div key={a.band} className="flex flex-col items-center gap-1">
                <div className="relative flex h-16 w-full items-center justify-center">
                  <div className="absolute inset-x-0 top-1/2 h-px bg-ink/15" />
                  <div
                    className="absolute w-3/5 rounded-[2px]"
                    style={{
                      height: `${(Math.abs(a.affinity) / maxAge) * 50}%`,
                      ...(a.affinity >= 0 ? { bottom: "50%" } : { top: "50%" }),
                      background: a.affinity >= 0 ? "#ff7a1a" : "#5d5a52",
                    }}
                  />
                </div>
                <span className="font-mono text-[10px] text-dim">{AGE_LABEL[a.band] ?? a.band}</span>
              </div>
            ))}
          </div>
        )}
        {plan.audience.tasteTags.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {plan.audience.tasteTags.map((t) => (
              <span key={t.name} className="rounded-sm bg-ink/6 px-1.5 py-0.5 font-mono text-[10.5px] text-ink/80">
                {t.name}
              </span>
            ))}
          </div>
        )}
        <ul className="space-y-1">
          {plan.audience.notes.map((n, i) => (
            <li key={i} className="text-[12.5px] leading-relaxed text-ink/80">
              — {n}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-md border border-ink/10 bg-night/50 p-3">
        <h3 className="micro mb-1.5 text-dim">What this does not tell you</h3>
        <ul className="space-y-1">
          {plan.caveats.map((c, i) => (
            <li key={i} className={`text-[11.5px] leading-relaxed ${c.startsWith("MOCK") ? "font-semibold text-amber" : "text-dim"}`}>
              {c}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
