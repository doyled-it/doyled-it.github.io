#!/usr/bin/env node
// Bundle bio.json with summarized hobby stats + paper list into one payload
// the worker can ship as the chatbot's source of truth.
//
// Output: src/_data/bio-bundle.json (gitignored — regenerated on every build)
// Inputs: src/_data/bio.json, baseball.json, golf-raw.json, resume.json

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { enrichScores, computeStats } from "../lib/golf-transform.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));

const bio = read("src/_data/bio.json");
const baseball = read("src/_data/baseball.json");
const golfRaw = read("src/_data/golf-raw.json");
const resume = read("src/_data/resume.json");

// ---- baseball summary ---------------------------------------------------

function pct(n, places = 3) {
  return Number.isFinite(n) ? n.toFixed(places).replace(/^0/, "") : "—";
}

function baseballSummary() {
  const seasons = baseball.seasons ?? {};
  const ordered = Object.entries(seasons).map(([key, s]) => {
    const c = s?.stats?.calculated ?? {};
    const h = s?.stats?.hitting ?? {};
    const g = s?.stats?.games ?? {};
    return {
      season: key,
      team: s?.team,
      games_played: g.played,
      record: g.played ? `${g.wins ?? 0}-${g.losses ?? 0}${g.ties ? `-${g.ties}` : ""}` : null,
      AVG: pct(c.AVG),
      OBP: pct(c.OBP),
      SLG: pct(c.SLG),
      OPS: pct(c.OPS),
      HR: h.HR,
      RBI: h.RBI,
      SB: h.SB,
    };
  });
  return {
    current_season: baseball.currentSeason,
    last_updated: baseball.lastUpdated,
    seasons: ordered,
    note: "Adult-league baseball. Full game logs and league context at /baseball.",
  };
}

// ---- golf summary -------------------------------------------------------

function golfSummary() {
  const scores = enrichScores(golfRaw.scores ?? []);
  const stats = computeStats(scores);
  const recent = scores.slice(-5).map((s) => ({
    date: s.played_at?.slice(0, 10) ?? s.date,
    course: s.course_name,
    score: s.adjusted_gross_score ?? s.gross_score ?? s.score,
    differential: typeof s.differential === "number" ? s.differential.toFixed(1) : null,
  }));
  return {
    handicap_index: golfRaw.golfer?.handicapIndex,
    low_handicap: golfRaw.golfer?.lowHandicap,
    home_club: golfRaw.golfer?.club?.name,
    rounds_played: scores.length,
    avg_score: stats.avgScore,
    avg_differential: stats.avgDifferential,
    recent_rounds: recent,
    goal: "Break 5.0 handicap by end of 2026.",
    note: "GHIN-tracked rounds. Full stats, trends, and goals at /golf.",
  };
}

// ---- publications -------------------------------------------------------

function publications() {
  return (resume.publications ?? []).map((p) => ({
    title: p.name,
    venue: p.publisher,
    date: p.releaseDate,
    url: p.url,
    summary: p.summary,
    michael_role:
      Array.isArray(p.authors) && p.authors[0] === "Michael Doyle"
        ? "first author"
        : Array.isArray(p.authors) && p.authors.includes("Michael Doyle")
        ? `co-author (one of ${p.authors.length})`
        : "contributor",
  }));
}

// ---- assemble + write ---------------------------------------------------

const bundle = {
  ...bio,
  baseball_stats: baseballSummary(),
  golf_stats: golfSummary(),
  publications: publications(),
};

const outPath = path.join(root, "src/_data/bio-bundle.json");
fs.writeFileSync(outPath, JSON.stringify(bundle, null, 2));
console.log(
  `wrote ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(1)} KB, ${bundle.publications.length} papers, ${bundle.baseball_stats.seasons.length} seasons, ${bundle.golf_stats.rounds_played} rounds)`
);
