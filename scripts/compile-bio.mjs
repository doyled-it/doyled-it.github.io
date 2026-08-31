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
import { buildMusicData } from "../lib/lastfm-core.mjs";
import { buildMovieData } from "../lib/letterboxd-core.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));

const bio = read("src/_data/bio.json");
const baseball = read("src/_data/baseball.json");
const golfRaw = read("src/_data/golf-raw.json");
const resume = read("src/_data/resume.json");

const GITHUB_USER = "doyled-it";
const LASTFM_USER = process.env.LASTFM_USER;
const LASTFM_API_KEY = process.env.LASTFM_API_KEY;
const LETTERBOXD_USER = "doyled_it";

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
// Reuses the same buildMusicData the music card uses, so the chatbot's
// view of Michael's listening matches the page exactly. We then trim
// the rich data down to chatbot-friendly fields (no album art URLs etc.).

const DAY_NAMES = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

function describePeak(heatmap) {
  if (!heatmap?.length) return null;
  // Most active hour-of-day (summed across days)
  const hourTotals = new Array(24).fill(0);
  for (const row of heatmap) for (let h = 0; h < 24; h++) hourTotals[h] += row[h];
  const peakHour = hourTotals.indexOf(Math.max(...hourTotals));
  // Most active day-of-week (summed across hours)
  const dayTotals = heatmap.map((row) => row.reduce((a, b) => a + b, 0));
  const peakDay = dayTotals.indexOf(Math.max(...dayTotals));
  return {
    peak_hour_pt: `${peakHour}:00`,
    peak_day: DAY_NAMES[peakDay],
  };
}

async function lastfmSummary() {
  if (!LASTFM_USER || !LASTFM_API_KEY) {
    console.warn("compile-bio: LASTFM_USER/LASTFM_API_KEY not set — bundle will omit music_listening");
    return null;
  }
  try {
    const m = await buildMusicData({
      user: LASTFM_USER,
      apiKey: LASTFM_API_KEY,
      cachePath: path.join(root, ".cache/lastfm.json"),
    });
    if (m.error) throw new Error(m.error);
    const peak = describePeak(m.activityHeatmap);
    return {
      lastfm_user: LASTFM_USER,
      profile_url: `https://www.last.fm/user/${LASTFM_USER}`,
      total_scrobbles: m.stats?.totalScrobbles,
      days_scrobbling: m.stats?.daysScrobbling,
      avg_songs_per_day: m.stats?.avgPerDay,
      avg_songs_per_week: m.stats?.avgPerWeek,
      estimated_listening_hours: m.stats?.listeningHours,
      discovery_rate_pct: m.stats?.discoveryRatePct,
      new_artists_this_month: m.stats?.newArtistsThisMonth,
      ...(peak ?? {}),
      top_genres: (m.tagCloud ?? []).slice(0, 8).map((t) => t.name),
      top_tracks_past_month: (m.topTracks ?? []).map((t) => ({
        name: t.name,
        artist: t.artist,
        plays: parseInt(t.plays ?? "0", 10),
        lastfm_url: t.url,
        apple_music_url: t.appleMusicUrl,
      })),
      top_artists_past_month: (m.topArtists ?? []).map((a) => ({
        name: a.name,
        plays: parseInt(a.plays ?? "0", 10),
        lastfm_url: a.url,
        apple_music_url: a.appleMusicUrl,
      })),
      top_albums_past_year: (m.topAlbums ?? []).map((a) => ({
        name: a.name,
        artist: a.artist,
        plays: parseInt(a.plays ?? "0", 10),
        lastfm_url: a.url,
        apple_music_url: a.appleMusicUrl,
      })),
      recently_played: (m.recent ?? []).map((t) => ({
        name: t.name,
        artist: t.artist,
        played_at: t.date,
        now_playing: t.nowPlaying ?? false,
      })),
      note: "Pulled from Last.fm at build time. Full breakdown at /music.",
    };
  } catch (err) {
    console.warn(`compile-bio: lastfm fetch failed (${err.message}) — bundle will omit music_listening`);
    return null;
  }
}

// ---- words (blog posts) ------------------------------------------------
//
// Reads every .md file in src/words/, parses frontmatter, and includes the
// title, date, slug, and full markdown body in the bundle. This lets the
// chatbot answer questions about post content. A simple regex parser is
// enough; no need to pull in gray-matter for the handful of fields used.

function parseFrontmatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { meta: {}, body: raw };
  const meta = {};
  for (const line of m[1].split("\n")) {
    const kv = line.match(/^(\w+):\s*(.*)$/);
    if (!kv) continue;
    let v = kv[2].trim();
    // Strip surrounding quotes (single or double) for simple string values.
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    meta[kv[1]] = v;
  }
  return { meta, body: m[2] };
}

function wordsSummary() {
  const dir = path.join(root, "src/words");
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const raw = fs.readFileSync(path.join(dir, f), "utf8");
      const { meta, body } = parseFrontmatter(raw);
      const slug = f.replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/\.md$/, "");
      return {
        title: meta.title || slug,
        subtitle: meta.subtitle || null,
        date: meta.date || null,
        slug,
        url: `/words/${slug}/`,
        body,
      };
    })
    .sort((a, b) => (b.date || "").localeCompare(a.date || ""));
}

// ---- letterboxd watching summary ----------------------------------------

function trimFilm(f) {
  if (!f) return null;
  return {
    title: f.title,
    year: f.year,
    rating: f.rating,
    liked: f.liked,
    rewatch: f.rewatch,
    watched_date: f.watchedDate,
    letterboxd_url: f.letterboxdUrl,
  };
}

async function letterboxdSummary() {
  try {
    const m = await buildMovieData({
      user: LETTERBOXD_USER,
      cachePath: path.join(root, ".cache/letterboxd.json"),
    });
    if (m.error) throw new Error(m.error);
    return {
      letterboxd_user: LETTERBOXD_USER,
      profile_url: m.profileUrl,
      profile_stats: m.profileStats || null,
      films_total: m.profileStats?.filmsTotal ?? null,
      this_year_total: m.profileStats?.thisYear ?? null,
      films_in_window: m.stats.totalInWindow,
      films_this_year: m.stats.thisYear,
      films_this_month: m.stats.thisMonth,
      five_star_this_year: m.stats.fiveStarThisYear,
      top_decade: m.stats.topDecade,
      avg_rating: m.stats.avgRating,
      liked_count: m.stats.likedCount,
      rewatch_count: m.stats.rewatchCount,
      latest_watch: trimFilm(m.hero.latest),
      favorite_recent: trimFilm(m.hero.favoriteRecent),
      recent_watches: m.films.slice(0, 20).map(trimFilm),
      note: "Pulled at build time. profile_stats has lifetime totals from letterboxd.com/<user>/. The other fields (films_in_window, recent_watches, etc.) come from the RSS feed which caps at ~50 most-recent watches. Use profile_stats.films_total when asked about lifetime total. Full grid at /movies.",
    };
  } catch (err) {
    console.warn(`compile-bio: letterboxd fetch failed (${err.message})`);
    return null;
  }
}

// ---- assemble + write ---------------------------------------------------

const [github_activity, music_listening, movie_watching] = await Promise.all([
  githubSummary(),
  lastfmSummary(),
  letterboxdSummary(),
]);

const bundle = {
  ...bio,
  baseball_stats: baseballSummary(),
  golf_stats: golfSummary(),
  publications: publications(),
  github_activity,
  music_listening,
  movie_watching,
  words: wordsSummary(),
};

const outPath = path.join(root, "src/_data/bio-bundle.json");
fs.writeFileSync(outPath, JSON.stringify(bundle, null, 2));
console.log(
  `wrote ${outPath} (${(fs.statSync(outPath).size / 1024).toFixed(1)} KB, ${bundle.publications.length} papers, ${bundle.baseball_stats.seasons.length} seasons, ${bundle.golf_stats.rounds_played} rounds, ${bundle.words.length} posts)`
);
