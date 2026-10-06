"use client";

import { ArrowUpRightIcon, BracketsCurlyIcon, DownloadSimpleIcon, MapPinIcon, PrinterIcon } from "@phosphor-icons/react";
import { planToMarkdown } from "@/lib/plan/markdown";
import { topShare } from "@/lib/plan/routing";
import type { TourPlan } from "@/lib/plan/schema";
import { AGE_LABEL, ModeBadge, OPP_STYLE, OpportunityChip, RankBars, TAG_GROUPS } from "./ui";

function download(name: string, body: string, type: string) {
  const url = URL.createObjectURL(new Blob([body], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const popPhrase = (p: number | null) => (p === null ? "popularity n/a" : p >= 0.5 ? `${topShare(p)} of artists` : `popularity ${p.toFixed(2)}`);

export function ExportBar({ plan }: { plan: TourPlan }) {
  const base = `headliner-${slug(plan.artist.name)}`;
  const btn = "press inline-flex min-h-8 items-center gap-1.5 rounded-sm px-2.5 font-mono text-[11px]";
  return (
    <div className="flex flex-wrap gap-1.5">
      <button onClick={() => download(`${base}.md`, planToMarkdown(plan), "text/markdown")} className={`${btn} bg-ink font-semibold text-night hover:bg-sodium`}>
        <DownloadSimpleIcon size={14} weight="bold" aria-hidden /> Markdown
      </button>
      <button onClick={() => window.print()} className={`${btn} bg-ink/10 text-ink hover:bg-ink/20`}>
        <PrinterIcon size={14} aria-hidden /> Booking sheet
      </button>
      <button onClick={() => download(`${base}.json`, JSON.stringify(plan, null, 2), "application/json")} className={`${btn} bg-ink/10 text-ink hover:bg-ink/20`}>
        <BracketsCurlyIcon size={14} aria-hidden /> JSON
      </button>
    </div>
  );
}

export function Itinerary({ plan, focusIndex, onFocus }: { plan: TourPlan; focusIndex: number | null; onFocus: (i: number) => void }) {
  const maxAge = Math.max(0.01, ...plan.audience.age.map((a) => Math.abs(a.affinity)));
  const gems = plan.stops.filter((s) => s.opportunity === "hidden-gem").length;
  return (
    <div className="space-y-6">
      <header>
        <ModeBadge qloo={plan.mode.qloo} agent={plan.mode.agent} />
        <h2 className="mt-3 font-display text-[34px] font-black uppercase leading-[0.92] tracking-wide text-ink">{plan.headline}</h2>
        <dl className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-sm bg-ink/10">
          {[
            ["Stops", `${plan.totals.stops}${gems ? ` · ${gems} gem${gems > 1 ? "s" : ""}` : ""}`],
            ["Routed", `${plan.totals.distanceKm.toLocaleString("en-US")} km`],
            ["Qloo calls", `${plan.totals.qlooCalls}`],
          ].map(([k, v]) => (
            <div key={k} className="bg-deck px-2.5 py-2">
              <dt className="micro text-faint">{k}</dt>
              <dd className="font-mono text-[15px] text-ink">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-[13.5px] leading-relaxed text-ink/85">{plan.summary}</p>
        <div className="mt-3">
          <ExportBar plan={plan} />
        </div>
      </header>

      <section aria-labelledby="run-h">
        <h3 id="run-h" className="micro mb-2 text-dim">
          The run, from {plan.totals.candidates || "the"} candidate cities
        </h3>
        <ol className="space-y-2">
          {plan.stops.map((s, i) => {
            const active = i === focusIndex;
            const color = OPP_STYLE[s.opportunity].color;
            return (
              <li key={s.cityId}>
                <div
                  className={`rounded-md border transition-colors duration-200 ${active ? "border-sodium/60 bg-sodium/[0.05]" : "border-ink/10 bg-ink/[0.02] hover:border-ink/25"}`}
                >
                  <button onClick={() => onFocus(i)} aria-pressed={active} className="flex w-full items-start gap-3 p-3 text-left">
                    <span className="font-display text-4xl font-black leading-none tabular-nums" style={{ color }}>
                      {String(s.order).padStart(2, "0")}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center justify-between gap-1">
                        <span className="font-display text-xl font-extrabold uppercase tracking-wide text-ink">
                          {s.city} <span className="text-faint">{s.country}</span>
                        </span>
                        <OpportunityChip value={s.opportunity} />
                      </span>
                      <span className="mt-1 flex items-baseline gap-1.5">
                        <span className="font-mono text-[17px] font-medium tabular-nums text-ink">Top {topShare(s.fanAffinity).replace("top ", "")}</span>
                        <span className="text-[12px] text-dim">of {s.area} for these fans</span>
                      </span>
                      <span className="mt-2 block">
                        <RankBars affinity={s.fanAffinity} popularity={s.marketPopularity} color={color} />
                      </span>
                      <span className="mt-2 block text-[12.5px] leading-relaxed text-ink/80">{s.reason}</span>
                      {s.peak && (
                        <span className="mt-1.5 flex items-center gap-1 text-[11.5px] text-gem">
                          <MapPinIcon size={13} weight="fill" aria-hidden />
                          Fans peak {s.peak.km} km out ({topShare(s.peak.affinity)})
                        </span>
                      )}
                    </span>
                  </button>
                  {s.venues.length > 0 && (
                    <ul className="perf mx-3 space-y-2 py-2.5">
                      {s.venues.map((v) => (
                        <li key={v.id} className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-1 text-[13px] font-semibold text-ink">
                              {v.name}
                              {v.website && (
                                <a href={v.website} target="_blank" rel="noreferrer noopener" className="text-faint hover:text-sodium" aria-label={`${v.name} website`}>
                                  <ArrowUpRightIcon size={12} weight="bold" />
                                </a>
                              )}
                            </div>
                            <div className="truncate text-[11.5px] text-dim">{[v.kind ?? v.category, v.neighborhood].filter(Boolean).join(", ") || v.address}</div>
                            {active && <div className="mt-0.5 text-[11.5px] leading-snug text-ink/70">{v.why}</div>}
                          </div>
                          <span className="shrink-0 font-mono text-[11px] tabular-nums text-sodium" title="Qloo place affinity for this audience">
                            {v.affinity === null ? "" : v.affinity.toFixed(3)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {s.venues.length === 0 && <p className="perf mx-3 py-2.5 text-[11.5px] text-dim">Qloo returned no matching rooms here. Book this date through a local promoter.</p>}
                  <div className="flex flex-wrap justify-between gap-x-3 gap-y-0.5 border-t border-ink/5 px-3 py-1.5 font-mono text-[10.5px] text-faint">
                    <span>{s.legKm ? `+${s.legKm.toLocaleString("en-US")} km` : "Opening night"}</span>
                    {s.qlooLocality && <span className="truncate" title="Locality Qloo resolved this city to">{s.qlooLocality}</span>}
                    <span>score {s.score}</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {plan.coHeadliners.length > 0 && (
        <section>
          <h3 className="mb-2 font-display text-lg font-extrabold uppercase text-ink">On the bill</h3>
          <ul className="space-y-2">
            {plan.coHeadliners.map((c) => (
              <li key={c.id} className="rounded-md border border-ink/10 p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-display text-lg font-extrabold uppercase text-ink">{c.name}</span>
                  <span className="micro text-dim">{c.role}</span>
                </div>
                <div className="mt-0.5 font-mono text-[11px] text-dim">
                  shared-audience affinity <span className="text-gem">{c.affinity === null ? "n/a" : c.affinity.toFixed(3)}</span> · {popPhrase(c.popularity)}
                </div>
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink/80">{c.why}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {plan.brandPartners.length > 0 && (
        <section>
          <h3 className="mb-2 font-display text-lg font-extrabold uppercase text-ink">Merch and brand partners</h3>
          <ul className="grid gap-2">
            {plan.brandPartners.map((b) => (
              <li key={b.id} className="rounded-md border border-ink/10 p-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[14px] font-semibold text-ink">{b.name}</span>
                  <span className="font-mono text-[11px] text-amber">{b.affinity === null ? "" : b.affinity.toFixed(3)}</span>
                </div>
                {b.category && <div className="text-[11.5px] text-dim">{b.category}</div>}
                <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink/80">{b.pitch}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h3 className="mb-2 font-display text-lg font-extrabold uppercase text-ink">Audience brief</h3>
        {plan.audience.age.length > 0 && (
          <div className="mb-3 grid grid-cols-6 items-end gap-1" role="img" aria-label="Qloo age-band affinity, above the line over-indexes">
            {plan.audience.age.map((a) => (
              <div key={a.band} className="flex flex-col items-center gap-1">
                <div className="relative flex h-16 w-full items-center justify-center">
                  <div className="absolute inset-x-0 top-1/2 h-px bg-ink/15" />
                  <div
                    className="absolute w-3/5 rounded-[2px]"
                    style={{
                      height: `${(Math.abs(a.affinity) / maxAge) * 50}%`,
                      ...(a.affinity >= 0 ? { bottom: "50%" } : { top: "50%" }),
                      background: a.affinity >= 0 ? "#ff7a1a" : "#4a4741",
                    }}
                  />
                </div>
                <span className="font-mono text-[10.5px] text-dim">{AGE_LABEL[a.band] ?? a.band}</span>
              </div>
            ))}
          </div>
        )}
        <ul className="mb-3 space-y-1.5">
          {plan.audience.notes.map((n, i) => (
            <li key={i} className="text-[12.5px] leading-relaxed text-ink/80">
              {n}
            </li>
          ))}
        </ul>
        <div className="space-y-2">
          {TAG_GROUPS.map((g) => {
            const tags = plan.audience.tasteTags.filter((t) => t.group && g.types.includes(t.group));
            if (!tags.length) return null;
            return (
              <div key={g.label} className="flex gap-2">
                <span className="w-24 shrink-0 pt-0.5 font-mono text-[10.5px] text-faint">{g.label}</span>
                <div className="flex flex-wrap gap-1">
                  {tags.map((t) => (
                    <span key={t.name} className="rounded-sm bg-ink/6 px-1.5 py-0.5 text-[11.5px] text-ink/85">
                      {t.name}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-md border border-ink/10 bg-night/50 p-3">
        <h3 className="mb-1.5 text-[12.5px] font-semibold text-ink">What this does not tell you</h3>
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
