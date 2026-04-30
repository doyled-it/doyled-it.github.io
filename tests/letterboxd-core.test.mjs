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
