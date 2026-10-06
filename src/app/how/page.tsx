import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "How Qloo powers Headliner",
  description: "Every Qloo request Headliner makes, what comes back, and how the agent reads it.",
};

const CHAIN: { title: string; req: string; got: string; why: string }[] = [
  {
    title: "Resolve the artist",
    req: "GET /search?query=Khruangbin&types=urn:entity:artist&take=5",
    got: "Khruangbin · popularity 0.992 (top 0.8% of artists)",
    why: "A typed name becomes a Qloo entity ID. Every later call uses that ID as the taste signal.",
  },
  {
    title: "Find the room categories",
    req: "GET /v2/tags?filter.query=live music venue&feature.semantic_search=true&take=10",
    got: "urn:tag:category:place:live_music_venue, plus concert_hall, night_club, jazz_club, performing_arts_theater, arena, amphitheater",
    why: "Tags must be real Qloo IDs. Room size maps to place categories, because Qloo has no venue capacities.",
  },
  {
    title: "Read one heatmap across the whole territory",
    req: "GET /v2/insights?filter.type=urn:heatmap&signal.interests.entities=<artist>&filter.location=POLYGON((-126 24,-52 24,-52 57,-126 57,-126 24))",
    got: "5,497 geohash cells (about 40 km each). Burlington, VT: affinity 0.992, popularity 0.976. Atlanta: 0.892.",
    why: "One call scores all 67 North American candidates: each city is read at the cell its centre falls in, and the best cell within 35 km is kept as a metro peak.",
  },
  {
    title: "Match rooms to the crowd",
    req: "GET /v2/insights?filter.type=urn:entity:place&signal.interests.entities=<artist>&filter.location.query=Portland, Oregon&filter.tags=urn:tag:category:place:live_music_venue&take=7",
    got: "Oregon Contemporary 0.847, Wonder Ballroom 0.841 · locality: Portland, Multnomah County, Oregon, United States",
    why: "Places whose crowd matches this audience, real rooms listed before restaurants that merely host gigs. The resolved locality proves which Portland it was.",
  },
  {
    title: "Map neighbourhood hotspots",
    req: "GET /v2/insights?filter.type=urn:heatmap&signal.interests.entities=<artist>&filter.location.query=Austin, Texas",
    got: "About 700 cells of 150 m; the strongest 45 become the columns on the globe",
    why: "Where in town the audience clusters: where the street team puts up posters.",
  },
  {
    title: "Build the bill",
    req: "GET /v2/insights?filter.type=urn:entity:artist&signal.interests.entities=<artist>&filter.exclude.entities=<artist>&filter.popularity.min=0.976&filter.popularity.max=0.9973&take=6",
    got: "Peers: SAULT, Menahan Street Band, Jungle · support: Arc De Soleil, Glass Beams, Mildlife",
    why: "Every touring act sits above the 90th popularity percentile, so peer and support bands are set on a multiplicative scale. A younger-crowd request adds signal.demographics.age=24_and_younger.",
  },
  {
    title: "Find merch partners",
    req: "GET /v2/insights?filter.type=urn:entity:brand&signal.interests.entities=<artist>&take=12",
    got: "Patagonia 0.973, Fjällräven 0.941, The North Face 0.938 (regional duplicates merged)",
    why: "Cross-domain affinity: brands the fans over-index on. An LLM can guess a vibe; it cannot measure this.",
  },
  {
    title: "Brief the designers",
    req: "GET /v2/insights?filter.type=urn:tag&signal.interests.entities=<artist>&filter.tag.types=urn:tag:genre:music,urn:tag:style:qloo,urn:tag:audience:qloo,…&diversify.by=subtype&diversify.take=4",
    got: "Sound: lo-fi, beats, instrumental hip hop · style: sultry, dreamlike · plus urn:demographics: peak age 35-44 (+0.29)",
    why: "Taste across music, style, audience descriptors, themes and media in one call, grouped for the poster brief. Aggregate only.",
  },
];

const LESSONS = [
  "Locality-boundary heatmaps (output.heatmap.boundary=urn:entity:locality) returned a 500 on the hackathon host for every area tried, so cities are read from geohash cells instead.",
  "A text query like “Europe” resolves to no cells; WKT polygons cover multi-country territories. India works as a country query.",
  "take is ignored for heatmaps: a territory call returns thousands of cells, so Headliner caches a packed copy.",
  "Some Indian city names (Shillong) do not resolve as localities. Headliner retries those calls with a 20 km WKT point.",
  "Explainability is 1.0 for a single signal and splits almost evenly across a multi-artist bill, so Headliner shows it as provenance rather than as an insight.",
  "The hackathon key allows 5 requests per second and 10,000 a month. Headliner spaces requests, caches responses for a week and replays identical runs.",
];

export default function HowPage() {
  return (
    <main className="grain mx-auto max-w-3xl px-5 py-12 text-ink">
      <Link href="/" className="font-mono text-[12px] text-dim hover:text-ink">
        ← Back to the globe
      </Link>
      <h1 className="mt-4 font-display text-6xl font-black uppercase leading-[0.9]">
        How Qloo <span className="text-sodium">powers</span> Headliner
      </h1>
      <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-ink/85">
        Headliner is an agent with eight Qloo-backed tools. A research pass gathers the evidence; an LLM (gpt-oss-120b on Groq, through function calling) picks the
        cities, rooms, bill and brands, and can ask for more rooms or acts before it submits. The plan may only cite what Qloo returned: the server checks every ID and
        every number in every reason, sends a bad draft back once, fills in the figures itself and drops anything invented.
      </p>
      <p className="mt-3 text-[13px] text-dim">Real requests and results from a North America run for Khruangbin (October 2026). The key is never shown.</p>

      <ol className="mt-10 space-y-8">
        {CHAIN.map((c, i) => (
          <li key={c.title} className="grid grid-cols-[2.75rem_1fr] gap-3">
            <span className="font-display text-4xl font-black leading-none text-sodium">{i + 1}</span>
            <div>
              <h2 className="font-display text-2xl font-extrabold uppercase">{c.title}</h2>
              <code className="mt-1.5 block break-all rounded-sm bg-deck px-2.5 py-2 font-mono text-[11.5px] leading-relaxed text-gem">{c.req}</code>
              <p className="mt-1.5 font-mono text-[11.5px] leading-relaxed text-amber">{c.got}</p>
              <p className="mt-2 text-[14px] leading-relaxed text-ink/80">{c.why}</p>
            </div>
          </li>
        ))}
      </ol>

      <section className="mt-14">
        <h2 className="font-display text-3xl font-extrabold uppercase">Reading the numbers</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-ink/80">
          Heatmap affinity and popularity are percentiles across every cell in the territory, so big cities crowd the top: in North America every primary market sits
          between 0.88 and 1.0. Headliner reads them on a log scale of how far into the top a city sits (top 0.1% scores 0.98, top 1% 0.85, top 3% 0.70) and compares the
          fan rank with the popularity rank. A hidden gem is a city whose fans rank in the top 3% and clearly ahead of its market, like Burlington, Missoula and Santa
          Fe for Khruangbin, or Brighton and Bristol for Arlo Parks. The thresholds were set on live heatmaps for 12 artists across all six territories.
        </p>
        <p className="mt-3 text-[14px] leading-relaxed text-ink/80">
          The signal is geographic, not just population: Morgan Wallen&apos;s audience peaks in Nashville (0.994) and falls to 0.49 in San Francisco, and AP Dhillon&apos;s
          North America run comes out all-Canadian, with the strongest cells 20 to 25 km outside Toronto and Vancouver.
        </p>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-3xl font-extrabold uppercase">What building on the API taught us</h2>
        <ul className="mt-3 space-y-2 text-[14px] leading-relaxed text-ink/80">
          {LESSONS.map((l) => (
            <li key={l} className="border-l border-sodium/40 pl-3">
              {l}
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12 rounded-md border border-ink/10 p-5">
        <h2 className="font-display text-2xl font-extrabold uppercase">What it does not claim</h2>
        <ul className="mt-2 space-y-1.5 text-[14px] leading-relaxed text-ink/80">
          <li>Affinity is an aggregate taste signal for audiences in a place. It is not a ticket-sales forecast or a fact about any person.</li>
          <li>&ldquo;Hidden gem&rdquo;, &ldquo;stronghold&rdquo; and the 0 to 100 score are Headliner&apos;s interpretation of Qloo&apos;s numbers, not Qloo metrics.</li>
          <li>Room size is a place-category filter. Capacity, availability, routing days and visas still need a human agent.</li>
          <li>No personal data is sent to Qloo: only the artist ID, public city names, coordinates and tag IDs.</li>
        </ul>
      </section>

      <p className="mt-10 text-[12px] text-faint">
        Earth at night: NASA Earth Observatory, Black Marble 2016 (public domain). Every Qloo request from a run is listed in the &ldquo;Qloo calls&rdquo; tab.
      </p>
    </main>
  );
}
