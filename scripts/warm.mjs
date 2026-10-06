// Pre-run the one-click demos so visitors get instant replays (plans are kept for 7 days).
// Usage: pnpm warm [baseUrl] [--fresh]   e.g. pnpm warm https://headliner-five.vercel.app
// A demo that is already recorded replays at no cost; --fresh re-runs every demo.
import { readFileSync } from "node:fs";

const base = process.argv.find((a) => a.startsWith("http")) ?? "http://localhost:3123";
const fresh = process.argv.includes("--fresh");
const gapS = Number(process.env.GAP_S ?? 60);

// The demo list lives in the UI; parse it so the two never drift apart.
const src = readFileSync(new URL("../src/components/ControlDeck.tsx", import.meta.url), "utf8");
const demos = [...src.matchAll(/req: (\{ artist: "[^"]+", region: "[^"]+", stops: \d+, venueSize: "[^"]+" \})/g)].map((m) =>
  JSON.parse(m[1].replace(/(\w+):/g, '"$1":')),
);

for (const [i, req] of demos.entries()) {
  const t0 = Date.now();
  const res = await fetch(`${base}/api/plan`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...req, fresh }) });
  if (!res.ok) {
    console.log(`${req.artist}: HTTP ${res.status} ${(await res.text()).slice(0, 160)}`);
    continue;
  }
  let meta = null;
  let plan = null;
  let error = null;
  let buf = "";
  for await (const chunk of res.body) {
    buf += new TextDecoder().decode(chunk, { stream: true });
    let n;
    while ((n = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, n).trim();
      buf = buf.slice(n + 1);
      if (!line) continue;
      const e = JSON.parse(line);
      if (e.type === "meta") meta = e;
      if (e.type === "plan") plan = e.plan;
      if (e.type === "error") error = e.message;
    }
  }
  const how = meta?.replayOf ? `replayed (recorded ${meta.replayOf})` : "ran fresh";
  console.log(`${req.artist} / ${req.region}: ${how} in ${((Date.now() - t0) / 1000).toFixed(1)}s · ${plan ? `${plan.stops.length} stops · ${plan.mode.agent}` : `no plan: ${error}`}`);
  if (!meta?.replayOf && i < demos.length - 1) await new Promise((r) => setTimeout(r, gapS * 1000));
}
