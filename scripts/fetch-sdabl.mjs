#!/usr/bin/env node
// Pull SDABL schedule, scores and standings straight from the SportsEngine
// microsite JSON API (se-api.sportsengine.com) and write them into
// src/_data/league.json. This replaces the old puppeteer scrape of
// sdabl1.info, which broke when SDABL moved behind a SportsEngine login:
// the public season site still reads this API with no auth.
//
// Config: scripts/sdabl-sources.json maps seasonId -> { program_id, team }.
// program_id is the SportsEngine program for that season (find it in the
// schedule page's network calls); team is your team's exact display name.
//
// SDABL is the source of truth for wins, losses and final scores. Your
// Obsidian notes remain the source of truth for personal batting/fielding
// /pitching stats (that pipeline is separate).

import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://se-api.sportsengine.com/v3/microsites/events";
const PLAYOFF_SPOTS = 6;

const sources = JSON.parse(
  readFileSync(join(repoRoot, "scripts/sdabl-sources.json"), "utf8")
);

async function fetchEvents(programId) {
  const all = [];
  for (let page = 1; ; page++) {
    const url = `${API}?page=${page}&per_page=100&program_id=${programId}&order_by=starts_at&direction=asc`;
    const res = await fetch(url, { headers: { "user-agent": "doyled-it-fetch-sdabl" } });
    if (!res.ok) throw new Error(`se-api ${res.status} for ${programId} page ${page}`);
    const json = await res.json();
    all.push(...json.result);
    if (json.metadata?.pagination?.lastPage) break;
    if (page > 20) break; // safety
  }
  return all;
}

const fmt = (iso, opts) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", ...opts }).format(new Date(iso));

// Build the full division schedule for the team's division.
function buildSeason(events, teamName) {
  const games = events.filter((e) => e.event_type === "game");

  // The team's division is whichever division its principal sits in.
  let divisionId = null;
  let divisionName = null;
  for (const g of games) {
    for (const p of g.principals || []) {
      const ea = p.extended_attributes || {};
      if (ea.name === teamName) {
        divisionId = ea.division_id;
        divisionName = (ea.division_name || "").trim();
      }
    }
  }
  if (!divisionId) throw new Error(`team "${teamName}" not found in events`);

  const divGames = games.filter((g) =>
    (g.principals || []).some((p) => p.extended_attributes?.division_id === divisionId)
  );

  // Per-team overall record over completed, non-BYE games (for the record
  // string shown on each row and for the standings table).
  const rec = new Map(); // team -> {W,L,T,RF,RA,GP}
  const bump = (t) => rec.get(t) || rec.set(t, { team: t, W: 0, L: 0, T: 0, RF: 0, RA: 0, GP: 0 }).get(t);
  const isBye = (t) => !t || /^bye$/i.test(t);

  const schedule = divGames.map((g) => {
    const [awayName, homeName] = (g.title || " at ").split(" at ").map((s) => s.trim());
    const ea = g.source?.extended_attributes || {};
    const completed = g.status === "completed";
    const aScore = completed ? Number(ea.away_team_score) : null;
    const hScore = completed ? Number(ea.home_team_score) : null;

    if (completed && !isBye(awayName) && !isBye(homeName)) {
      const a = bump(awayName), h = bump(homeName);
      a.GP++; h.GP++; a.RF += aScore; a.RA += hScore; h.RF += hScore; h.RA += aScore;
      if (aScore > hScore) { a.W++; h.L++; }
      else if (hScore > aScore) { h.W++; a.L++; }
      else { a.T++; h.T++; }
    }

    return {
      date: fmt(g.start_date_time, { month: "short", day: "numeric" }),
      dow: fmt(g.start_date_time, { weekday: "short" }),
      time: fmt(g.start_date_time, { hour: "numeric", minute: "2-digit", timeZoneName: "short" }),
      status: completed ? "Final" : "Scheduled",
      completed,
      away: { team: awayName, score: aScore },
      home: { team: homeName, score: hScore },
      venue: [g.location_name, g.location_description].filter(Boolean).join(" · "),
      recapUrl: completed ? `https://game-recap.ui.sportngin.com/public/${g.id}` : null,
      _iso: g.start_date_time,
    };
  });

  // Fill each row's record strings now that totals are known.
  const recStr = (t) => { const r = rec.get(t); return r ? `${r.W} - ${r.L}` : ""; };
  for (const s of schedule) { s.away.record = recStr(s.away.team); s.home.record = recStr(s.home.team); }

  // Standings, ranked by win pct then run differential.
  const standings = [...rec.values()]
    .map((r) => {
      const denom = r.W + r.L + r.T || 1;
      return { ...r, PCT: Math.round(((r.W + 0.5 * r.T) / denom) * 1000) / 1000, diff: r.RF - r.RA };
    })
    .sort((a, b) => b.PCT - a.PCT || b.diff - a.diff);
  const lead = standings[0];
  standings.forEach((t, i) => {
    t.rank = i + 1;
    t.GB = lead ? Math.round((((lead.W - t.W) + (t.L - lead.L)) / 2) * 10) / 10 : 0;
  });
  const ordered = standings.map(({ rank, team, W, L, T, GP, PCT, GB, RF, RA, diff }) =>
    ({ rank, team, W, L, T, GP, PCT, GB, RF, RA, diff }));

  const myGames = schedule.filter(
    (s) => (s.home.team === teamName || s.away.team === teamName) && !isBye(s.home.team) && !isBye(s.away.team)
  );

  // Drop the private sort key.
  for (const s of schedule) delete s._iso;

  return {
    updated: new Date().toISOString(),
    source: "se-api",
    divisionName,
    userTeams: [teamName],
    playoffSpots: PLAYOFF_SPOTS,
    totalGames: myGames.length,
    standings: ordered,
    schedule,
  };
}

const leaguePath = join(repoRoot, "src/_data/league.json");
const league = JSON.parse(readFileSync(leaguePath, "utf8"));
league.seasons = league.seasons || {};

for (const [seasonId, cfg] of Object.entries(sources)) {
  console.log(`\u{1F3DF}️  sdabl: ${seasonId} (${cfg.team})...`);
  const events = await fetchEvents(cfg.program_id);
  const season = buildSeason(events, cfg.team);
  league.seasons[seasonId] = season;
  const done = season.schedule.filter((s) => s.completed).length;
  console.log(`   ${season.divisionName}: ${season.schedule.length} games (${done} final), ${season.totalGames} on ${cfg.team}'s card`);
}

writeFileSync(leaguePath, JSON.stringify(league, null, 2) + "\n");
console.log(`✅ wrote ${leaguePath}`);
