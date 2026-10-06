"use client";

import { OrbitControls, Stars, useTexture } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef, type RefObject } from "react";
import * as THREE from "three";
import { pctIndex } from "@/lib/plan/routing";
import { arcCurve, centroidDirection, latLngToVec3, OPPORTUNITY_COLOR } from "./geo";

export interface GlobeMarker {
  id: string;
  name: string;
  lat: number;
  lng: number;
  affinity: number;
  opportunity: string;
}

export interface GlobeStop extends GlobeMarker {
  order: number;
  hotspots: { lat: number; lng: number; affinity: number }[];
}

export interface GlobeProps {
  markers: GlobeMarker[];
  stops: GlobeStop[];
  /** Territory heatmap cells from Qloo: [lat, lng, affinity percentile]. */
  heat: [number, number, number][];
  focusIndex: number | null;
  /** Direction to face when there is nothing to focus (region centre). */
  home: { lat: number; lng: number };
  onSelectStop?: (index: number) => void;
  idle: boolean;
  /** Pixels covered by panels on each side (desktop), so the globe centres in the free space. */
  inset?: { left: number; right: number };
}

// ---------------- earth ----------------

const earthVert = /* glsl */ `
varying vec2 vUv;
varying vec3 vNormalV;
varying vec3 vViewDir;
void main() {
  vUv = uv;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vNormalV = normalize(normalMatrix * normal);
  vViewDir = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}`;

const earthFrag = /* glsl */ `
uniform sampler2D uMap;
uniform float uTime;
uniform float uDim;
varying vec2 vUv;
varying vec3 vNormalV;
varying vec3 vViewDir;
void main() {
  vec3 c = texture2D(uMap, vUv).rgb;
  float l = dot(c, vec3(0.299, 0.587, 0.114));
  float lights = smoothstep(0.16, 0.85, l);
  vec3 land = c * vec3(0.42, 0.5, 0.78);
  vec3 warm = mix(vec3(1.0, 0.48, 0.12), vec3(1.0, 0.86, 0.62), smoothstep(0.55, 1.0, l));
  // Once Qloo's fan heat is on the map, city lights cool and dim so the fans are the light source.
  vec3 cool = vec3(0.55, 0.62, 0.78);
  vec3 col = land * (1.0 - 0.25 * uDim) + mix(warm, cool, uDim) * lights * mix(1.35, 0.42, uDim);
  float fres = pow(1.0 - max(dot(vNormalV, vViewDir), 0.0), 2.6);
  col += vec3(0.18, 0.34, 0.85) * fres * 0.55;
  gl_FragColor = vec4(col, 1.0);
}`;

const atmoVert = /* glsl */ `
varying vec3 vNormalV;
void main() {
  vNormalV = normalize(normalMatrix * normal);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const atmoFrag = /* glsl */ `
varying vec3 vNormalV;
void main() {
  float i = pow(0.72 - dot(vNormalV, vec3(0.0, 0.0, 1.0)), 3.2);
  gl_FragColor = vec4(vec3(0.28, 0.46, 1.0) * i * 1.6 + vec3(1.0, 0.45, 0.12) * i * 0.18, i);
}`;

function Earth({ dim }: { dim: boolean }) {
  const isSmall = typeof window !== "undefined" && window.innerWidth < 900;
  const map = useTexture(isSmall ? "/textures/earth-night-2k.jpg" : "/textures/earth-night-4k.jpg", (t) => {
    t.anisotropy = 8;
    t.needsUpdate = true;
  });
  const uniforms = useMemo(() => ({ uMap: { value: map }, uTime: { value: 0 }, uDim: { value: 0 } }), [map]);
  const mat = useRef<THREE.ShaderMaterial>(null);
  useFrame((_, dt) => {
    const u = mat.current?.uniforms.uDim;
    if (u) u.value += ((dim ? 1 : 0) - u.value) * Math.min(1, dt * 2.2);
  });
  return (
    <group>
      <mesh>
        <sphereGeometry args={[1, 128, 128]} />
        <shaderMaterial ref={mat} vertexShader={earthVert} fragmentShader={earthFrag} uniforms={uniforms} />
      </mesh>
      <mesh scale={1.13}>
        <sphereGeometry args={[1, 64, 64]} />
        <shaderMaterial
          vertexShader={atmoVert}
          fragmentShader={atmoFrag}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          transparent
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

// ---------------- markers ----------------

const UP = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);
// Per-frame scratch objects (module scope: never part of React state).
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _o = new THREE.Object3D();
const _c = new THREE.Color();

function orientOutward(obj: THREE.Object3D, dir: THREE.Vector3) {
  obj.quaternion.setFromUnitVectors(UP, dir.clone().normalize());
}

function CityDot({ m, isStop }: { m: GlobeMarker; isStop: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const born = useRef<number | null>(null);
  const pos = useMemo(() => latLngToVec3(m.lat, m.lng, 1.001), [m.lat, m.lng]);
  const color = OPPORTUNITY_COLOR[m.opportunity] ?? "#ff7a1a";
  useEffect(() => {
    if (ref.current) orientOutward(ref.current, pos);
  }, [pos]);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    if (born.current === null) born.current = clock.elapsedTime;
    const t = Math.min(1, (clock.elapsedTime - born.current) / 0.6);
    ref.current.scale.setScalar(1 - Math.pow(1 - t, 3));
  });
  const r = 0.004 + pctIndex(m.affinity) * 0.012;
  return (
    <group ref={ref} position={pos}>
      <mesh rotation-x={-Math.PI / 2}>
        <circleGeometry args={[r, 24]} />
        <meshBasicMaterial color={color} transparent opacity={isStop ? 0.95 : 0.55} toneMapped={false} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2}>
        <ringGeometry args={[r * 1.5, r * 1.9, 32]} />
        <meshBasicMaterial color={color} transparent opacity={isStop ? 0.5 : 0.18} toneMapped={false} />
      </mesh>
    </group>
  );
}

function StopPillar({ s, active, onClick }: { s: GlobeStop; active: boolean; onClick?: () => void }) {
  const group = useRef<THREE.Group>(null);
  const pulse = useRef<THREE.Mesh>(null);
  const pos = useMemo(() => latLngToVec3(s.lat, s.lng, 1.0), [s.lat, s.lng]);
  const height = 0.05 + pctIndex(s.affinity) * 0.2;
  const color = OPPORTUNITY_COLOR[s.opportunity] ?? "#ff7a1a";
  useEffect(() => {
    if (group.current) orientOutward(group.current, pos);
  }, [pos]);
  useFrame(({ clock }) => {
    const t = (clock.elapsedTime * 0.8 + s.order * 0.17) % 1;
    if (pulse.current) {
      pulse.current.scale.setScalar(1 + t * (active ? 5 : 3));
      (pulse.current.material as THREE.MeshBasicMaterial).opacity = (1 - t) * (active ? 0.8 : 0.45);
    }
  });
  return (
    <group ref={group} position={pos}>
      <mesh position-y={height / 2} onClick={onClick}>
        <cylinderGeometry args={[0.0035, 0.006, height, 10, 1, true]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} toneMapped={false} />
      </mesh>
      <mesh position-y={height}>
        <sphereGeometry args={[active ? 0.011 : 0.008, 16, 16]} />
        <meshBasicMaterial color={active ? "#fff4e0" : color} toneMapped={false} />
      </mesh>
      <mesh ref={pulse} rotation-x={-Math.PI / 2} position-y={0.001}>
        <ringGeometry args={[0.008, 0.011, 40]} />
        <meshBasicMaterial color={color} transparent depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  );
}

// ---------------- Qloo fan heat ----------------

function glowTexture() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,255,255,1)");
  grd.addColorStop(0.3, "rgba(255,255,255,0.6)");
  grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/** Ember to sodium to warm white, by how far into the territory's top the cell sits. */
function heatColor(t: number, out: THREE.Color) {
  const ember = [0.42, 0.11, 0.03];
  const sodium = [1.0, 0.45, 0.09];
  const white = [1.0, 0.92, 0.78];
  const [a, b, k] = t < 0.6 ? [ember, sodium, t / 0.6] : [sodium, white, (t - 0.6) / 0.4];
  return out.setRGB(a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k);
}

/** Territory heatmap cells (geohash precision 4, about 40 km) as soft glows on the surface. */
function HeatField({ heat }: { heat: [number, number, number][] }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const mat = useRef<THREE.MeshBasicMaterial>(null);
  const tex = useMemo(() => glowTexture(), []);
  const born = useRef<number | null>(null);
  useEffect(() => () => tex.dispose(), [tex]);
  useEffect(() => {
    born.current = null;
    if (!mesh.current) return;
    heat.forEach(([lat, lng, a], i) => {
      const dir = latLngToVec3(lat, lng, 1).normalize();
      // Percentiles above 0.8 only; spread the top on the same log scale the planner uses.
      const t = Math.max(0, Math.min(1, 1 - Math.log10(1 + 99 * (1 - a)) / 2 - 0.25) / 0.75);
      _o.position.copy(dir).multiplyScalar(1.0016);
      _o.quaternion.setFromUnitVectors(Z, dir);
      const s = 0.0075 + t * 0.0065;
      _o.scale.set(s, s, 1);
      _o.updateMatrix();
      mesh.current!.setMatrixAt(i, _o.matrix);
      mesh.current!.setColorAt(i, heatColor(t, _c));
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  }, [heat]);
  useFrame(({ clock }) => {
    if (!mat.current) return;
    if (born.current === null) born.current = clock.elapsedTime;
    const t = Math.min(1, (clock.elapsedTime - born.current) / 1.4);
    mat.current.opacity = 0.9 * (1 - Math.pow(1 - t, 3));
  });
  if (!heat.length) return null;
  return (
    <instancedMesh key={heat.length} ref={mesh} args={[undefined, undefined, heat.length]} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial ref={mat} map={tex} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} />
    </instancedMesh>
  );
}

const HOT_MAG = 7;

function Hotspots({ stop }: { stop: GlobeStop }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const count = stop.hotspots.length;
  const born = useRef<number | null>(null);
  const data = useMemo(() => {
    // City heatmaps put the top cells near 1.0; rescale within the stop so the peaks stand out.
    const as = stop.hotspots.map((h) => h.affinity);
    const lo = Math.min(...as);
    const span = Math.max(1e-3, Math.max(...as) - lo);
    return stop.hotspots.map((h) => {
      const lat = stop.lat + (h.lat - stop.lat) * HOT_MAG;
      const lng = stop.lng + (h.lng - stop.lng) * HOT_MAG;
      return { dir: latLngToVec3(lat, lng, 1), a: 0.35 + 0.65 * ((h.affinity - lo) / span) };
    });
  }, [stop]);
  useEffect(() => {
    born.current = null;
    if (!mesh.current) return;
    data.forEach((d, i) => {
      _c.set(d.a > 0.75 ? "#fff1d6" : d.a > 0.55 ? "#ff9a3c" : "#b4461a");
      mesh.current!.setColorAt(i, _c);
    });
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  }, [data]);
  useFrame(({ clock }) => {
    if (!mesh.current) return;
    if (born.current === null) born.current = clock.elapsedTime;
    const t = Math.min(1, (clock.elapsedTime - born.current) / 0.9);
    const e = 1 - Math.pow(1 - t, 3);
    data.forEach((d, i) => {
      const h = Math.max(0.002, d.a * d.a * 0.06 * e);
      _o.position.copy(d.dir).multiplyScalar(1 + h / 2);
      _o.quaternion.setFromUnitVectors(UP, d.dir);
      _o.scale.set(1, h, 1);
      _o.updateMatrix();
      mesh.current!.setMatrixAt(i, _o.matrix);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });
  if (!count) return null;
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]}>
      <boxGeometry args={[0.0042, 1, 0.0042]} />
      <meshBasicMaterial toneMapped={false} transparent opacity={0.92} />
    </instancedMesh>
  );
}

interface Rect {
  l: number;
  t: number;
  r: number;
  b: number;
}

const LABEL_GAP = 6;
const LABEL_PAD = 3;

/** Candidate label boxes around an anchor, in preference order (offsets are relative to the anchor). */
function candidates(x: number, y: number, w: number, h: number): Rect[] {
  const g = LABEL_GAP;
  const boxes: [number, number][] = [
    [x - w / 2, y - h - 2],
    [x + g, y - h / 2],
    [x - g - w, y - h / 2],
    [x + g, y - h - g],
    [x - g - w, y - h - g],
    [x - w / 2, y - h - 24],
    [x + g + 16, y - h / 2 - 14],
    [x - g - 16 - w, y - h / 2 - 14],
  ];
  return boxes.map(([l, t]) => ({ l, t, r: l + w, b: t + h }));
}

const overlaps = (a: Rect, b: Rect) => a.l < b.r + LABEL_PAD && a.r + LABEL_PAD > b.l && a.t < b.b + LABEL_PAD && a.b + LABEL_PAD > b.t;

/**
 * Projects stop label anchors to screen space and lays out DOM labels outside the canvas.
 * Greedy collision avoidance: labels are placed by priority (focused stop, then affinity) at the first
 * free candidate slot, preferring last frame's slot to avoid jitter. If nothing fits, the label collapses
 * to its stop number. Offset labels get a leader line back to their pillar.
 */
function LabelProjector({ stops, focusIndex, layer }: { stops: GlobeStop[]; focusIndex: number | null; layer: RefObject<HTMLDivElement | null> }) {
  const anchors = useMemo(
    () =>
      stops.map((s, i) => ({
        id: s.id,
        index: i,
        affinity: s.affinity,
        surface: latLngToVec3(s.lat, s.lng, 1),
        top: latLngToVec3(s.lat, s.lng, 1.07 + pctIndex(s.affinity) * 0.2),
      })),
    [stops],
  );
  const memory = useRef(new Map<string, { slot: number; compact: boolean; full: [number, number]; small: [number, number] }>());

  useFrame(({ camera, size }) => {
    const root = layer.current;
    if (!root) return;
    const camDir = _v2.copy(camera.position).normalize();
    const placed: Rect[] = [];
    const order = [...anchors].sort((a, b) => (a.index === focusIndex ? -1 : b.index === focusIndex ? 1 : b.affinity - a.affinity));
    for (const a of order) {
      const el = root.querySelector<HTMLElement>(`[data-stop="${a.id}"]`);
      const line = root.querySelector<SVGLineElement>(`[data-leader="${a.id}"]`);
      if (!el) continue;
      const key = `${a.id}:${a.index}`;
      let m = memory.current.get(key);
      if (!m || m.full[0] === 0) {
        const chip = el.firstElementChild as HTMLElement | null;
        const num = chip?.firstElementChild as HTMLElement | null;
        const full: [number, number] = [chip?.offsetWidth ?? 0, chip?.offsetHeight ?? 0];
        m = { slot: 0, compact: false, full, small: [(num?.offsetWidth ?? 14) + 12, full[1]] };
        memory.current.set(key, m);
      }
      const facing = camDir.dot(a.surface);
      const opacity = Math.max(0, Math.min(1, (facing - 0.15) * 4));
      _v3.copy(a.top).project(camera);
      const x = (_v3.x * 0.5 + 0.5) * size.width;
      const y = (-_v3.y * 0.5 + 0.5) * size.height;
      if (opacity < 0.05) {
        el.style.opacity = "0";
        if (line) line.style.opacity = "0";
        continue;
      }

      let chosen: Rect | null = null;
      let compact = false;
      for (const mode of [false, true]) {
        const [w, h] = mode ? m.small : m.full;
        const opts = candidates(x, y, w, h);
        const prefer = m.compact === mode ? [m.slot, ...opts.keys()] : [...opts.keys()];
        for (const k of prefer) {
          if (!placed.some((p) => overlaps(p, opts[k]))) {
            chosen = opts[k];
            m.slot = k;
            break;
          }
        }
        if (chosen) {
          compact = mode;
          break;
        }
      }
      if (!chosen) {
        // Nowhere free: fall back to the compact chip in its default slot.
        const [w, h] = m.small;
        chosen = candidates(x, y, w, h)[0];
        compact = true;
        m.slot = 0;
      }
      m.compact = compact;
      placed.push(chosen);

      el.dataset.compact = compact ? "1" : "";
      el.style.transform = `translate(${chosen.l.toFixed(1)}px, ${chosen.t.toFixed(1)}px)`;
      el.style.opacity = String(opacity);

      if (line) {
        const cx = Math.max(chosen.l, Math.min(x, chosen.r));
        const cy = Math.max(chosen.t, Math.min(y, chosen.b));
        const far = Math.hypot(cx - x, cy - y) > 9;
        line.setAttribute("x1", x.toFixed(1));
        line.setAttribute("y1", y.toFixed(1));
        line.setAttribute("x2", cx.toFixed(1));
        line.setAttribute("y2", cy.toFixed(1));
        line.style.opacity = far ? String(opacity * 0.7) : "0";
      }
    }
  });
  return null;
}

// ---------------- arcs ----------------

const arcVert = /* glsl */ `
varying vec2 vUv;
void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const arcFrag = /* glsl */ `
uniform float uProgress;
uniform float uTime;
uniform vec3 uColor;
varying vec2 vUv;
void main() {
  float reveal = 1.0 - smoothstep(uProgress - 0.04, uProgress, vUv.x);
  float head = exp(-pow((vUv.x - uProgress) * 22.0, 2.0)) * step(0.001, uProgress) * (1.0 - step(0.999, uProgress));
  float travel = exp(-pow(fract(vUv.x - uTime * 0.28) - 0.5, 2.0) * 180.0);
  vec3 col = uColor * (0.55 + travel * 1.1) + vec3(1.0, 0.95, 0.85) * head * 2.0;
  float a = reveal * (0.55 + travel * 0.45) + head;
  gl_FragColor = vec4(col, a);
}`;

function Arc({ a, b, delay, epoch }: { a: GlobeStop; b: GlobeStop; delay: number; epoch: number }) {
  const geom = useMemo(() => new THREE.TubeGeometry(arcCurve(a, b), 96, 0.0024, 6, false), [a, b]);
  const uniforms = useMemo(
    () => ({ uProgress: { value: 0 }, uTime: { value: 0 }, uColor: { value: new THREE.Color("#ff8a2a") } }),
    [],
  );
  const start = useRef<number | null>(null);
  const mat = useRef<THREE.ShaderMaterial>(null);
  useEffect(() => {
    start.current = null;
  }, [epoch]);
  useEffect(() => () => geom.dispose(), [geom]);
  useFrame(({ clock }) => {
    if (start.current === null) start.current = clock.elapsedTime;
    const t = clock.elapsedTime - start.current - delay;
    if (!mat.current) return;
    mat.current.uniforms.uProgress.value = Math.max(0, Math.min(1.0, t / 0.9));
    mat.current.uniforms.uTime.value = clock.elapsedTime + delay;
  });
  return (
    <mesh geometry={geom}>
      <shaderMaterial
        ref={mat}
        vertexShader={arcVert}
        fragmentShader={arcFrag}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}

// ---------------- camera ----------------

interface ControlsLike extends THREE.EventDispatcher<{ start: object }> {
  autoRotate: boolean;
  update(): void;
}

function CameraRig({ target, distance, idle }: { target: THREE.Vector3; distance: number; idle: boolean }) {
  const controls = useThree((s) => s.controls) as unknown as ControlsLike | null;
  const flying = useRef(true);

  useEffect(() => {
    flying.current = true;
  }, [target, distance]);

  useEffect(() => {
    if (!controls) return;
    const stop = () => (flying.current = false);
    controls.addEventListener("start", stop);
    return () => controls.removeEventListener("start", stop);
  }, [controls]);

  useFrame((state, dt) => {
    const camera = state.camera;
    const ctl = state.controls as unknown as ControlsLike | null;
    const dir = _v;
    const q = _q;
    const qt = _q2;
    if (ctl) ctl.autoRotate = idle && !flying.current;
    if (!flying.current) return;
    const k = 1 - Math.exp(-dt * 2.4);
    dir.copy(camera.position).normalize();
    q.setFromUnitVectors(Z, dir);
    qt.setFromUnitVectors(Z, target);
    q.slerp(qt, k);
    const r = THREE.MathUtils.lerp(camera.position.length(), distance, k);
    camera.position.set(0, 0, 1).applyQuaternion(q).multiplyScalar(r);
    camera.lookAt(0, 0, 0);
    ctl?.update();
    if (dir.angleTo(target) < 0.002 && Math.abs(r - distance) < 0.005) flying.current = false;
  });
  return null;
}

/**
 * Aim between the run's two farthest-apart stops (blended with the average), so a run with most stops
 * at one end still fits in frame.
 */
function framingDirection(stops: GlobeStop[]): THREE.Vector3 {
  const centroid = centroidDirection(stops);
  const dirs = stops.map((s) => latLngToVec3(s.lat, s.lng).normalize());
  let pair: [number, number] = [0, 0];
  let widest = -1;
  for (let i = 0; i < dirs.length; i++)
    for (let j = i + 1; j < dirs.length; j++) {
      const a = dirs[i].angleTo(dirs[j]);
      if (a > widest) [widest, pair] = [a, [i, j]];
    }
  const mid = dirs[pair[0]].clone().add(dirs[pair[1]]);
  if (stops.length < 2 || mid.lengthSq() < 1e-3) return centroid;
  return mid.normalize().multiplyScalar(0.7).add(centroid.multiplyScalar(0.3)).normalize();
}

/** Shift the projection so the globe's centre sits in the space between the side panels. */
function ViewOffset({ inset }: { inset?: { left: number; right: number } }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  useEffect(() => {
    const shift = inset ? (inset.right - inset.left) / 2 : 0;
    if (shift) camera.setViewOffset(size.width, size.height, shift, 0, size.width, size.height);
    else camera.clearViewOffset();
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height, inset]);
  return null;
}

// ---------------- scene ----------------

function Scene({ markers, stops, heat, focusIndex, home, onSelectStop, idle, inset, layer }: GlobeProps & { layer: RefObject<HTMLDivElement | null> }) {
  const focus = focusIndex !== null ? stops[focusIndex] : null;
  const target = useMemo(() => {
    if (focus) {
      const v = latLngToVec3(focus.lat - 6, focus.lng, 1).normalize();
      return v;
    }
    if (stops.length) return framingDirection(stops);
    return latLngToVec3(home.lat, home.lng).normalize();
  }, [focus, stops, home.lat, home.lng]);
  // Pull back for spread-out runs (a world tour) and for narrow phone viewports.
  const aspect = useThree((s) => s.size.width / Math.max(1, s.size.height));
  const spread = useMemo(() => (stops.length ? Math.max(...stops.map((s) => latLngToVec3(s.lat, s.lng).normalize().angleTo(target))) : 0), [stops, target]);
  const runDistance = Math.min(3.8, Math.max(2.7, 2.35 + spread * 2.5));
  const distance = (focus ? 1.9 : stops.length ? runDistance : 3.2) * (aspect < 1.25 ? 1.3 : 1);
  const stopIds = useMemo(() => new Set(stops.map((s) => s.id)), [stops]);
  const epoch = useMemo(() => stops.map((s) => s.id).join("|").length + stops.length, [stops]);

  return (
    <>
      <color attach="background" args={["#05060a"]} />
      <Stars radius={60} depth={30} count={2500} factor={2.2} saturation={0} fade speed={0.4} />
      <Suspense fallback={null}>
        <Earth dim={heat.length > 0} />
      </Suspense>
      <HeatField heat={heat} />
      {markers.map((m) => (
        <CityDot key={m.id} m={m} isStop={stopIds.has(m.id)} />
      ))}
      {stops.map((s, i) => (
        <StopPillar key={s.id} s={s} active={i === focusIndex} onClick={() => onSelectStop?.(i)} />
      ))}
      {stops.slice(1).map((s, i) => (
        <Arc key={`${stops[i].id}-${s.id}`} a={stops[i]} b={s} delay={0.4 + i * 0.55} epoch={epoch} />
      ))}
      {focus && <Hotspots key={focus.id} stop={focus} />}
      <LabelProjector stops={stops} focusIndex={focusIndex} layer={layer} />
      <OrbitControls
        makeDefault
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.45}
        zoomSpeed={0.6}
        minDistance={1.35}
        maxDistance={5}
        autoRotateSpeed={0.35}
      />
      <CameraRig target={target} distance={distance} idle={idle} />
      <ViewOffset inset={inset} />
    </>
  );
}

export default function Globe(props: GlobeProps) {
  const layer = useRef<HTMLDivElement>(null);
  return (
    <div className="relative h-full w-full">
    <Canvas
      camera={{ position: latLngToVec3(props.home.lat, props.home.lng, 3.4).toArray(), fov: 38, near: 0.01, far: 200 }}
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      aria-label="3D globe showing tour stops"
    >
      <Scene {...props} layer={layer} />
    </Canvas>
      <div ref={layer} className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <svg className="absolute inset-0 h-full w-full">
          {props.stops.map((s) => (
            <line key={s.id} data-leader={s.id} stroke={OPPORTUNITY_COLOR[s.opportunity]} strokeWidth={1} style={{ opacity: 0 }} />
          ))}
        </svg>
        {props.stops.map((s, i) => {
          const active = i === props.focusIndex;
          return (
            <div key={s.id} data-stop={s.id} title={s.name} className="group absolute left-0 top-0 whitespace-nowrap opacity-0 will-change-transform">
              <div
                className={`flex items-center gap-1.5 rounded-sm px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em] ${
                  active ? "bg-ink text-night" : "bg-night/80 text-ink ring-1 ring-ink/15"
                }`}
              >
                <span style={{ color: active ? undefined : OPPORTUNITY_COLOR[s.opportunity] }}>{String(s.order).padStart(2, "0")}</span>
                <span className="group-data-[compact=1]:hidden">{s.name}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
