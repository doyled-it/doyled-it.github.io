#!/usr/bin/env node
// Sync personal stats from Obsidian vaults into src/_data/.
// Runs `process-stats.js` in each vault so the JSON is fresh, then copies it.

import { execSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
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
      `⚠️  golf: fetch failed (Cloudflare captcha, no creds, or network) — keeping existing src/_data/golf-raw.json`,
    );
  }
} else {
  console.log(`⏩ golf: --skip-golf-fetch passed, leaving src/_data/golf-raw.json as-is`);
}

// SDABL league data is refreshed separately by scripts/update-league.mjs
// (`npm run update:league`), which reads scripts/sdabl-sources.json and needs
// no Obsidian vault. `npm run update:stats` runs it after this script.
