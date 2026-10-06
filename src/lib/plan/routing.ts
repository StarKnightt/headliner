import { haversineKm } from "../cities";
import type { Opportunity } from "./schema";

interface Point {
  id: string;
  lat: number;
  lng: number;
}

/** Nearest-neighbour tour from `startId` (or the first point), improved with 2-opt. Open path; `endId` pins the closing stop. */
export function orderRoute<T extends Point>(points: T[], startId?: string, endId?: string): T[] {
  const startIdx = Math.max(0, points.findIndex((p) => p.id === startId));
  const endIdx = endId ? points.findIndex((p) => p.id === endId) : -1;
  const end = endIdx >= 0 && endIdx !== startIdx ? points[endIdx] : null;
  if (points.length <= 2) {
    if (points.length === 2 && end) return [points[startIdx], end];
    return [...points];
  }
  const remaining = points.filter((_, i) => i !== startIdx && points[i] !== end);
  const route: T[] = [points[startIdx]];
  while (remaining.length) {
    const last = route[route.length - 1];
    let best = 0;
    for (let i = 1; i < remaining.length; i++) {
      if (haversineKm(last, remaining[i]) < haversineKm(last, remaining[best])) best = i;
    }
    route.push(remaining.splice(best, 1)[0]);
  }
  if (end) route.push(end);
  const lastMovable = end ? route.length - 2 : route.length - 1;
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 1; i < lastMovable; i++) {
      for (let k = i + 1; k <= lastMovable; k++) {
        const a = route[i - 1];
        const b = route[i];
        const c = route[k];
        const d = route[k + 1];
        const before = haversineKm(a, b) + (d ? haversineKm(c, d) : 0);
        const after = haversineKm(a, c) + (d ? haversineKm(b, d) : 0);
        if (after + 1e-6 < before) {
          route.splice(i, k - i + 1, ...route.slice(i, k + 1).reverse());
          improved = true;
        }
      }
    }
  }
  return route;
}

/** With no requested opener, try every stop as the start and keep the shortest run. */
export function shortestRoute<T extends Point>(points: T[], endId?: string): T[] {
  let best: T[] = orderRoute(points, points[0]?.id, endId);
  for (const p of points) {
    if (p.id === endId) continue;
    const r = orderRoute(points, p.id, endId);
    if (routeDistanceKm(r) < routeDistanceKm(best)) best = r;
  }
  return best;
}

export function routeDistanceKm(points: Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += haversineKm(points[i - 1], points[i]);
  return Math.round(total);
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/**
 * Qloo heatmap affinity and popularity are percentiles across every cell in a territory, so big
 * cities crowd the top (0.95 to 1.0). Headliner reads them on a log scale of "how far into the top":
 * top 0.1% → 0.98, top 1% → 0.85, top 3% → 0.70, top 7% → 0.55, median → 0.15.
 */
export function pctIndex(percentile: number): number {
  return 1 - Math.log10(1 + 99 * (1 - clamp01(percentile))) / 2;
}

/** How far the fan rank runs ahead of the local popularity rank (positive = fans outpace the market). */
export function headroom(affinity: number, popularity: number | null): number {
  return popularity === null ? 0 : Math.round((pctIndex(affinity) - pctIndex(popularity)) * 100) / 100;
}

/** "top 0.8%" for a percentile of 0.992. */
export function topShare(percentile: number): string {
  const t = (1 - clamp01(percentile)) * 100;
  if (t < 0.1) return "top 0.1%";
  if (t < 1) return `top ${t.toFixed(1)}%`;
  return `top ${Math.round(t)}%`;
}

/**
 * Headliner's interpretation of two Qloo numbers (not a Qloo metric), calibrated on live heatmaps for
 * 12 artists across all six territories:
 * - hidden gem: fans in the top 3% of the territory and clearly ahead of local popularity (headroom ≥ 0.05)
 * - stronghold: fans in the top 1%
 * - emerging: fans in the top 7%
 */
export function classifyOpportunity(affinity: number, popularity: number | null): Opportunity {
  const ia = pctIndex(affinity);
  if (ia >= 0.7 && headroom(affinity, popularity) >= 0.05) return "hidden-gem";
  if (ia >= 0.85) return "stronghold";
  if (ia >= 0.55) return "emerging";
  return "long-shot";
}

/** 0..100 routing score: 80% fan concentration (log-scale affinity), 20% headroom over local popularity. */
export function stopScore(affinity: number, popularity: number | null): number {
  return Math.round(100 * clamp01(0.8 * pctIndex(affinity) + 0.2 * clamp01(0.5 + 2 * headroom(affinity, popularity))));
}

/** True when the metro's best cell clearly beats the centre cell, e.g. a suburban audience. */
export function metroPeakNote(affinity: number, peak: number | null, km: number | null): string | null {
  if (peak === null || km === null || km < 8 || pctIndex(peak) - pctIndex(affinity) < 0.05) return null;
  return `fans peak ${km} km from the centre (${topShare(peak)})`;
}

export const OPPORTUNITY_LABEL: Record<Opportunity, string> = {
  stronghold: "Stronghold",
  "hidden-gem": "Hidden gem",
  emerging: "Emerging",
  "long-shot": "Long shot",
};
