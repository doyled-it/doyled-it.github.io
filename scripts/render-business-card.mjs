#!/usr/bin/env node
// Render the business card front + back from docs/business-card-mockup.html
// to ~/Downloads, in two flavors:
//
//   business-card-{front,back}-with-guides.png  — trim size with dashed
//                                                 safety overlay (review)
//   business-card-{front,back}.png              — bleed size, ready to
//                                                 upload to print vendor
//
// Bleed canvas is 405 x 242 px at the mockup's 4.27 px/mm scale,
// representing 95.25 x 57.15 mm = Jukebox 3.75" x 2.25" bleed area.
// The cream background extends to all four edges, and the pink→yellow
// titlebar gradient extends 12 px past trim at the top (so even with
// ±1 mm cut tolerance, no white edge appears). Rounded corners are NOT
// rendered in the print export — the printer cuts them per the
// "Rounded .25"" finish.
//
// Run: node scripts/render-business-card.mjs

import puppeteer from "puppeteer";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const mockupPath = path.join(repoRoot, "docs/business-card-mockup.html");
const downloads = path.join(os.homedir(), "Downloads");

const browser = await puppeteer.launch({ args: ["--no-sandbox"] });
const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 1200, deviceScaleFactor: 4 });
await page.goto(`file://${mockupPath}`, { waitUntil: "networkidle0" });

// Pass 1: trim-size shots with dashed safety guide visible — for review.
for (const which of ["front", "back"]) {
  const el = await page.$(`.bizcard.${which}`);
  await el.screenshot({ path: path.join(downloads, `business-card-${which}-with-guides.png`) });
}

// Pass 2: bleed-extended shots — cream + titlebar gradient extend past
// trim on all sides so the printer's cut tolerance never exposes white.
await page.addStyleTag({ content: `
  .bleed-export {
    display: block;
    width: 405px; height: 242px;
    box-sizing: border-box;
    padding: 12px 13px;
    background: #fffbe6;
    position: relative;
    overflow: hidden;
  }
  /* Single full-bleed gradient strip (12px bleed-top + ~32px titlebar
     height = 44px) — covers the entire top band INCLUDING where the
     inner titlebar would render its own gradient. With one continuous
     gradient there's no progression mismatch / visible seam. */
  .bleed-export::before {
    content: ""; position: absolute; left: 0; right: 0; top: 0;
    height: 44px;
    background: linear-gradient(90deg, #ff6fb3 0%, #ffe14d 100%);
    z-index: 1;
  }
  /* Black separator line just below the gradient strip, spanning the
     full bleed width so the line continues past trim. */
  .bleed-export::after {
    content: ""; position: absolute; left: 0; right: 0;
    top: 44px; height: 2px;
    background: #000;
    z-index: 2;
  }
  /* No z-index here — that would create a new stacking context and
     trap the titlebar text below the wrap's gradient. */
  .bleed-export .bizcard {
    border-radius: 0 !important;
    background: transparent !important;
  }
  /* Strip the bizcard's own titlebar gradient + border-bottom so they
     don't double up with the full-bleed strip. Titlebar text still
     renders, lifted above the gradient via z-index. */
  .bleed-export .titlebar {
    background: transparent !important;
    border-bottom: 0 !important;
    position: relative; z-index: 3;
  }
  .bleed-export .bizcard::after { display: none !important; }
` });
await page.evaluate(() => {
  document.querySelectorAll(".bizcard").forEach((c) => {
    const which = c.classList.contains("front") ? "front-bleed" : "back-bleed";
    const wrap = document.createElement("div");
    wrap.className = `bleed-export ${which}`;
    c.parentNode.insertBefore(wrap, c);
    wrap.appendChild(c);
  });
});

for (const which of ["front", "back"]) {
  const el = await page.$(`.bleed-export.${which}-bleed`);
  await el.screenshot({ path: path.join(downloads, `business-card-${which}.png`) });
}

await browser.close();
console.log(`wrote 4 PNGs to ${downloads}`);
