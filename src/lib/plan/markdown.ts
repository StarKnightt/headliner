import { headroom, OPPORTUNITY_LABEL, topShare } from "./routing";
import type { TourPlan } from "./schema";

const p3 = (x: number | null) => (x === null ? "n/a" : x.toFixed(3));
const AGE_LABEL: Record<string, string> = {
  "24_and_younger": "≤24",
  "25_to_29": "25-29",
  "30_to_34": "30-34",
  "35_to_44": "35-44",
  "45_to_54": "45-54",
  "55_and_older": "55+",
};

export function planToMarkdown(plan: TourPlan): string {
  const L: string[] = [];
  if (plan.mode.qloo === "mock") L.push("> **MOCK DATA.** Generated without a Qloo API key; not Qloo results.", "");
  L.push(`# ${plan.headline}`, "", `**${plan.artist.name}** · ${plan.totals.stops} stops · ${plan.totals.distanceKm.toLocaleString("en-US")} km routed`, "");
  L.push(plan.summary, "");
  L.push("## Routing", "", "| # | City | Fans rank in | Affinity | Local popularity | Headroom | Read | Leg |", "|---|---|---|---|---|---|---|---|");
  for (const s of plan.stops) {
    L.push(
      `| ${s.order} | ${s.city}, ${s.country} | ${topShare(s.fanAffinity)} of ${s.area} | ${p3(s.fanAffinity)} | ${p3(s.marketPopularity)} | ${headroom(s.fanAffinity, s.marketPopularity).toFixed(2)} | ${OPPORTUNITY_LABEL[s.opportunity]} | ${s.legKm ? `${s.legKm.toLocaleString("en-US")} km` : "start"} |`,
    );
  }
  L.push("");
  for (const s of plan.stops) {
    L.push(`### ${s.order}. ${s.city}`, "", s.reason, "");
    if (s.peak) L.push(`_Metro peak: ${topShare(s.peak.affinity)} cell ${s.peak.km} km from the centre._`, "");
    for (const v of s.venues) {
      const where = [v.category, v.neighborhood].filter(Boolean).join(", ");
      L.push(`- **${v.name}**${where ? ` (${where})` : ""}${v.address ? `, ${v.address}` : ""}: ${v.why}`);
    }
    L.push("");
  }
  if (plan.coHeadliners.length) {
    L.push("## Bill", "");
    for (const c of plan.coHeadliners) L.push(`- **${c.name}** (${c.role}, shared-audience affinity ${p3(c.affinity)}): ${c.why}`);
    L.push("");
  }
  if (plan.brandPartners.length) {
    L.push("## Merch and brand partners", "");
    for (const b of plan.brandPartners) L.push(`- **${b.name}**${b.category ? ` (${b.category})` : ""}, affinity ${p3(b.affinity)}: ${b.pitch}`);
    L.push("");
  }
  L.push("## Audience brief", "");
  if (plan.audience.age.length) {
    L.push(`Age affinity: ${plan.audience.age.map((a) => `${AGE_LABEL[a.band] ?? a.band} ${a.affinity >= 0 ? "+" : ""}${a.affinity.toFixed(2)}`).join(" · ")}`, "");
  }
  if (plan.audience.tasteTags.length) L.push(`Taste signals: ${plan.audience.tasteTags.map((t) => t.name).join(", ")}`, "");
  for (const n of plan.audience.notes) L.push(`- ${n}`);
  L.push("", "## Caveats", "");
  for (const c of plan.caveats) L.push(`- ${c}`);
  L.push(
    "",
    `_Generated ${plan.generatedAt} by Headliner (${plan.mode.agent}; Qloo ${plan.mode.qloo}; ${plan.totals.qlooCalls} Qloo calls, ${plan.totals.cachedCalls} served from cache)._`,
    "",
  );
  return L.join("\n");
}
