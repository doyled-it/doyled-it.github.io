import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseLetterboxdRss } from "../lib/letterboxd-core.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixture = fs.readFileSync(path.join(here, "fixtures/letterboxd-sample.xml"), "utf8");

test("parseLetterboxdRss extracts all four items in order", () => {
  const films = parseLetterboxdRss(fixture);
  assert.equal(films.length, 4);
  assert.equal(films[0].title, "The Room");
  assert.equal(films[1].title, "Parasite");
  assert.equal(films[2].title, "Some Unrated Film");
  assert.equal(films[3].title, "Amp;Ersand & Friends"); // HTML-decoded
});

test("parseLetterboxdRss extracts rating, liked, rewatch correctly", () => {
  const films = parseLetterboxdRss(fixture);
  assert.equal(films[0].rating, 0.5);
  assert.equal(films[0].liked, true);
  assert.equal(films[0].rewatch, true);
  assert.equal(films[1].rating, 5.0);
  assert.equal(films[1].liked, true);
  assert.equal(films[1].rewatch, false);
  assert.equal(films[2].rating, null);    // unrated
  assert.equal(films[2].liked, false);
  assert.equal(films[2].rewatch, false);
});

test("parseLetterboxdRss extracts year and tmdbId as ints", () => {
  const films = parseLetterboxdRss(fixture);
  assert.equal(films[0].year, 2003);
  assert.equal(films[0].tmdbId, 17473);
  assert.equal(films[3].year, 2010);
  assert.equal(films[3].tmdbId, 12345);
});

test("parseLetterboxdRss extracts watchedDate as raw string", () => {
  const films = parseLetterboxdRss(fixture);
  assert.equal(films[0].watchedDate, "2026-04-18");
  assert.equal(films[3].watchedDate, "2026-03-02");
});

test("parseLetterboxdRss extracts letterboxdUrl from <link>", () => {
  const films = parseLetterboxdRss(fixture);
  assert.equal(films[0].letterboxdUrl, "https://letterboxd.com/test/film/the-room/");
});

test("parseLetterboxdRss extracts posterUrl from <description> img", () => {
  const films = parseLetterboxdRss(fixture);
  assert.equal(films[0].posterUrl, "https://example.com/posters/the-room.jpg");
  assert.equal(films[2].posterUrl, null); // no img in description
});

test("parseLetterboxdRss returns empty array on empty/invalid input", () => {
  assert.deepEqual(parseLetterboxdRss(""), []);
  assert.deepEqual(parseLetterboxdRss("<rss></rss>"), []);
});

import {
  parsePacificDate,
  computeTopDecade,
  computeRatingHistogram,
} from "../lib/letterboxd-core.mjs";

test("parsePacificDate returns Pacific-local date (no UTC midnight bug)", () => {
  // "2026-04-18" should be April 18 in Pacific, not Apr 17
  const d = parsePacificDate("2026-04-18");
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 3); // April = 3 (0-indexed)
  assert.equal(d.getDate(), 18);
});

test("parsePacificDate returns null on invalid input", () => {
  assert.equal(parsePacificDate(""), null);
  assert.equal(parsePacificDate(null), null);
  assert.equal(parsePacificDate("not-a-date"), null);
});

test("computeTopDecade returns mode of decades", () => {
  assert.equal(computeTopDecade([2003, 2015, 2018, 1999]), "2010s");
  assert.equal(computeTopDecade([1985, 1988]), "1980s");
  assert.equal(computeTopDecade([null, 2010, null]), "2010s"); // skips nulls
  assert.equal(computeTopDecade([]), null);
  assert.equal(computeTopDecade([null, null]), null);
});

test("computeRatingHistogram returns 10 buckets from 0.5 to 5.0", () => {
  const films = [
    { rating: 0.5 },
    { rating: 5.0 },
    { rating: 5.0 },
    { rating: 3.5 },
    { rating: null }, // ignored
    { rating: 3.5 },
  ];
  const hist = computeRatingHistogram(films);
  assert.equal(hist.length, 10);
  assert.equal(hist[0].rating, 0.5);
  assert.equal(hist[0].count, 1);
  assert.equal(hist[6].rating, 3.5);
  assert.equal(hist[6].count, 2);
  assert.equal(hist[9].rating, 5.0);
  assert.equal(hist[9].count, 2);
  assert.equal(hist[1].count, 0); // 1.0 bucket empty
});

import {
  computeCalendar,
  computeTrendByWeek,
} from "../lib/letterboxd-core.mjs";

test("computeCalendar builds 26-week × 7-day grid ending today", () => {
  // Mock now = 2026-04-30 (Thu)
  const now = new Date(2026, 3, 30);
  const films = [
    { watchedDate: "2026-04-18" },  // recent — should land in calendar
    { watchedDate: "2026-04-18" },  // same day, count = 2
    { watchedDate: "2026-04-15" },  // recent
    { watchedDate: "2025-09-01" },  // outside 26-week window — excluded
  ];
  const cal = computeCalendar(films, now);
  assert.equal(cal.length, 26 * 7);
  // Find the cell for 2026-04-18
  const cell = cal.find((c) => c.date === "2026-04-18");
  assert.ok(cell, "expected 2026-04-18 cell to exist");
  assert.equal(cell.count, 2);
  // Find the cell for 2026-04-15
  const cell2 = cal.find((c) => c.date === "2026-04-15");
  assert.ok(cell2);
  assert.equal(cell2.count, 1);
});

test("computeCalendar excludes films with null watchedDate", () => {
  const now = new Date(2026, 3, 30);
  const films = [{ watchedDate: null }, { watchedDate: "2026-04-15" }];
  const cal = computeCalendar(films, now);
  const cell = cal.find((c) => c.date === "2026-04-15");
  assert.equal(cell.count, 1);
});

test("computeTrendByWeek builds 12 weekly buckets, oldest first", () => {
  const now = new Date(2026, 3, 30);
  const films = [
    { watchedDate: "2026-04-29" }, // this week
    { watchedDate: "2026-04-28" }, // this week
    { watchedDate: "2026-04-15" }, // 2 weeks ago
    { watchedDate: "2025-12-01" }, // outside 12 weeks — excluded
  ];
  const trend = computeTrendByWeek(films, now);
  assert.equal(trend.length, 12);
  // Last bucket (most recent week) should have count = 2
  assert.equal(trend[trend.length - 1].count, 2);
});

import { parseProfileStats } from "../lib/letterboxd-core.mjs";

const SAMPLE_PROFILE_HTML = `
<h4 class="profile-statistic statistic"><a href="/doyled_it/films/"><span class="value">854</span><span class="definition title-all-caps -small">Films</span></a></h4>
<h4 class="profile-statistic statistic"><a href="/doyled_it/diary/for/2026/"><span class="value">32</span><span class="definition title-all-caps -small">This year</span></a></h4>
<h4 class="profile-statistic statistic"><a href="/doyled_it/lists/"><span class="value">33</span><span class="definition title-all-caps -small">Lists</span></a></h4>
<h4 class="profile-statistic statistic"><a href="/doyled_it/following/"><span class="value">69</span><span class="definition title-all-caps -small">Following</span></a></h4>
<h4 class="profile-statistic statistic"><a href="/doyled_it/followers/"><span class="value">60</span><span class="definition title-all-caps -small">Followers</span></a></h4>
`;

test("parseProfileStats extracts all 5 fields from sample HTML", () => {
  const s = parseProfileStats(SAMPLE_PROFILE_HTML);
  assert.equal(s.filmsTotal, 854);
  assert.equal(s.thisYear, 32);
  assert.equal(s.lists, 33);
  assert.equal(s.following, 69);
  assert.equal(s.followers, 60);
});

test("parseProfileStats returns nulls for missing fields", () => {
  const partial = `<h4 class="profile-statistic statistic"><span class="value">100</span><span class="definition title-all-caps -small">Films</span></h4>`;
  const s = parseProfileStats(partial);
  assert.equal(s.filmsTotal, 100);
  assert.equal(s.thisYear, null);
  assert.equal(s.lists, null);
  assert.equal(s.following, null);
  assert.equal(s.followers, null);
});

test("parseProfileStats returns null on empty / non-string input", () => {
  assert.equal(parseProfileStats(""), null);
  assert.equal(parseProfileStats(null), null);
  assert.equal(parseProfileStats(undefined), null);
  assert.equal(parseProfileStats(42), null);
});

import { buildMovieData } from "../lib/letterboxd-core.mjs";

test("buildMovieData returns full data shape from RSS", async () => {
  const profileStub = `<span class="value">777</span><span class="definition title-all-caps -small">Films</span>
<span class="value">12</span><span class="definition title-all-caps -small">This year</span>
<span class="value">5</span><span class="definition title-all-caps -small">Lists</span>
<span class="value">42</span><span class="definition title-all-caps -small">Following</span>
<span class="value">99</span><span class="definition title-all-caps -small">Followers</span>`;
  const fakeFetch = async (url) => {
    if (url.endsWith("/rss/")) {
      return { ok: true, text: async () => fixture };
    }
    return { ok: true, text: async () => profileStub };
  };
  const fakeNow = () => new Date(2026, 3, 30).getTime(); // 2026-04-30

  const data = await buildMovieData({
    user: "test",
    cachePath: "/tmp/letterboxd-test-cache.json",
    fetchImpl: fakeFetch,
    now: fakeNow,
    ttlMs: 0, // disable cache freshness — always fetch
  });

  assert.equal(data.user, "test");
  assert.equal(data.profileUrl, "https://letterboxd.com/test/");
  assert.equal(data.films.length, 4);
  assert.equal(data.hero.latest.title, "The Room");
  assert.equal(data.hero.favoriteRecent.title, "Parasite"); // 5★
  assert.equal(data.stats.totalInWindow, 4);
  assert.equal(data.stats.fiveStarThisYear, 1);
  assert.equal(data.stats.topDecade, "2010s"); // 2019 + 2015 + 2010 vs 2003
  assert.equal(data.ratingHistogram.length, 10);
  assert.equal(data.calendar.length, 26 * 7);
  assert.equal(data.trendByWeek.length, 12);
  assert.equal(data.error, null);
  assert.equal(data.profileStats.filmsTotal, 777);
  assert.equal(data.profileStats.thisYear, 12);
  assert.equal(data.profileStats.lists, 5);
  assert.equal(data.profileStats.following, 42);
  assert.equal(data.profileStats.followers, 99);
});

test("buildMovieData returns stale stub on fetch failure", async () => {
  const fakeFetch = async () => { throw new Error("network down"); };
  const data = await buildMovieData({
    user: "test",
    cachePath: "/tmp/letterboxd-nonexistent-cache.json",
    fetchImpl: fakeFetch,
    ttlMs: 0,
  });
  assert.equal(data.stale, true);
  assert.equal(data.films.length, 0);
  assert.ok(data.error);
});
