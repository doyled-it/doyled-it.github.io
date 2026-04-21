#!/usr/bin/env node
// Parse a pasted SDABL division-page HTML snapshot into structured JSON.
// Usage:
//   node scripts/parse-sdabl.mjs <season-id> <path-to-html>
// Writes (or merges into) src/_data/league.json under the given season.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");
const outPath = join(repoRoot, "src/_data/league.json");

const [seasonId, htmlPath] = process.argv.slice(2);
if (!seasonId || !htmlPath) {
  console.error("usage: node scripts/parse-sdabl.mjs <seasonId> <htmlPath>");
  process.exit(1);
}
if (!existsSync(htmlPath)) {
  console.error(`html snapshot not found: ${htmlPath}`);
  process.exit(1);
}

const html = readFileSync(htmlPath, "utf8");
const decode = (s) =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
const clean = (s) => decode(s).replace(/\s+/g, " ").trim();

// ---- Parse standings ----
function parseStandings() {
  const out = [];
  const rowRe = /<tr[^>]*data-cy="team-record"[^>]*>([\s\S]*?)<\/tr>/g;
  let m;
  while ((m = rowRe.exec(html))) {
    const row = m[1];
    const rank = (row.match(/data-cy="team-rank"[^>]*>\s*([^<]+)\s*</) || [])[1];
    const nameMatch = row.match(/tag="team-link-standings"[\s\S]*?<span>([^<]+)<\/span>/);
    if (!nameMatch) continue;
    const name = clean(nameMatch[1]);
    if (name === "BYE") continue;
    const statNums = [...row.matchAll(/data-cy="stat-number"[^>]*>\s*([^<]+)\s*</g)].map((x) => clean(x[1]));
    if (statNums.length < 8) continue;
    const [W, L, T, GP, PCT, GB, RF, RA] = statNums;
    out.push({
      rank: Number(clean(rank)),
      team: name,
      W: Number(W), L: Number(L), T: Number(T), GP: Number(GP),
      PCT: Number(PCT),
      GB: GB === "-" ? 0 : Number(GB),
      RF: Number(RF), RA: Number(RA),
      diff: Number(RF) - Number(RA),
    });
  }
  return out;
}

// ---- Parse schedule events grouped by date ----
function parseSchedule() {
  const out = [];
  // Split on sm-list-header blocks to get date groups, but events appear inline.
  // Approach: walk linearly, tracking the most recent list header.
  const tokenRe = /<sm-list-header[\s\S]*?<span[^>]*data-cy="day-of-week-header"[^>]*>([^<]*)<\/span>\s*<span[^>]*data-cy="month-day-header"[^>]*>([^<]*)<\/span>[\s\S]*?<\/sm-list-header>|<sm-schedule-event[\s\S]*?<\/sm-schedule-event>/g;
  let m;
  let currentDate = "";
  let currentDow = "";
  while ((m = tokenRe.exec(html))) {
    const full = m[0];
    if (full.startsWith("<sm-list-header")) {
      currentDow = clean(m[1]);
      currentDate = clean(m[2]);
      continue;
    }
    // schedule event
    const ev = full;
    const time = clean((ev.match(/data-cy="event-time"[^>]*>\s*([^<]+)\s*</) || [])[1] || "");
    const statusClass = (ev.match(/class="(sm-schedule-status--[a-z]+)"/) || [])[1] || "";
    const statusText = clean((ev.match(/data-cy="event-status"[^>]*>\s*([^<]+?)\s*</) || [])[1] || "");
    const away = (ev.match(/tag="away-team-name"[\s\S]*?<span>([^<]+)<\/span>/) || [])[1];
    const home = (ev.match(/tag="home-team-name"[\s\S]*?<span>([^<]+)<\/span>/) || [])[1];
    const awayRec = (ev.match(/data-cy="away-team-record"[^>]*>\s*\(([^)]+)\)/) || [])[1];
    const homeRec = (ev.match(/data-cy="home-team-record"[^>]*>\s*\(([^)]+)\)/) || [])[1];
    const venue = (ev.match(/data-cy="venue-name"[\s\S]*?<\/span>\s*([^<]+)</) || [])[1];
    const sub = (ev.match(/data-cy="subvenue-name"[\s\S]*?<\/span>\s*([^<]+)</) || [])[1];
    const scoreRaw = clean((ev.match(/data-cy="game-score"[^>]*>\s*([^<]+?)\s*</) || [])[1] || "");
    const recap = (ev.match(/href="(https:\/\/game-recap[^"]+)"/) || [])[1];
    if (!away || !home) continue;
    if (/^BYE$/i.test(clean(away)) || /^BYE$/i.test(clean(home))) continue;

    const isFinal = /completed/.test(statusClass) || /^final/i.test(statusText) || !!scoreRaw;
    let awayScore = null, homeScore = null;
    if (scoreRaw) {
      const m = scoreRaw.match(/(\d+)\s*-\s*(\d+)/);
      if (m) { awayScore = Number(m[1]); homeScore = Number(m[2]); }
    }
    out.push({
      date: currentDate,
      dow: currentDow,
      time: time.split(/\s+-\s+/)[0].trim(),
      status: isFinal ? "Final" : (statusText || "Scheduled"),
      completed: isFinal,
      away: { team: clean(away), record: awayRec ? clean(awayRec) : "", score: awayScore },
      home: { team: clean(home), record: homeRec ? clean(homeRec) : "", score: homeScore },
      venue: [venue, sub].filter(Boolean).map((s) => clean(s)).join(" · "),
      recapUrl: recap || null,
    });
  }
  return out;
}

const standings = parseStandings();
const schedule = parseSchedule();

const existing = existsSync(outPath) ? JSON.parse(readFileSync(outPath, "utf8")) : { seasons: {} };
existing.seasons[seasonId] = {
  ...(existing.seasons[seasonId] ?? {}),
  updated: new Date().toISOString(),
  standings,
  schedule,
};

writeFileSync(outPath, JSON.stringify(existing, null, 2) + "\n");
console.log(`✅ sdabl: parsed ${standings.length} teams, ${schedule.length} events → ${outPath} (${seasonId})`);
