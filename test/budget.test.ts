import { beforeAll, describe, expect, it } from "vitest";

beforeAll(() => {
  process.env.QLOO_DURABLE_CACHE = "0";
});

describe("claimMeteredRun", () => {
  it("grants slots up to the daily limit, then refuses", async () => {
    const { claimMeteredRun } = await import("@/lib/agent/budget");
    const results = [];
    for (let i = 0; i < 4; i++) results.push(await claimMeteredRun(3));
    expect(results.map((r) => r.ok)).toEqual([true, true, true, false]);
    expect(results[3]).toMatchObject({ used: 3, limit: 3, store: "memory" });
  });

  it("refuses everything when the limit is zero", async () => {
    const { claimMeteredRun } = await import("@/lib/agent/budget");
    expect((await claimMeteredRun(0)).ok).toBe(false);
  });
});
