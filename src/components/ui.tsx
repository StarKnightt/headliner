import type { Opportunity } from "@/lib/plan/schema";
import { OPPORTUNITY_LABEL } from "@/lib/plan/routing";

export const OPP_STYLE: Record<Opportunity, { color: string; bg: string }> = {
  stronghold: { color: "#ff7a1a", bg: "rgb(255 122 26 / 0.12)" },
  "hidden-gem": { color: "#38e1c6", bg: "rgb(56 225 198 / 0.12)" },
  emerging: { color: "#f5c84b", bg: "rgb(245 200 75 / 0.12)" },
  "long-shot": { color: "#7d8597", bg: "rgb(125 133 151 / 0.14)" },
};

export function OpportunityChip({ value }: { value: Opportunity }) {
  const s = OPP_STYLE[value];
  return (
    <span className="micro inline-flex items-center gap-1.5 rounded-sm px-1.5 py-0.5" style={{ color: s.color, background: s.bg }}>
      <span className="size-1.5 rounded-full" style={{ background: s.color }} />
      {OPPORTUNITY_LABEL[value]}
    </span>
  );
}

export function Meter({ label, value, color = "#ff7a1a" }: { label: string; value: number | null; color?: string }) {
  const v = value === null ? 0 : Math.max(0, Math.min(1, value));
  return (
    <div className="flex items-center gap-2">
      <span className="micro w-20 shrink-0 text-dim">{label}</span>
      <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-ink/8">
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${v * 100}%`, background: color }} />
      </div>
      <span className="w-9 text-right font-mono text-[11px] tabular-nums text-ink">{value === null ? "n/a" : Math.round(v * 100)}</span>
    </div>
  );
}

export function ModeBadge({ qloo, agent }: { qloo: "live" | "mock"; agent?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {qloo === "mock" ? (
        <span className="micro inline-flex items-center gap-1.5 rounded-sm bg-amber px-1.5 py-0.5 font-bold text-night">
          Mock data · not Qloo
        </span>
      ) : (
        <span className="micro inline-flex items-center gap-1.5 rounded-sm bg-gem/15 px-1.5 py-0.5 text-gem">
          <span className="size-1.5 rounded-full bg-gem" /> Qloo live
        </span>
      )}
      {agent && <span className="micro rounded-sm bg-ink/8 px-1.5 py-0.5 text-dim">Agent · {agent}</span>}
    </div>
  );
}

export const AGE_LABEL: Record<string, string> = {
  "24_and_younger": "≤24",
  "25_to_29": "25–29",
  "30_to_34": "30–34",
  "35_to_44": "35–44",
  "45_to_54": "45–54",
  "55_and_older": "55+",
};
