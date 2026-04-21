#!/usr/bin/env node
// Sync personal stats from Obsidian vaults into src/_data/.
// Runs `process-stats.js` in each vault so the JSON is fresh, then copies it.

import { execSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const home = homedir();

const sources = [
  {
    name: "baseball",
    vault: join(home, "vaults/baseball"),
    processor: "process-stats.js",
    vaultFile: "stats-data.json",
    siteFile: join(repoRoot, "src/_data/baseball.json"),
  },
];

for (const src of sources) {
  if (!existsSync(src.vault)) {
    console.warn(`⚠️  ${src.name}: vault not found at ${src.vault} — skipping`);
    continue;
  }

  console.log(`🔄 ${src.name}: pulling latest from origin...`);
  try {
    execSync("git pull --ff-only", { cwd: src.vault, stdio: "inherit" });
  } catch {
    console.warn(`⚠️  ${src.name}: git pull failed — continuing with local state`);
  }

  const processorPath = join(src.vault, src.processor);
  if (existsSync(processorPath)) {
    console.log(`⚙️  ${src.name}: regenerating ${src.vaultFile}...`);
    execSync(`node ${src.processor}`, { cwd: src.vault, stdio: "inherit" });
  }

  const from = join(src.vault, src.vaultFile);
  mkdirSync(dirname(src.siteFile), { recursive: true });
  copyFileSync(from, src.siteFile);
  console.log(`✅ ${src.name}: copied → ${src.siteFile}\n`);
}

// Golf: GHIN's API is behind Cloudflare and blocks datacenter IPs, so this
// must run from a residential IP (your laptop, not CI). Hit the API directly
// via the doyled-it/ghin fork — no sibling repo hop needed.
const skipGolfFetch = process.argv.includes("--skip-golf-fetch");
if (!skipGolfFetch) {
  console.log(`🏌️  golf: pulling fresh GHIN data...`);
  try {
    execSync("node scripts/fetch-golf.mjs", { cwd: repoRoot, stdio: "inherit" });
  } catch {
    console.warn(
      `⚠️  golf: fetch failed (Cloudflare captcha, no creds, or network) — keeping existing src/_data/golf.json`,
    );
  }
} else {
  console.log(`⏩ golf: --skip-golf-fetch passed, leaving src/_data/golf.json as-is`);
}

// Refresh SDABL league data.
// sources.json maps seasonId → page_node_id (or full URL) on sdabl1.info.
// For each configured source we run the headless scraper, then parse to JSON.
// If a season has no entry in sources.json but has a pre-existing <seasonId>.html
// snapshot, we parse that without re-scraping.
const snapDir = join(home, "vaults/baseball/sdabl-snapshots");
if (existsSync(snapDir)) {
  const scraper = join(repoRoot, "scripts/scrape-sdabl.mjs");
  const parser = join(repoRoot, "scripts/parse-sdabl.mjs");

  const sourcesPath = join(snapDir, "sources.json");
  const sources = existsSync(sourcesPath)
    ? JSON.parse(readFileSync(sourcesPath, "utf8"))
    : {};

  const seasons = new Set([
    ...Object.keys(sources),
    ...readdirSync(snapDir)
      .filter((f) => f.endsWith(".html"))
      .map((f) => basename(f, ".html")),
  ]);

  for (const seasonId of seasons) {
    const ref = sources[seasonId];
    if (ref) {
      console.log(`🌐 sdabl: scraping ${seasonId}...`);
      try {
        execSync(`node ${scraper} ${seasonId} ${ref}`, { cwd: repoRoot, stdio: "inherit" });
      } catch {
        console.warn(`⚠️  sdabl: scrape failed for ${seasonId} — falling back to existing snapshot`);
      }
    }
    const htmlPath = join(snapDir, `${seasonId}.html`);
    if (!existsSync(htmlPath)) {
      console.warn(`⚠️  sdabl: no snapshot for ${seasonId} — skipping parse`);
      continue;
    }
    console.log(`🏟️  sdabl: parsing ${seasonId}...`);
    try {
      execSync(`node ${parser} ${seasonId} ${htmlPath}`, { cwd: repoRoot, stdio: "inherit" });
    } catch {
      console.warn(`⚠️  sdabl: parse failed for ${seasonId}`);
    }
  }
}
