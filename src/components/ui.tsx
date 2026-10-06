import type { Opportunity } from "@/lib/plan/schema";
import { OPPORTUNITY_LABEL, pctIndex } from "@/lib/plan/routing";

export const OPP_STYLE: Record<Opportunity, { color: string; bg: string }> = {
  stronghold: { color: "#ff7a1a", bg: "rgb(255 122 26 / 0.12)" },
  "hidden-gem": { color: "#38e1c6", bg: "rgb(56 225 198 / 0.12)" },
  emerging: { color: "#f5c84b", bg: "rgb(245 200 75 / 0.12)" },
  "long-shot": { color: "#8f97a8", bg: "rgb(143 151 168 / 0.14)" },
};

export const OPP_HINT: Record<Opportunity, string> = {
  stronghold: "Fans in the top 1% of the territory",
  "hidden-gem": "Fans in the top 3%, ahead of the local market",
  emerging: "Fans in the top 7%",
  "long-shot": "Below the top 7%",
};

export function OpportunityChip({ value }: { value: Opportunity }) {
  const s = OPP_STYLE[value];
  return (
    <span title={OPP_HINT[value]} className="micro inline-flex items-center rounded-sm px-1.5 py-0.5" style={{ color: s.color, background: s.bg }}>
      {OPPORTUNITY_LABEL[value]}
    </span>
  );
}

/** Fan rank and market rank on the same log scale; the gap between them is the headroom. */
export function RankBars({ affinity, popularity, color }: { affinity: number; popularity: number | null; color: string }) {
  const rows: [string, number | null, string][] = [
    ["Fan rank", affinity, color],
    ["Market", popularity, "#7f796d"],
  ];
  return (
    <div className="space-y-1" role="img" aria-label={`Fan affinity ${affinity.toFixed(3)}, local popularity ${popularity === null ? "not available" : popularity.toFixed(3)}`}>
      {rows.map(([label, v, c]) => (
        <div key={label} className="flex items-center gap-2">
          <span className="w-16 shrink-0 font-mono text-[10.5px] text-dim">{label}</span>
          <div className="relative h-[3px] flex-1 rounded-full bg-ink/[0.07]">
            <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${v === null ? 0 : pctIndex(v) * 100}%`, background: c }} />
          </div>
          <span className="w-11 text-right font-mono text-[11px] tabular-nums text-ink/90">{v === null ? "n/a" : v.toFixed(3)}</span>
        </div>
      ))}
    </div>
  );
}

/** "groq:openai/gpt-oss-120b → deterministic fallback" → "gpt-oss-120b on Groq, deterministic fallback" */
export function agentName(agent: string) {
  const [main, fallback] = agent.split(" → ");
  const [provider, ...rest] = main.split(":");
  const model = rest.join(":").split("/").pop();
  const base = model ? `${model} on ${provider === "groq" ? "Groq" : provider === "openai" ? "OpenAI" : provider}` : main === "deterministic" ? "Deterministic planner" : main;
  return fallback ? `${base}, finished by the deterministic planner` : base;
}

export function ModeBadge({ qloo, agent }: { qloo: "live" | "mock"; agent?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {qloo === "mock" ? (
        <span className="micro inline-flex items-center rounded-sm bg-amber px-1.5 py-0.5 font-bold text-night">Mock data, not Qloo</span>
      ) : (
        <span className="micro inline-flex items-center gap-1.5 rounded-sm bg-gem/12 px-1.5 py-0.5 text-gem">
          <span className="size-1.5 rounded-full bg-gem" aria-hidden /> Live Qloo data
        </span>
      )}
      {agent && <span className="micro rounded-sm bg-ink/8 px-1.5 py-0.5 text-dim">{agentName(agent)}</span>}
    </div>
  );
}

export const AGE_LABEL: Record<string, string> = {
  "24_and_younger": "≤24",
  "25_to_29": "25-29",
  "30_to_34": "30-34",
  "35_to_44": "35-44",
  "45_to_54": "45-54",
  "55_and_older": "55+",
};

/** Taste-tag subtypes grouped for the audience brief, in reading order. */
export const TAG_GROUPS: { label: string; types: string[] }[] = [
  { label: "Sound", types: ["urn:tag:genre:music", "urn:tag:music:qloo"] },
  { label: "Style", types: ["urn:tag:style:qloo"] },
  { label: "Audience", types: ["urn:tag:audience:qloo"] },
  { label: "Themes", types: ["urn:tag:theme:qloo"] },
  { label: "Reads and watches", types: ["urn:tag:genre:media"] },
];

export function relativeTime(iso: string, now = Date.now()) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 90) return "a minute ago";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} minutes ago`;
  const h = Math.round(m / 60);
  if (h < 36) return `${h} hour${h > 1 ? "s" : ""} ago`;
  return `${Math.round(h / 24)} days ago`;
}
