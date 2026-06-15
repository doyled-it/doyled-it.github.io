#!/usr/bin/env node
// Refresh league.json from sdabl1.info without depending on the local Obsidian
// vault — built for a self-hosted CI runner (residential IP), but works locally
// too. Reads scripts/sdabl-sources.json (seasonId -> page_node_id), scrapes each
// listed season into a snapshot dir, then parses each snapshot into league.json.
//
// sdabl1.info blocks datacenter IPs, so this only works from a residential
// connection. Scrape/parse failures are logged and skipped, never fatal, so a
// transient miss leaves the existing league.json untouched rather than wiping it.
//
// Env:
//   SDABL_SNAPSHOT_DIR  where snapshot HTML is written (default: ./.sdabl-snapshots)

import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");
const sourcesPath = join(here, "sdabl-sources.json");
const snapDir = process.env.SDABL_SNAPSHOT_DIR || join(repoRoot, ".sdabl-snapshots");

if (!existsSync(sourcesPath)) {
  console.error(`error: ${sourcesPath} not found`);
  process.exit(1);
}

const sources = JSON.parse(readFileSync(sourcesPath, "utf8"));
mkdirSync(snapDir, { recursive: true });

const env = { ...process.env, SDABL_SNAPSHOT_DIR: snapDir };
let parsed = 0;

for (const [seasonId, ref] of Object.entries(sources)) {
  if (seasonId.startsWith("_")) continue; // skip _comment and friends

  console.log(`\n🌐 sdabl: scraping ${seasonId} (${ref})...`);
  try {
    execSync(`node ${join(here, "scrape-sdabl.mjs")} ${seasonId} ${ref}`, {
      cwd: repoRoot,
      stdio: "inherit",
      env,
    });
  } catch {
    console.warn(`⚠️  sdabl: scrape failed for ${seasonId} — falling back to existing snapshot if present`);
  }

  const htmlPath = join(snapDir, `${seasonId}.html`);
  if (!existsSync(htmlPath)) {
    console.warn(`⚠️  sdabl: no snapshot for ${seasonId} — skipping parse`);
    continue;
  }

  console.log(`🏟️  sdabl: parsing ${seasonId}...`);
  try {
    execSync(`node ${join(here, "parse-sdabl.mjs")} ${seasonId} ${htmlPath}`, {
      cwd: repoRoot,
      stdio: "inherit",
    });
    parsed++;
  } catch {
    console.warn(`⚠️  sdabl: parse failed for ${seasonId}`);
  }
}

console.log(`\n✅ league: refreshed ${parsed} season(s) → src/_data/league.json`);
