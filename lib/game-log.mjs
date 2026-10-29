// Comparison key for a team name. The Obsidian log and the SDABL feed spell
// the same team differently ("The OG" vs "THE OG", "Expos" vs "Expos (25A)"),
// so match on case, whitespace, and a trailing division code being ignored.
export function teamKey(name) {
  return String(name ?? "")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

const gameKey = (date, opponent) => `${date}|${teamKey(opponent)}`;

// SDABL is the source of truth for scores and W/L: override the game log from
// the league feed (matched by date + opponent), then add the league games the
// user did not play as DNP rows. Returns a new list sorted by date.
export function mergeLeagueGames(gamesList, leagueData) {
  const ut = leagueData?.userTeams ?? [];
  const sdabl = [];
  for (const ev of leagueData?.schedule ?? []) {
    if (!ev.completed) continue;
    const uTeam = ut.includes(ev.home.team) ? ev.home.team : ut.includes(ev.away.team) ? ev.away.team : null;
    if (!uTeam) continue;
    const mineHome = uTeam === ev.home.team;
    const us = mineHome ? ev.home.score : ev.away.score;
    const them = mineHome ? ev.away.score : ev.home.score;
    const opp = mineHome ? ev.away.team : ev.home.team;
    if (us == null || them == null || /^bye$/i.test(opp)) continue;
    sdabl.push({ isoDate: ev.isoDate, opp, venue: ev.venue || "", result: us > them ? "W" : us < them ? "L" : "T", score: `${us}-${them}` });
  }
  const byGame = new Map(sdabl.map((g) => [gameKey(g.isoDate, g.opp), g]));
  // Scores/result come from SDABL for the games the user logged.
  const merged = gamesList.map((g) => {
    const hit = byGame.get(gameKey(g.date, g.opponent));
    return hit ? { ...g, result: hit.result, score: hit.score } : g;
  });
  const have = new Set(merged.map((g) => gameKey(g.date, g.opponent)));
  for (const g of sdabl) {
    if (have.has(gameKey(g.isoDate, g.opp))) continue;
    merged.push({
      date: g.isoDate, opponent: g.opp, location: g.venue,
      result: g.result, score: g.score, played: false,
      stats: { hitting: {}, fielding: {}, pitching: {} },
    });
  }
  return merged.sort((a, b) => (a.date || "").localeCompare(b.date || ""));
}
