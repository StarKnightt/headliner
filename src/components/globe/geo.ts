import * as THREE from "three";

/** Matches three.js SphereGeometry UVs for an equirectangular texture. */
export function latLngToVec3(lat: number, lng: number, r = 1): THREE.Vector3 {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lng + 180) * Math.PI) / 180;
  return new THREE.Vector3(-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta));
}

/** Great-circle-ish arc lifted off the surface proportionally to distance. */
export function arcCurve(a: { lat: number; lng: number }, b: { lat: number; lng: number }): THREE.QuadraticBezierCurve3 {
  const start = latLngToVec3(a.lat, a.lng, 1.002);
  const end = latLngToVec3(b.lat, b.lng, 1.002);
  const angle = start.angleTo(end);
  const mid = start.clone().add(end).normalize();
  if (mid.lengthSq() < 1e-6) mid.set(0, 1, 0);
  mid.multiplyScalar(1 + 0.04 + angle * 0.32);
  return new THREE.QuadraticBezierCurve3(start, mid, end);
}

export const OPPORTUNITY_COLOR: Record<string, string> = {
  stronghold: "#ff7a1a",
  "hidden-gem": "#38e1c6",
  emerging: "#f5c84b",
  "long-shot": "#7d8597",
};

export function centroidDirection(points: { lat: number; lng: number }[]): THREE.Vector3 {
  const v = new THREE.Vector3();
  for (const p of points) v.add(latLngToVec3(p.lat, p.lng));
  return v.lengthSq() < 1e-6 ? new THREE.Vector3(0, 0.4, 1).normalize() : v.normalize();
}
