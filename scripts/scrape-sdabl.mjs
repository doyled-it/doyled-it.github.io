#!/usr/bin/env node
// Headless-render the SDABL division page and snapshot its <sm-division-detail>
// block into ~/vaults/baseball/sdabl-snapshots/<seasonId>.html so parse-sdabl
// can turn it into JSON.
//
// Usage:
//   node scripts/scrape-sdabl.mjs <seasonId> <urlOrPageNodeId>
// Example:
//   node scripts/scrape-sdabl.mjs spring2026 9397536

import puppeteer from "puppeteer";
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const [seasonId, arg] = process.argv.slice(2);
if (!seasonId || !arg) {
  console.error("usage: node scripts/scrape-sdabl.mjs <seasonId> <urlOrPageNodeId>");
  process.exit(1);
}

const url = /^https?:\/\//.test(arg)
  ? arg
  : `https://www.sdabl1.info/season_management_division_page/tab_standings?page_node_id=${arg}`;

const outDir = join(homedir(), "vaults/baseball/sdabl-snapshots");
if (!existsSync(outDir)) mkdirSync(outDir, { recursive: true });
const outPath = join(outDir, `${seasonId}.html`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

console.log(`🌐 launching headless browser...`);
const browser = await puppeteer.launch({
  headless: "new",
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1400, height: 2200 });
page.setDefaultTimeout(60000);

// The sdabl1.info page embeds the real content in an iframe pointed at
// season-microsites.ui.sportsengine.com. Resolve that iframe URL first,
// then drive it directly — much faster and skips the outer shell.
console.log(`↪  ${url}`);
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
await sleep(3000);

const iframeUrl = await page.evaluate(() => {
  const frames = Array.from(document.querySelectorAll("iframe"));
  const match = frames.find((f) =>
    /season-microsites\.ui\.sportsengine\.com/.test(f.src || ""),
  );
  return match?.src ?? null;
});
if (!iframeUrl) {
  console.error("❌ Could not find season-microsites iframe on the page.");
  process.exit(2);
}
console.log(`↪  iframe: ${iframeUrl}`);
await page.goto(iframeUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
await sleep(3000);
await page.waitForSelector("sm-division-detail", { timeout: 45000 });

async function waitForData() {
  await page
    .waitForFunction(
      () =>
        document.querySelector("sm-schedule-event") ||
        document.querySelector('tr[data-cy="team-record"]'),
      { timeout: 45000 },
    )
    .catch(() => {});
}

async function clickTab(tabCy) {
  const sel = `a[data-cy="${tabCy}"]`;
  const ok = await page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) return false;
    el.scrollIntoView();
    el.click();
    return true;
  }, sel);
  if (!ok) return false;
  await sleep(1500);
  return true;
}

async function pickSeasonStart() {
  // Open the "Jump To" date menu (data-cy="dateFilterMenu-filter") and
  // click the option whose label is "Season Start".
  const opened = await page.evaluate(() => {
    const chip = document.querySelector('[data-cy="dateFilterMenu-filter"] button');
    if (!chip) return false;
    chip.click();
    return true;
  });
  if (!opened) return false;
  await sleep(800);
  // Menu items render into the DOM after click; find one containing "Season Start".
  const picked = await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll("button, li, [role='menuitem']"));
    const match = candidates.find((el) =>
      /season\s*start/i.test(el.textContent || ""),
    );
    if (!match) return false;
    match.click();
    return true;
  });
  if (!picked) {
    console.warn("⚠️  Could not find 'Season Start' menu item.");
  }
  await sleep(1500);
  return picked;
}

async function collectScheduleEvents() {
  // sdabl uses Angular's `cdk-virtual-scroll` inside an `<sm-season>` container:
  // the window does not scroll; that element has its own scrollTop. Step through
  // it in small increments and harvest every event (with its date header) as they
  // enter the DOM, deduping by time+away+home.
  return await page.evaluate(async () => {
    const scroller = document.querySelector("sm-season") || document.scrollingElement;
    const seen = new Map();
    const keyOf = (ev) => {
      const time = ev.querySelector('[data-cy="event-time"]')?.textContent?.trim() || "";
      const away = ev.querySelector('[tag="away-team-name"] span')?.textContent?.trim() || "";
      const home = ev.querySelector('[tag="home-team-name"] span')?.textContent?.trim() || "";
      return `${time}|${away}@${home}`;
    };

    function harvest() {
      const children = Array.from(
        document.querySelectorAll("sm-schedule-header, sm-schedule-event"),
      );
      let currentHeader = null;
      for (const el of children) {
        if (el.tagName.toLowerCase() === "sm-schedule-header") {
          currentHeader = el.outerHTML;
          continue;
        }
        const k = keyOf(el);
        if (k && !seen.has(k)) {
          seen.set(k, { header: currentHeader, html: el.outerHTML });
        }
      }
    }

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    scroller.scrollTop = 0;
    await sleep(300);
    const step = 400;
    let stableLoops = 0;
    let lastSize = 0;
    for (let pass = 0; pass < 200; pass++) {
      harvest();
      if (seen.size === lastSize) stableLoops++;
      else {
        stableLoops = 0;
        lastSize = seen.size;
      }
      const reachedBottom =
        scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 4;
      if (reachedBottom && stableLoops >= 6) break;
      scroller.scrollTop += step;
      await sleep(160);
    }
    scroller.scrollTop = 0;
    await sleep(200);
    harvest();

    let html = "";
    let lastHeaderHTML = "";
    for (const { header, html: evH } of seen.values()) {
      if (header && header !== lastHeaderHTML) {
        html += header;
        lastHeaderHTML = header;
      }
      html += evH;
    }
    return { count: seen.size, html };
  });
}

// --- Schedule tab: click, then choose Season Start, then collect all events ---
console.log(`📅 schedule tab → Season Start`);
await clickTab("schedule-tab");
await waitForData();
await pickSeasonStart();
const { count: evCount, html: scheduleEvents } = await collectScheduleEvents();
console.log(`   collected ${evCount} unique events during scroll`);
const scheduleHtml = `<sm-schedule2>${scheduleEvents}</sm-schedule2>`;

// --- Standings tab ---
console.log(`🏆 standings tab`);
await clickTab("standings-tab");
await sleep(1500);
await page
  .waitForSelector('tr[data-cy="team-record"]', { timeout: 30000 })
  .catch(() => {});

const standingsHtml = await page
  .$eval("#standings, sm-division-standings", (el) => el.outerHTML)
  .catch(() => "");

await browser.close();

if (!scheduleHtml && !standingsHtml) {
  console.error("❌ Failed to capture any content.");
  process.exit(2);
}

const combined = `<sm-division-detail>\n${scheduleHtml}\n${standingsHtml}\n</sm-division-detail>\n`;
writeFileSync(outPath, combined);

const sched = (scheduleHtml.match(/<sm-schedule-event/g) || []).length;
const finals = (scheduleHtml.match(/<sm-event-final-score|data-cy="event-final-score"|>Final</g) || []).length;
const teams = (standingsHtml.match(/data-cy="team-record"/g) || []).length;
console.log(
  `✅ captured ${sched} schedule events (${finals} final) + ${teams} standings rows → ${outPath}`,
);
