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

const GITHUB_USER = "doyled-it";
const LASTFM_USER = process.env.LASTFM_USER;
const LASTFM_API_KEY = process.env.LASTFM_API_KEY;

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

// ---- github (public, no auth) -------------------------------------------

async function githubSummary() {
  try {
    const headers = { "user-agent": "doyled-it-compile-bio", accept: "application/vnd.github+json" };
    const [userRes, reposRes] = await Promise.all([
      fetch(`https://api.github.com/users/${GITHUB_USER}`, { headers }),
      fetch(`https://api.github.com/users/${GITHUB_USER}/repos?sort=pushed&per_page=10&type=owner`, { headers }),
    ]);
    if (!userRes.ok || !reposRes.ok) throw new Error(`gh status ${userRes.status}/${reposRes.status}`);
    const user = await userRes.json();
    const repos = await reposRes.json();
    const langs = new Map();
    for (const r of repos) {
      if (!r.language || r.fork) continue;
      langs.set(r.language, (langs.get(r.language) ?? 0) + 1);
    }
    return {
      username: user.login,
      profile_url: user.html_url,
      public_repos: user.public_repos,
      followers: user.followers,
      bio: user.bio,
      top_languages: [...langs.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([l]) => l),
      recent_repos: repos
        .filter((r) => !r.fork)
        .slice(0, 5)
        .map((r) => ({
          name: r.name,
          url: r.html_url,
          description: r.description,
          language: r.language,
          stars: r.stargazers_count,
          last_pushed: r.pushed_at,
        })),
    };
  } catch (err) {
    console.warn(`compile-bio: github fetch failed (${err.message}) — bundle will omit github_activity`);
    return null;
  }
}

// ---- last.fm listening summary ------------------------------------------

async function lastfmSummary() {
  if (!LASTFM_USER || !LASTFM_API_KEY) {
    console.warn("compile-bio: LASTFM_USER/LASTFM_API_KEY not set — bundle will omit music_listening");
    return null;
  }
  try {
    const base = `https://ws.audioscrobbler.com/2.0/?user=${encodeURIComponent(LASTFM_USER)}&api_key=${LASTFM_API_KEY}&format=json`;
    const urls = [
      `${base}&method=user.getinfo`,
      `${base}&method=user.gettoptracks&period=1month&limit=10`,
      `${base}&method=user.gettopartists&period=1month&limit=10`,
      `${base}&method=user.gettopalbums&period=12month&limit=10`,
      `${base}&method=user.gettoptags&limit=8`,
      `${base}&method=user.getrecenttracks&limit=5`,
    ];
    const [info, tracks, artists, albums, tags, recent] = await Promise.all(
      urls.map((u) => fetch(u).then((r) => r.json()))
    );
    const u = info?.user ?? {};
    const totalScrobbles = parseInt(u.playcount ?? "0", 10);
    const days = u.registered?.unixtime
      ? Math.max(1, Math.floor((Date.now() / 1000 - parseInt(u.registered.unixtime, 10)) / 86400))
      : 0;
    return {
      lastfm_user: LASTFM_USER,
      profile_url: `https://www.last.fm/user/${LASTFM_USER}`,
      total_scrobbles: totalScrobbles,
      days_scrobbling: days,
      avg_per_day: days ? Math.round(totalScrobbles / days) : 0,
      top_genres: (tags?.toptags?.tag ?? []).slice(0, 5).map((t) => t.name),
      top_tracks_past_month: (tracks?.toptracks?.track ?? []).map((t) => ({
        name: t.name,
        artist: t.artist?.name ?? t.artist?.["#text"],
        plays: parseInt(t.playcount ?? "0", 10),
      })),
      top_artists_past_month: (artists?.topartists?.artist ?? []).map((a) => ({
        name: a.name,
        plays: parseInt(a.playcount ?? "0", 10),
      })),
      top_albums_past_year: (albums?.topalbums?.album ?? []).map((a) => ({
        name: a.name,
        artist: a.artist?.name ?? a.artist?.["#text"],
        plays: parseInt(a.playcount ?? "0", 10),
      })),
      recently_played: (recent?.recenttracks?.track ?? []).map((t) => ({
        name: t.name,
        artist: t.artist?.["#text"] ?? t.artist?.name,
        played_at: t.date?.["#text"] ?? (t["@attr"]?.nowplaying === "true" ? "now playing" : null),
      })),
      note: "Pulled from Last.fm. Full breakdown at /music.",
    };
  } catch (err) {
    console.warn(`compile-bio: lastfm fetch failed (${err.message}) — bundle will omit music_listening`);
    return null;
  }
}

// ---- assemble + write ---------------------------------------------------

const [github_activity, music_listening] = await Promise.all([githubSummary(), lastfmSummary()]);

const bundle = {
  ...bio,
  baseball_stats: baseballSummary(),
  golf_stats: golfSummary(),
  publications: publications(),
  github_activity,
  music_listening,
};

const outPath = path.join(root, "src/_data/bio-bundle.json");
fs.writeFileSync(outPath, JSON.stringify(bundle, null, 2));
console.log(
  `wrote ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(1)} KB, ${bundle.publications.length} papers, ${bundle.baseball_stats.seasons.length} seasons, ${bundle.golf_stats.rounds_played} rounds)`
);
