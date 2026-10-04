import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "How Qloo powers Headliner" };

const CHAIN: { n: string; title: string; req: string; why: string }[] = [
  {
    n: "01",
    title: "Resolve the artist",
    req: "GET /search?query=Khruangbin&types=urn:entity:artist&take=5",
    why: "Turns a typed name into a Qloo entity ID. Every later call uses that ID as the taste signal.",
  },
  {
    n: "02",
    title: "Discover venue tags",
    req: "GET /v2/tags?filter.query=music venue&feature.semantic_search=true&filter.parents.types=urn:entity:place",
    why: "Tags must be real Qloo IDs, not free text. The agent looks them up instead of guessing.",
  },
  {
    n: "03",
    title: "Score fan affinity per city",
    req: "GET /v2/insights?filter.type=urn:heatmap&signal.interests.entities=<artist>&filter.location.query=United States&output.heatmap.boundary=urn:entity:locality&take=50",
    why: "One call per country or region returns city-level affinity and popularity. Strong affinity with modest popularity marks a hidden-gem market: the fans are there, the market isn't saturated.",
  },
  {
    n: "04",
    title: "Map neighbourhood hotspots",
    req: "GET /v2/insights?filter.type=urn:heatmap&signal.interests.entities=<artist>&filter.location.query=Chicago&take=40",
    why: "Geohash cells show where in town the audience clusters: the columns on the globe, and where to put posters and pop-ups.",
  },
  {
    n: "05",
    title: "Match rooms to the crowd",
    req: "GET /v2/insights?filter.type=urn:entity:place&signal.interests.entities=<artist>&filter.location.query=Chicago&filter.tags=<venue tag>&filter.popularity.min=0.65&filter.popularity.max=0.92&feature.explainability=true&take=4",
    why: "Venues ranked by how well their crowd matches this artist's audience, within a popularity band that stands in for room size.",
  },
  {
    n: "06",
    title: "Build the bill",
    req: "GET /v2/insights?filter.type=urn:entity:artist&signal.interests.entities=<artist>&filter.exclude.entities=<artist>&filter.popularity.max=<artist−0.03>&feature.explainability=true",
    why: "Co-headliners at a similar popularity and support acts below it, all with overlapping audiences. Explainability shows the overlap comes from this artist.",
  },
  {
    n: "07",
    title: "Find merch partners",
    req: "GET /v2/insights?filter.type=urn:entity:brand&signal.interests.entities=<artist>&feature.explainability=true&take=8",
    why: "Cross-domain affinity: brands the fans over-index on. This is the step an LLM can't fake.",
  },
  {
    n: "08",
    title: "Brief the designers",
    req: "GET /v2/insights?filter.type=urn:demographics&signal.interests.entities=<artist>  ·  GET /v2/insights?filter.type=urn:tag&signal.interests.entities=<artist>",
    why: "Aggregate age and gender affinity plus taste-analysis tags for poster and merch direction. Aggregate only, never about individuals.",
  },
];

export default function HowPage() {
  return (
    <main className="grain mx-auto max-w-3xl px-5 py-12 text-ink">
      <Link href="/" className="micro text-dim hover:text-ink">
        ← Back to the globe
      </Link>
      <h1 className="mt-4 font-display text-6xl font-black uppercase leading-[0.9]">
        How Qloo <span className="text-sodium">powers</span> Headliner
      </h1>
      <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink/85">
        Headliner is an agent with eight Qloo-backed tools. An LLM (Groq or OpenAI, via function calling) decides which to call and writes the reasons. The plan it
        submits can only cite cities, venues, artists and brands that came back from Qloo. The server checks every ID against the evidence ledger, fills in the
        numbers itself, and drops anything the model invented. Without an LLM key the same tools run in a fixed order.
      </p>

      <ol className="mt-10 space-y-6">
        {CHAIN.map((c) => (
          <li key={c.n} className="grid grid-cols-[3.5rem_1fr] gap-3">
            <span className="font-display text-5xl font-black leading-none text-sodium">{c.n}</span>
            <div>
              <h2 className="font-display text-2xl font-extrabold uppercase">{c.title}</h2>
              <code className="mt-1.5 block break-all rounded-sm bg-deck px-2.5 py-2 font-mono text-[11.5px] leading-relaxed text-gem">{c.req}</code>
              <p className="mt-2 text-[14px] leading-relaxed text-ink/80">{c.why}</p>
            </div>
          </li>
        ))}
      </ol>

      <section className="mt-12 rounded-md border border-ink/10 p-5">
        <h2 className="font-display text-2xl font-extrabold uppercase">What it doesn&apos;t claim</h2>
        <ul className="mt-2 space-y-1.5 text-[14px] leading-relaxed text-ink/80">
          <li>— Affinity is an aggregate taste signal for audiences in a place. It is not a ticket-sales forecast or a fact about any person.</li>
          <li>— &ldquo;Hidden gem&rdquo;, &ldquo;stronghold&rdquo; and the 0–100 score are Headliner&apos;s interpretation of Qloo&apos;s affinity and popularity, not Qloo metrics.</li>
          <li>— No personal data is sent to Qloo: only the artist ID, public city names and tag IDs.</li>
          <li>— Calls run server-side with a 24-hour cache and bounded retries. The key never reaches the browser.</li>
        </ul>
      </section>

      <p className="mt-10 text-[12px] text-faint">
        Earth at night: NASA Earth Observatory / Black Marble 2016 (public domain). Every Qloo request from a run is listed in the &ldquo;Qloo calls&rdquo; tab.
      </p>
    </main>
  );
}
