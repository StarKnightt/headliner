// Capture README / Devpost screenshots from a running instance.
// Usage: pnpm shots [baseUrl]   (uses the locally installed Chrome; SHOTS_CHANNEL=msedge to switch)
// Desktop shots are 1500x1000 (3:2, Devpost's gallery ratio). Warm the demos first (pnpm warm) so runs replay.
import { mkdirSync } from "node:fs";
import { chromium } from "playwright-core";

const base = process.argv[2] ?? "http://localhost:3123";
const out = new URL("../shots/", import.meta.url);
mkdirSync(out, { recursive: true });
const file = (n) => new URL(n, out).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ channel: process.env.SHOTS_CHANNEL ?? "chrome", args: ["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });

const FLY = 'button:has-text("Fly the tour")';
const panel = 'section[aria-label="Agent run"]';

async function demo(page, artist) {
  await page.getByRole("button", { name: new RegExp(`^${artist}`) }).first().click();
  await page.waitForSelector(FLY, { state: "detached", timeout: 10_000 }).catch(() => {});
  await page.waitForSelector(FLY, { timeout: 150_000 });
  await sleep(3800);
}

async function desktop() {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 }, deviceScaleFactor: 1 });
  await page.goto(base, { waitUntil: "load" });
  await page.evaluate(() => localStorage.clear());
  await page.goto(base, { waitUntil: "load" });
  await page.waitForSelector(FLY, { timeout: 150_000 });
  await sleep(4000);
  await page.screenshot({ path: file("01-desktop-overview.png") });

  await page.getByRole("tab", { name: /Soundcheck/ }).click();
  await page.locator(`${panel} button:has-text("show")`).nth(2).click().catch(() => {});
  await sleep(400);
  await page.screenshot({ path: file("02-agent-timeline.png") });

  await page.getByRole("tab", { name: /Itinerary/ }).click();
  await page.locator(`${panel} ol > li button[aria-pressed]`).nth(0).click();
  await sleep(3800);
  await page.screenshot({ path: file("03-stop-focus-hotspots.png") });

  await page.getByRole("tab", { name: /Qloo calls/ }).click();
  await sleep(300);
  await page.screenshot({ path: file("04-qloo-calls.png") });

  await demo(page, "AP Dhillon");
  await page.screenshot({ path: file("05-diaspora-run.png") });

  await demo(page, "Prateek Kuhad");
  await page.screenshot({ path: file("06-india-run.png") });

  await page.emulateMedia({ media: "print" });
  await page.screenshot({ path: file("07-print-booking-sheet.png"), fullPage: true });
  await page.emulateMedia({ media: "screen" });

  await page.goto(`${base}/how`, { waitUntil: "load" });
  await page.screenshot({ path: file("08-how-qloo-powers-this.png") });
  await page.close();
}

async function mobile() {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.goto(base, { waitUntil: "load" });
  await page.evaluate(() => localStorage.clear());
  await page.goto(base, { waitUntil: "load" });
  await page.waitForSelector(FLY, { timeout: 150_000 });
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
