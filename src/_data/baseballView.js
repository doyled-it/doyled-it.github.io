import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { computeCalculated } from "../../lib/baseball-filters.mjs";
import {
  expectedWinPct,
  pythagWinPct,
  winProbability,
  playoffProbability,
  scheduleDifficulty,
  clinchStatus,
  playoffHistory,
  evaluatePredictions,
} from "../../lib/league-predictions.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const jsonPath = join(here, "baseball.json");
const leaguePath = join(here, "league.json");

const hittingKeys = ["AB","H","2B","3B","HR","RBI","R","BB","K","HBP","SF","SB","CS","RISP","RISP_H","hard_contact","pitches_seen"];
const fieldingKeys = ["PO","A","E","TC","DP"];
const pitchingKeys = ["IP","H_p","R_p","ER","BB_p","K_p","HR_p","BF","PC"];
const gameKeys = ["total","played","wins","losses","ties"];

const sum = (objs, keys) => {
  const out = {};
  for (const k of keys) out[k] = objs.reduce((a, o) => a + (o?.[k] ?? 0), 0);
  return out;
};

function readLeague() {
  try {
    return JSON.parse(readFileSync(leaguePath, "utf8")).seasons ?? {};
  } catch {
    return {};
  }
}

// Rebuild standings from scraped results so we don't wait for the league's
// manual table updates. Records + RF/RA are computed directly from finals.
function computeStandings(allEvents, fallback = []) {
  const teams = new Map();
  const seed = (name) => {
    if (!teams.has(name)) {
      teams.set(name, { team: name, W: 0, L: 0, T: 0, GP: 0, RF: 0, RA: 0 });
    }
    return teams.get(name);
  };
  // Seed from fallback so teams with 0 games still appear.
  for (const t of fallback) seed(t.team);

  for (const ev of allEvents) {
    if (!ev.completed) continue;
    const a = seed(ev.away.team);
    const h = seed(ev.home.team);
    const aS = ev.away.score ?? 0;
    const hS = ev.home.score ?? 0;
    a.RF += aS; a.RA += hS;
    h.RF += hS; h.RA += aS;
    a.GP++; h.GP++;
    if (aS > hS) { a.W++; h.L++; }
    else if (hS > aS) { h.W++; a.L++; }
    else { a.T++; h.T++; }
  }

  const out = [...teams.values()].map((t) => ({
    ...t,
    PCT: t.GP ? (t.W + t.T * 0.5) / t.GP : 0,
    diff: t.RF - t.RA,
  }));

  // Sort by PCT, then diff.
  out.sort((a, b) => b.PCT - a.PCT || b.diff - a.diff || b.W - a.W);
  // Rank with ties (same PCT → same rank).
  let prev = null, rank = 0, seen = 0;
  for (const t of out) {
    seen++;
    if (prev === null || t.PCT !== prev) rank = seen;
    t.rank = rank;
    prev = t.PCT;
  }
  return out;
}

function enrichLeague(league) {
  if (!league) return league;
  const playoffSpots = league.playoffSpots ?? 6;
  const totalGames = league.totalGames ?? null;
  const allEvents = league.schedule ?? [];
  const results = allEvents.filter((e) => e.completed);
  const upcoming = allEvents.filter((e) => !e.completed);
  const teams = computeStandings(allEvents, league.standings ?? []);
  const userTeams = league.userTeams ?? [];
  const mine = teams.find((t) => userTeams.includes(t.team));

  const standingsEnriched = teams.map((t) => {
    const status = clinchStatus(t, teams, allEvents, playoffSpots, totalGames);
    return {
      ...t,
      pyth: pythagWinPct(t.RF, t.RA),
      expPct: expectedWinPct(t),
      playoffPct: playoffProbability(t.team, teams, upcoming, {
        simulations: 1000,
        playoffSpots,
        totalGames,
      }),
      clinched: status.clinched,
      eliminated: status.eliminated,
      remaining: status.remaining,
    };
  });

  const byName = new Map(standingsEnriched.map((t) => [t.team, t]));
  const recordOf = (name) => {
    const t = byName.get(name);
    return t ? `${t.W} - ${t.L}${t.T ? " - " + t.T : ""}` : "";
  };
  const upcomingEnriched = upcoming.map((ev) => {
    const home = byName.get(ev.home.team);
    const away = byName.get(ev.away.team);
    let homeWinProb = null;
    let userWinProb = null;
    if (home && away) {
      homeWinProb = winProbability(home, away, teams);
      if (mine && (ev.home.team === mine.team || ev.away.team === mine.team)) {
        userWinProb = ev.home.team === mine.team ? homeWinProb : 1 - homeWinProb;
      }
    }
    return {
      ...ev,
      home: { ...ev.home, record: recordOf(ev.home.team) || ev.home.record },
      away: { ...ev.away, record: recordOf(ev.away.team) || ev.away.record },
      homeWinProb,
      userWinProb,
    };
  });

  const resultsEnriched = results.map((ev) => {
    const aw = ev.away?.score ?? null;
    const hm = ev.home?.score ?? null;
    let winner = null;
    if (aw != null && hm != null) {
      winner = aw > hm ? "away" : hm > aw ? "home" : "tie";
    }
    const userSide = mine
      ? ev.home.team === mine.team
        ? "home"
        : ev.away.team === mine.team
          ? "away"
          : null
      : null;
    const userResult =
      userSide && winner
        ? winner === "tie"
          ? "T"
          : winner === userSide
            ? "W"
            : "L"
        : null;
    return { ...ev, winner, userSide, userResult };
  });

  const difficulty = mine
    ? scheduleDifficulty(mine.team, teams, upcoming)
    : null;
  const history = mine
    ? playoffHistory(mine.team, allEvents, {
        simulations: 400,
        playoffSpots,
        totalGames,
      })
    : [];

  // History for every team, so the chart can show all and let the user filter.
  const allHistory = teams.map((t) => ({
    team: t.team,
    isMine: userTeams.includes(t.team),
    points: playoffHistory(t.team, allEvents, {
      simulations: 300,
      playoffSpots,
      totalGames,
    }),
  }));

  // Projected bracket if we have at least playoffSpots teams.
  let bracket = null;
  if (standingsEnriched.length >= playoffSpots && playoffSpots === 6) {
    const [s1, s2, s3, s4, s5, s6] = standingsEnriched;
    const mk = (high, low) => {
      const p = winProbability(high, low, teams);
      return { high, low, highWinProb: p, lowWinProb: 1 - p };
    };
    bracket = {
      top1: s1,
      top2: s2,
      qf1: mk(s3, s6),
      qf2: mk(s4, s5),
    };
  }

  return {
    ...league,
    playoffSpots,
    standings: standingsEnriched,
    schedule: upcomingEnriched,
    results: resultsEnriched,
    userTeam: mine?.team ?? null,
    difficulty,
    bracket,
    history,
    allHistory,
    evaluation: evaluatePredictions(allEvents),
  };
}

export default function () {
  const raw = JSON.parse(readFileSync(jsonPath, "utf8"));
  const league = readLeague();
  // Union of seasons that appear in personal data OR in league data. Sorted by
  // season-key suffix (year+season) so spring2025 < fall2025 < spring2026.
  const orderKey = (id) => {
    const yr = Number((id.match(/\d{4}/) || [0])[0]);
    const half = /spring/i.test(id) ? 0 : /fall/i.test(id) ? 1 : 0.5;
    return yr * 10 + half;
  };
  const seasonIds = [
    ...new Set([...Object.keys(raw.seasons), ...Object.keys(league)]),
  ].sort((a, b) => orderKey(a) - orderKey(b));
  const seasons = seasonIds.map((id) => {
    const personal = raw.seasons[id];
    const leagueData = league[id];
    if (personal) {
      return { ...personal, league: enrichLeague(leagueData) };
    }
    // League-only season (no personal stats). Construct a placeholder so the
    // tab can render the league block without breaking the stat-block macros.
    const name = id.replace(/^([a-z]+)(\d+)$/i, (_, s, y) => `${s[0].toUpperCase()}${s.slice(1)} ${y}`);
    return {
      id,
      name,
      player: "",
      team: "",
      position: "",
      leagueOnly: true,
      stats: {
        hitting: {}, fielding: {}, pitching: {},
        games: { played: 0, wins: 0, losses: 0, ties: 0, total: 0 },
        gamesList: [],
        calculated: computeCalculated({ hitting: {}, fielding: {}, pitching: {}, games: {} }),
      },
      league: enrichLeague(leagueData),
    };
  });

  const allStats = {
    hitting: sum(seasons.map((s) => s.stats?.hitting), hittingKeys),
    fielding: sum(seasons.map((s) => s.stats?.fielding), fieldingKeys),
    pitching: sum(seasons.map((s) => s.stats?.pitching), pitchingKeys),
    games: sum(seasons.map((s) => s.stats?.games), gameKeys),
    gamesList: seasons.flatMap((s) => s.stats?.gamesList ?? []),
  };
  allStats.calculated = computeCalculated(allStats);

  const allTime = {
    id: "allTime",
    name: "All Time",
    player: seasons[0]?.player ?? "",
    team: seasons[0]?.team ?? "",
    position: seasons[0]?.position ?? "",
    stats: allStats,
  };

  return {
    ...raw,
    seasonIds,
    seasonList: seasons,
    allTime,
  };
}
