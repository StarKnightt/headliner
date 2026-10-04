// Capture README / Devpost screenshots from a running instance.
// Usage: pnpm dev (or pnpm start) in one terminal, then `pnpm shots [baseUrl]`.
// Uses the locally installed Chrome (channel "chrome"); set SHOTS_CHANNEL=msedge to switch.
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

const base = process.argv[2] ?? "http://localhost:3123";
const out = new URL("../shots/", import.meta.url);
mkdirSync(out, { recursive: true });
const file = (n) => new URL(n, out).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ channel: process.env.SHOTS_CHANNEL ?? "chrome", args: ["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });

const FLY = 'button:has-text("Fly the tour")';

async function runPlan(page, { artist, region, stops }) {
  await page.waitForSelector(FLY, { timeout: 60_000 });
  await page.fill("#artist", artist);
  await page.getByRole("button", { name: region, exact: true }).click();
  if (stops) await page.locator("#stops").fill(String(stops));
  await page.getByRole("button", { name: /Route the tour/ }).click();
  await page.waitForSelector(FLY, { state: "detached", timeout: 10_000 }).catch(() => {});
  await page.waitForSelector(FLY, { timeout: 120_000 });
  await sleep(3500);
}

async function desktop() {
  const page = await browser.newPage({ viewport: { width: 1600, height: 960 }, deviceScaleFactor: 1 });
  await page.goto(base, { waitUntil: "load" });
  await page.evaluate(() => localStorage.clear());
  await page.goto(base, { waitUntil: "load" });

  await runPlan(page, { artist: "Khruangbin", region: "North America" });
  await page.screenshot({ path: file("01-desktop-overview.png") });

  await page.getByRole("tab", { name: /Soundcheck/ }).click();
  await page.getByRole("button", { name: /show 2 Qloo calls/ }).first().click().catch(() => {});
  await sleep(400);
  await page.screenshot({ path: file("02-agent-timeline.png") });

  await page.getByRole("tab", { name: /Itinerary/ }).click();
  const stop = page.locator("main ol > li button").nth(3);
  await stop.click();
  await sleep(3800);
  await page.screenshot({ path: file("03-stop-focus-hotspots.png") });

  await page.getByRole("tab", { name: /Qloo calls/ }).click();
  await sleep(300);
  await page.screenshot({ path: file("04-qloo-calls.png") });

  await runPlan(page, { artist: "Prateek Kuhad", region: "India", stops: 6 });
  await page.screenshot({ path: file("05-india-run.png") });

  await runPlan(page, { artist: "Fred again..", region: "Europe", stops: 9 });
  await page.screenshot({ path: file("06-europe-run.png") });

  await page.emulateMedia({ media: "print" });
  await page.screenshot({ path: file("07-print-booking-sheet.png"), fullPage: true });
  await page.emulateMedia({ media: "screen" });

  await page.goto(`${base}/how`, { waitUntil: "load" });
  await page.screenshot({ path: file("08-how-qloo-powers-this.png"), fullPage: true });
  await page.close();
}

async function mobile() {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto(base, { waitUntil: "load" });
  await page.evaluate(() => localStorage.clear());
  await page.goto(base, { waitUntil: "load" });
  await page.waitForSelector(FLY, { timeout: 60_000 });
  await sleep(3500);
  await page.screenshot({ path: file("09-mobile.png") });
  await page.close();
}

try {
  await desktop();
  await mobile();
  console.log("Screenshots written to", file(""));
} finally {
  await browser.close();
}
