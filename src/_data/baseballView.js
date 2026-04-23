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

// Parse a schedule date string like "Apr 19" (with optional ISO fallback).
function dateSortKey(d) {
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  if (!d) return 0;
  // Handle ISO "YYYY-MM-DD"
  const iso = d.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return Number(iso[1]) * 10000 + Number(iso[2]) * 100 + Number(iso[3]);
  // "Mon D" form
  const parts = d.trim().split(/\s+/);
  const mi = months.indexOf(parts[0]);
  const day = Number(parts[1]);
  return mi >= 0 && Number.isFinite(day) ? mi * 100 + day : 0;
}

function computeCareerAnalytics(seasons, games) {
  const played = games.filter((g) => g.played);

  // --- Season-by-season summary ---
  const bySeason = new Map();
  for (const s of seasons) {
    bySeason.set(s.id, {
      id: s.id,
      name: s.name,
      team: s.team,
      position: s.position,
      stats: s.stats,
    });
  }
  const seasonsSummary = [...bySeason.values()].map((s) => ({
    id: s.id,
    name: s.name,
    team: s.team,
    GP: s.stats?.games?.played ?? 0,
    W: s.stats?.games?.wins ?? 0,
    L: s.stats?.games?.losses ?? 0,
    AVG: s.stats?.calculated?.AVG ?? 0,
    OBP: s.stats?.calculated?.OBP ?? 0,
    SLG: s.stats?.calculated?.SLG ?? 0,
    OPS: s.stats?.calculated?.OPS ?? 0,
    HR: s.stats?.hitting?.HR ?? 0,
    RBI: s.stats?.hitting?.RBI ?? 0,
    ERA: s.stats?.calculated?.ERA ?? 0,
    IP: s.stats?.pitching?.IP ?? 0,
  }));

  // --- Best/worst games (by user rating then by total bases) ---
  const scored = played.map((g) => {
    const h = g.stats?.hitting || {};
    const singles = Math.max(0, (h.H || 0) - (h["2B"] || 0) - (h["3B"] || 0) - (h.HR || 0));
    const tb = singles + 2 * (h["2B"] || 0) + 3 * (h["3B"] || 0) + 4 * (h.HR || 0);
    return { ...g, _tb: tb };
  });
  const bestByRating = scored
    .filter((g) => g.rating)
    .sort((a, b) => b.rating - a.rating || b._tb - a._tb)
    .slice(0, 3);
  const bestByBatting = scored
    .filter((g) => (g.stats?.hitting?.AB || 0) > 0)
    .sort(
      (a, b) =>
        b._tb - a._tb ||
        (b.stats?.hitting?.H || 0) - (a.stats?.hitting?.H || 0) ||
        (b.stats?.hitting?.RBI || 0) - (a.stats?.hitting?.RBI || 0),
    )
    .slice(0, 3);
  const bestByPitching = scored
    .filter((g) => (g.stats?.pitching?.IP || 0) > 0)
    .sort((a, b) => {
      const aERA = (a.stats.pitching.ER || 0) * 9 / a.stats.pitching.IP;
      const bERA = (b.stats.pitching.ER || 0) * 9 / b.stats.pitching.IP;
      return aERA - bERA || b.stats.pitching.IP - a.stats.pitching.IP;
    })
    .slice(0, 3);

  // --- Opponent splits ---
  const byOpp = new Map();
  for (const g of played) {
    const h = g.stats?.hitting || {};
    const key = g.opponent || "Unknown";
    if (!byOpp.has(key)) {
      byOpp.set(key, {
        opponent: key,
        GP: 0, W: 0, L: 0,
        AB: 0, H: 0, "2B": 0, "3B": 0, HR: 0, RBI: 0, R: 0, BB: 0, K: 0, HBP: 0, SF: 0,
      });
    }
    const e = byOpp.get(key);
    e.GP++;
    if (g.result === "W") e.W++;
    else if (g.result === "L") e.L++;
    for (const k of ["AB","H","2B","3B","HR","RBI","R","BB","K","HBP","SF"]) {
      e[k] += (h[k] || 0);
    }
  }
  const opponentSplits = [...byOpp.values()].map((e) => {
    const c = computeCalculated({ hitting: e, fielding: {}, pitching: {}, games: {} });
    return {
      opponent: e.opponent, GP: e.GP, W: e.W, L: e.L,
      AB: e.AB, H: e.H, HR: e.HR, RBI: e.RBI,
      AVG: c.AVG, OBP: c.OBP, SLG: c.SLG, OPS: c.OPS,
    };
  }).sort((a, b) => b.OPS - a.OPS || b.GP - a.GP);

  // --- Rolling OPS trend (per-game, walked forward, cumulative) ---
  const chronological = [...played].sort(
    (a, b) => dateSortKey(a.date) - dateSortKey(b.date),
  );
  const trend = [];
  const agg = { AB: 0, H: 0, "2B": 0, "3B": 0, HR: 0, RBI: 0, BB: 0, HBP: 0, SF: 0, K: 0 };
  chronological.forEach((g, i) => {
    const h = g.stats?.hitting || {};
    for (const k of Object.keys(agg)) agg[k] += (h[k] || 0);
    const c = computeCalculated({ hitting: agg, fielding: {}, pitching: {}, games: {} });
    trend.push({
      i: i + 1,
      date: g.date,
      opponent: g.opponent,
      season: g.seasonName,
      OPS: c.OPS,
      AVG: c.AVG,
    });
  });

  // --- Streaks ---
  let longestHit = 0, longestOnBase = 0;
  let curHit = 0, curOnBase = 0;
  const reversed = [...chronological]; // oldest → newest
  for (const g of reversed) {
    const h = g.stats?.hitting || {};
    const hadAB = (h.AB || 0) > 0;
    const hadHit = (h.H || 0) > 0;
    const reachedBase = hadHit || (h.BB || 0) > 0 || (h.HBP || 0) > 0;
    // Hit streak: only games with at least one AB count; a hitless AB game ends it
    if (hadAB) {
      if (hadHit) {
        curHit++;
        longestHit = Math.max(longestHit, curHit);
      } else {
        curHit = 0;
      }
    }
    // On-base streak: any plate-appearance game where you reached keeps it alive
    if (hadAB || (h.BB || 0) > 0 || (h.HBP || 0) > 0) {
      if (reachedBase) {
        curOnBase++;
        longestOnBase = Math.max(longestOnBase, curOnBase);
      } else {
        curOnBase = 0;
      }
    }
  }
  const activeHit = curHit;
  const activeOnBase = curOnBase;

  // --- Notable moments timeline ---
  const notable = played
    .filter((g) => g.notable && String(g.notable).trim() && String(g.notable).trim().toUpperCase() !== "DNP")
    .sort((a, b) => dateSortKey(b.date) - dateSortKey(a.date))
    .map((g) => ({
      date: g.date,
      opponent: g.opponent,
      season: g.seasonName,
      note: String(g.notable).trim(),
    }));

  return {
    seasonsSummary,
    bestByRating,
    bestByBatting,
    bestByPitching,
    opponentSplits,
    trend,
    streaks: {
      longestHit,
      longestOnBase,
      activeHit,
      activeOnBase,
    },
    notable,
  };
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
  const nextUserGame = mine
    ? upcomingEnriched.find(
        (ev) => ev.home.team === mine.team || ev.away.team === mine.team,
      ) ?? null
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

  // Actual bracket if we have playoff results. Resolves each round from real
  // game outcomes using the seeding from standings.
  let playoffBracket = null;
  const pResults = league.playoffResults ?? [];
  if (
    pResults.length > 0 &&
    standingsEnriched.length >= playoffSpots &&
    playoffSpots === 6
  ) {
    const [s1, s2, s3, s4, s5, s6] = standingsEnriched;
    const byName = new Map(standingsEnriched.map((t) => [t.team, t]));
    const lookup = (a, b) =>
      pResults.find(
        (g) =>
          (g.home.team === a && g.away.team === b) ||
          (g.home.team === b && g.away.team === a),
      );
    const gameDetails = (g, teamA, teamB) => {
      if (!g) return null;
      const aScore = g.home.team === teamA ? g.home.score : g.away.score;
      const bScore = g.home.team === teamB ? g.home.score : g.away.score;
      // Prefer an explicit winner field if present (for games where we know
      // the outcome but not the score); otherwise derive from scores.
      let winner = g.winner ?? null;
      if (!winner && aScore != null && bScore != null) {
        winner = aScore > bScore ? teamA : teamB;
      }
      if (!winner) return null;
      return {
        date: g.date,
        teamA, teamB,
        aScore, bScore,
        winner,
        aWon: winner === teamA,
        bWon: winner === teamB,
        noScore: aScore == null || bScore == null,
      };
    };

    // Quarterfinals
    const qf1 = gameDetails(lookup(s3.team, s6.team), s3.team, s6.team);
    const qf2 = gameDetails(lookup(s4.team, s5.team), s4.team, s5.team);

    // Semifinals — find whichever QF winner actually faced the top seed,
    // regardless of whether the league re-seeds or uses fixed brackets.
    let sf1 = null, sf2 = null, champ = null;
    if (qf1 && qf2) {
      const qfWinners = [qf1.winner, qf2.winner];
      const s1Opp = qfWinners.find((w) => !!lookup(s1.team, w));
      const s2Opp = qfWinners.find((w) => w !== s1Opp);
      if (s1Opp) sf1 = gameDetails(lookup(s1.team, s1Opp), s1.team, s1Opp);
      if (s2Opp) sf2 = gameDetails(lookup(s2.team, s2Opp), s2.team, s2Opp);

      if (sf1 && sf2) {
        champ = gameDetails(lookup(sf1.winner, sf2.winner), sf1.winner, sf2.winner);
      }
    }

    playoffBracket = { s1, s2, s3, s4, s5, s6, qf1, qf2, sf1, sf2, champ };
  }

  // Unscheduled count = games the user's team has left on their slate that the league
  // hasn't placed on a specific date yet. (totalGames is per-team.)
  const unscheduledCount =
    totalGames && mine
      ? Math.max(
          0,
          totalGames -
            allEvents.filter(
              (ev) => ev.home.team === mine.team || ev.away.team === mine.team,
            ).length,
        )
      : 0;

  return {
    ...league,
    playoffSpots,
    unscheduledCount,
    standings: standingsEnriched,
    schedule: upcomingEnriched,
    results: resultsEnriched,
    userTeam: mine?.team ?? null,
    difficulty,
    nextUserGame,
    bracket,
    playoffBracket,
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
    gamesList: seasons.flatMap((s) =>
      (s.stats?.gamesList ?? []).map((g) => ({
        ...g,
        season: s.id,
        seasonName: s.name,
      })),
    ),
  };
  allStats.calculated = computeCalculated(allStats);

  const playedSeasons = seasons.filter((s) => !s.leagueOnly);
  const careerAnalytics = computeCareerAnalytics(playedSeasons, allStats.gamesList);

  const allTime = {
    id: "allTime",
    name: "All Time",
    player: seasons[0]?.player ?? "",
    team: seasons[0]?.team ?? "",
    position: seasons[0]?.position ?? "",
    stats: allStats,
    careerAnalytics,
  };

  const currentSeasonView = seasons.find((s) => s.id === raw.currentSeason) ?? null;

  return {
    ...raw,
    seasonIds,
    seasonList: seasons,
    currentSeasonView,
    allTime,
  };
}
