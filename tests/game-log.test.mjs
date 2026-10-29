import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeLeagueGames, teamKey } from "../lib/game-log.mjs";

const ev = (isoDate, away, awayScore, home, homeScore, extra = {}) => ({
  isoDate,
  completed: true,
  away: { team: away, score: awayScore },
  home: { team: home, score: homeScore },
  venue: "Field",
  ...extra,
});

const league = (schedule) => ({ source: "se-api", userTeams: ["Expos (25A)"], schedule });

test("teamKey ignores case, extra spaces, and a trailing division code", () => {
  assert.equal(teamKey("THE OG"), teamKey("The OG"));
  assert.equal(teamKey("  The   OG "), teamKey("the og"));
  assert.equal(teamKey("Expos (25A)"), teamKey("Expos"));
  assert.notEqual(teamKey("Beavers"), teamKey("Bombers"));
});

test("a logged game matches the league game despite opponent casing", () => {
  const games = [{ date: "2026-10-18", opponent: "The OG", played: true, result: "L", score: "12-13" }];
  const out = mergeLeagueGames(games, league([ev("2026-10-18", "Expos (25A)", 12, "THE OG", 13)]));
  assert.equal(out.length, 1);
  assert.equal(out[0].played, true);
  assert.equal(out[0].opponent, "The OG");
});

test("league scores override the logged score and result", () => {
  const games = [{ date: "2026-09-20", opponent: "Reapers Baseball Club", played: true, result: "L", score: "13-9" }];
  const out = mergeLeagueGames(games, league([ev("2026-09-20", "Reapers Baseball Club", 14, "Expos (25A)", 11)]));
  assert.deepEqual([out[0].result, out[0].score], ["L", "11-14"]);
});

test("league games missing from the log are added as DNP rows, sorted by date", () => {
  const games = [{ date: "2026-09-20", opponent: "Reapers Baseball Club", played: true }];
  const out = mergeLeagueGames(games, league([
    ev("2026-09-20", "Reapers Baseball Club", 14, "Expos (25A)", 11),
    ev("2026-09-13", "Expos (25A)", 16, "Bombers", 2),
  ]));
  assert.deepEqual(out.map((g) => [g.date, g.opponent, g.played]), [
    ["2026-09-13", "Bombers", false],
    ["2026-09-20", "Reapers Baseball Club", true],
  ]);
  assert.deepEqual([out[0].result, out[0].score], ["W", "16-2"]);
});

test("unfinished, unscored, and bye games are skipped", () => {
  const out = mergeLeagueGames([], league([
    ev("2026-10-11", "Fighting Friars", null, "Expos (25A)", null, { completed: false }),
    ev("2026-10-25", "Expos (25A)", null, "BYE", null),
  ]));
  assert.deepEqual(out, []);
});
