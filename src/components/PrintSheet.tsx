import { OPPORTUNITY_LABEL, topShare } from "@/lib/plan/routing";
import type { TourPlan } from "@/lib/plan/schema";
import { AGE_LABEL } from "./ui";

const p3 = (x: number | null) => (x === null ? "n/a" : x.toFixed(3));

/** Booking sheet rendered only for print (window.print()). */
export function PrintSheet({ plan }: { plan: TourPlan }) {
  return (
    <div className="print-only" style={{ fontFamily: "var(--nf-body), Arial, sans-serif", color: "#111", fontSize: 11 }}>
      {plan.mode.qloo === "mock" && (
        <div style={{ border: "2px solid #111", padding: "6px 8px", marginBottom: 10, fontWeight: 700 }}>
          MOCK DATA: generated without a Qloo API key. Scores and matches are fixtures, not Qloo results.
        </div>
      )}
      <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "3px solid #111", paddingBottom: 6 }}>
        <div>
          <div style={{ fontSize: 9, letterSpacing: "0.2em", textTransform: "uppercase" }}>Headliner · booking sheet</div>
          <div style={{ fontFamily: "var(--nf-display), Impact, sans-serif", fontSize: 30, fontWeight: 900, textTransform: "uppercase", lineHeight: 1 }}>{plan.headline}</div>
        </div>
        <div style={{ textAlign: "right", fontSize: 10 }}>
          <div>
            <b>{plan.artist.name}</b>
          </div>
          <div>
            {plan.totals.stops} stops · {plan.totals.distanceKm.toLocaleString("en-US")} km
          </div>
          <div>{new Date(plan.generatedAt).toLocaleDateString("en-GB")}</div>
        </div>
      </div>
      <p style={{ margin: "8px 0 10px" }}>{plan.summary}</p>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #111", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em" }}>
            <th style={{ padding: "4px 4px 4px 0" }}>#</th>
            <th>City</th>
            <th>Fans rank in</th>
            <th>Aff. / pop.</th>
            <th>Read</th>
            <th>Hold venues</th>
            <th>Date</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {plan.stops.map((s) => (
            <tr key={s.cityId} style={{ borderBottom: "1px solid #ccc", verticalAlign: "top", breakInside: "avoid" }}>
              <td style={{ padding: "5px 4px 5px 0", fontWeight: 700 }}>{s.order}</td>
              <td>
                <b>{s.city}</b>, {s.country}
                <div style={{ fontSize: 9, color: "#444", maxWidth: 190 }}>{s.reason}</div>
              </td>
              <td>{topShare(s.fanAffinity)}</td>
              <td>
                {p3(s.fanAffinity)} / {p3(s.marketPopularity)}
              </td>
              <td>{OPPORTUNITY_LABEL[s.opportunity]}</td>
              <td>
                {s.venues.map((v) => (
                  <div key={v.id}>
                    ☐ {v.name}
                    {v.address ? <span style={{ color: "#555" }}>, {v.address}</span> : null}
                  </div>
                ))}
              </td>
              <td style={{ width: 60, borderBottom: "1px dotted #999" }} />
              <td style={{ width: 60, borderBottom: "1px dotted #999" }} />
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 12 }}>
        <div>
          <h4 style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", borderBottom: "1px solid #111" }}>Bill</h4>
          {plan.coHeadliners.map((c) => (
            <div key={c.id} style={{ marginTop: 4 }}>
              <b>{c.name}</b> ({c.role}, {p3(c.affinity)}): {c.why}
            </div>
          ))}
          <h4 style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", borderBottom: "1px solid #111", marginTop: 10 }}>Brand partners</h4>
          {plan.brandPartners.map((b) => (
            <div key={b.id} style={{ marginTop: 4 }}>
              <b>{b.name}</b> ({p3(b.affinity)}): {b.pitch}
            </div>
          ))}
        </div>
        <div>
          <h4 style={{ fontSize: 10, textTransform: "uppercase", letterSpacing: "0.12em", borderBottom: "1px solid #111" }}>Audience brief</h4>
          <div style={{ marginTop: 4 }}>{plan.audience.age.map((a) => `${AGE_LABEL[a.band] ?? a.band} ${a.affinity >= 0 ? "+" : ""}${a.affinity.toFixed(2)}`).join(" · ")}</div>
          <div style={{ marginTop: 4 }}>{plan.audience.tasteTags.map((t) => t.name).join(", ")}</div>
          {plan.audience.notes.map((n, i) => (
            <div key={i} style={{ marginTop: 4 }}>
              {n}
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 12, fontSize: 8.5, color: "#444", borderTop: "1px solid #999", paddingTop: 6 }}>
        {plan.caveats.map((c, i) => (
          <div key={i}>{c}</div>
        ))}
        <div style={{ marginTop: 4 }}>
          Taste data: Qloo ({plan.mode.qloo}). Agent: {plan.mode.agent}. {plan.totals.qlooCalls} Qloo calls ({plan.totals.cachedCalls} cached). Generated by Headliner.
        </div>
      </div>
    </div>
  );
}
