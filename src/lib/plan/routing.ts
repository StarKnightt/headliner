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

export function routeDistanceKm(points: Point[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += haversineKm(points[i - 1], points[i]);
  return Math.round(total);
}

/**
 * Headliner's own interpretation of two Qloo numbers (not a Qloo metric):
 * strong affinity + modest local popularity = fans are there but the market is not saturated.
 */
export function classifyOpportunity(affinity: number, popularity: number | null): Opportunity {
  const pop = popularity ?? 0.5;
  if (affinity >= 0.68 && pop < 0.55) return "hidden-gem";
  if (affinity >= 0.68) return "stronghold";
  if (affinity >= 0.5) return "emerging";
  return "long-shot";
}

/** 0..100 routing score: 70% fan affinity, 30% headroom (affinity above local popularity). */
export function stopScore(affinity: number, popularity: number | null): number {
  const headroom = Math.max(0, Math.min(1, affinity - (popularity ?? 0.5) + 0.5));
  return Math.round(100 * (0.7 * affinity + 0.3 * headroom));
}

export const OPPORTUNITY_LABEL: Record<Opportunity, string> = {
  stronghold: "Stronghold",
  "hidden-gem": "Hidden gem",
  emerging: "Emerging",
  "long-shot": "Long shot",
};
