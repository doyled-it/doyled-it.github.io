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
