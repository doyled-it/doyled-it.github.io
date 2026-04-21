#!/usr/bin/env node
// Import historical seasons from sdabl-leaderboard/data.js into our
// src/_data/league.json. The source format stores each team's games from THAT
// team's perspective; we need to dedupe + emit the game-level schedule.
//
// Usage:
//   node scripts/import-sdabl-archive.mjs <seasonId>
// Example:
//   node scripts/import-sdabl-archive.mjs fall2025
//   node scripts/import-sdabl-archive.mjs spring2025

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir } from "node:os";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "..");
const leaguePath = join(repoRoot, "src/_data/league.json");
const archivePath = join(homedir(), "projects/sdabl-leaderboard/data.js");

const [seasonId] = process.argv.slice(2);
if (!seasonId) {
  console.error("usage: node scripts/import-sdabl-archive.mjs <seasonId>");
  process.exit(1);
}

// data.js declares `const seasonsData = {...}`. Load it via Function sandbox.
const src = readFileSync(archivePath, "utf8");
const seasonsData = new Function(`${src}\nreturn seasonsData;`)();
const season = seasonsData.seasons[seasonId];
if (!season) {
  console.error(`season '${seasonId}' not found in archive`);
  console.error("available:", Object.keys(seasonsData.seasons).join(", "));
  process.exit(1);
}

// For each team, read their games array. Each entry has opponent with a "@ " or
// "vs " prefix indicating home/away from THIS team's perspective, score as
// "thisTeam-opponent", result, and date. Rebuild unique events.
const eventMap = new Map(); // key: dateTimeless identifier → event
const canonicalName = (n) => n.trim().replace(/\s+/g, " ");

function seasonYear(seasonId) {
  const m = seasonId.match(/(\d{4})/);
  return m ? Number(m[1]) : new Date().getFullYear();
}
const year = seasonYear(seasonId);

for (const team of season.teams) {
  const teamName = canonicalName(team.name);
  for (const g of team.games || []) {
    const m = g.opponent.match(/^(@|vs)\s+(.+)$/i);
    if (!m) continue;
    const oppName = canonicalName(m[2]);
    const isHome = m[1].toLowerCase() === "vs";
    const home = isHome ? teamName : oppName;
    const away = isHome ? oppName : teamName;
    // Score format is "thisTeam-opponent" regardless of home/away.
    const [myScore, oppScore] = (g.score || "").split("-").map((s) => Number(s.trim()));
    if (!Number.isFinite(myScore) || !Number.isFinite(oppScore)) continue;
    const homeScore = isHome ? myScore : oppScore;
    const awayScore = isHome ? oppScore : myScore;
    const key = `${g.date}|${away}@${home}`;
    if (eventMap.has(key)) continue;
    eventMap.set(key, {
      date: g.date,
      dow: "Sun",
      time: "",
      status: "Final",
      completed: true,
      away: { team: away, record: "", score: awayScore },
      home: { team: home, record: "", score: homeScore },
      venue: "",
      recapUrl: null,
    });
  }
}

// Sort events by date parsed as "Mon D" within season year.
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function dateKey(d) {
  const parts = (d || "").split(/\s+/);
  const mi = MONTHS.indexOf(parts[0]);
  const day = Number(parts[1]);
  if (mi < 0 || !Number.isFinite(day)) return 0;
  // Shift winter months so spring/fall sort correctly within calendar year
  return mi * 100 + day;
}
const events = [...eventMap.values()].sort((a, b) => dateKey(a.date) - dateKey(b.date));

// Build standings from the archive's per-team totals (already accurate).
const standings = season.teams
  .map((t, idx) => ({
    rank: t.rank ?? idx + 1,
    team: canonicalName(t.name),
    W: t.wins,
    L: t.losses,
    T: t.ties || 0,
    GP: t.wins + t.losses + (t.ties || 0),
    PCT: t.winPct,
    RF: t.runsFor,
    RA: t.runsAgainst,
    diff: (t.runsFor || 0) - (t.runsAgainst || 0),
  }))
  .sort((a, b) => b.PCT - a.PCT || b.diff - a.diff);

// Merge into league.json.
const existing = JSON.parse(readFileSync(leaguePath, "utf8"));
existing.seasons[seasonId] = {
  ...(existing.seasons[seasonId] ?? {}),
  updated: new Date().toISOString(),
  divisionName: season.division ? `Sun ${season.division}` : "Archive",
  totalGames: season.regularSeasonGames ?? 13,
  playoffSpots: 6,
  standings,
  schedule: events,
};
writeFileSync(leaguePath, JSON.stringify(existing, null, 2) + "\n");
console.log(
  `✅ imported ${seasonId}: ${season.teams.length} teams, ${events.length} games → ${leaguePath}`,
);
