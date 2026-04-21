// League prediction math: Pythagorean expectation, per-game win probability,
// schedule difficulty, and Monte Carlo playoff odds.
// Ported from sdabl-leaderboard/app.js.

const PYTH_EXPONENT = 1.83;
const DEFAULT_SIMULATIONS = 1000;

// Season-phase-aware pseudo-count: how many "average" prior games to blend in.
// Empirical sweep on 31-game samples showed that heavy shrinkage (k≈10) kills
// sharpness without helping accuracy, while k≈4-5 at GP=0 retains ~half the
// informative predictions and only costs ~5% Brier skill vs. the coin-flip
// baseline. Fades to 0 by ~8 GP.
export function phaseK(gp) {
  return Math.max(0, 4 - (gp || 0) / 2);
}

// Pyth weight is steady — with shrinkage handling the small-sample problem,
// we can keep the classic 70% Pyth blend throughout. Tiny bump early because
// raw win% is still noisier than Pyth at GP < 4.
export function phasedPythWeight(gp) {
  if (gp <= 3) return 0.80;
  return 0.70;
}

export function pythagWinPct(RF, RA) {
  const rf = Math.max(1, RF || 0);
  const ra = Math.max(1, RA || 0);
  const num = Math.pow(rf, PYTH_EXPONENT);
  return num / (num + Math.pow(ra, PYTH_EXPONENT));
}

// Compute a league-average runs-per-game from the teams that have played games.
function leagueRunsPerGame(teams) {
  let runs = 0, games = 0;
  for (const t of teams) {
    if (!t.GP) continue;
    runs += (t.RF || 0) + (t.RA || 0);
    games += t.GP * 2; // RF and RA each represent a team-game-worth of scoring
  }
  return games > 0 ? runs / games : 7; // fallback to 7 runs/team-game
}

// Apply Bayesian shrinkage to a team's record + run totals using `k` pseudo
// games split evenly (0.5 W, 0.5 L, mu runs scored, mu runs allowed).
function shrinkTeam(team, k, mu) {
  const half = k / 2;
  return {
    ...team,
    W: (team.W || 0) + half,
    L: (team.L || 0) + half,
    GP: (team.GP || 0) + k,
    RF: (team.RF || 0) + k * mu,
    RA: (team.RA || 0) + k * mu,
  };
}

export function expectedWinPct(team, ctx = {}) {
  const gp = team.GP || 0;
  const k = phaseK(gp);
  const mu = ctx.leagueMu ?? 7;
  const w = phasedPythWeight(gp);

  // Shrunk stats — adds k "average" games worth of evenly-split data.
  const shrunk = k > 0 ? shrinkTeam(team, k, mu) : team;
  const pyth = pythagWinPct(shrunk.RF, shrunk.RA);
  const actual = shrunk.GP > 0 ? (shrunk.W + (shrunk.T || 0) * 0.5) / shrunk.GP : 0.5;
  return pyth * w + actual * (1 - w);
}

// Home team win probability in a matchup. `teams` is optional context used to
// derive league-average scoring for the shrinkage prior.
export function winProbability(homeTeam, awayTeam, teams) {
  const leagueMu = teams ? leagueRunsPerGame(teams) : 7;
  const ctx = { leagueMu };
  const home = expectedWinPct(homeTeam, ctx);
  const away = expectedWinPct(awayTeam, ctx);
  const denom = home + away;
  return denom > 0 ? home / denom : 0.5;
}

export function difficultyLabel(avgWinProb) {
  if (avgWinProb < 0.35) return { label: "Very Hard", css: "stat-poor" };
  if (avgWinProb < 0.50) return { label: "Hard", css: "stat-average" };
  if (avgWinProb < 0.65) return { label: "Average", css: "" };
  return { label: "Easy", css: "stat-good" };
}

function cloneTeam(t) {
  return { ...t, W: t.W, L: t.L, T: t.T };
}

// Count how many scheduled (not-yet-final) games a team has in the upcoming list.
function publishedRemaining(teamName, upcoming) {
  return upcoming.reduce(
    (n, ev) => n + (ev.home?.team === teamName || ev.away?.team === teamName ? 1 : 0),
    0,
  );
}

function simulateRemainingSchedule(teams, upcoming, { totalGames } = {}) {
  const byName = new Map(teams.map((t) => [t.team, cloneTeam(t)]));
  const leagueMu = leagueRunsPerGame(teams);
  const ctx = { leagueMu };
  // Pre-compute each team's expected win% for padding unknown games.
  const expByName = new Map();
  for (const t of teams) expByName.set(t.team, expectedWinPct(t, ctx));

  // 1) Simulate games we know about (real opponents).
  for (const ev of upcoming) {
    const home = byName.get(ev.home.team);
    const away = byName.get(ev.away.team);
    if (!home || !away) continue;
    const pHome = winProbability(home, away, teams);
    if (Math.random() < pHome) { home.W++; away.L++; }
    else { away.W++; home.L++; }
  }

  // 2) Pad with "unknown-opponent" games so each team hits totalGames.
  //    For each such game: coin flip weighted by this team's expected win %.
  //    This is independent per team (not paired) so league-wide W ≠ L — fine for
  //    ranking each team's finish, which is what the Monte Carlo needs.
  if (totalGames) {
    for (const t of byName.values()) {
      const gp = t.GP ?? (t.W + t.L + (t.T || 0));
      const knownLeft = publishedRemaining(t.team, upcoming);
      const unknown = Math.max(0, totalGames - gp - knownLeft);
      if (!unknown) continue;
      const p = expByName.get(t.team) ?? 0.5;
      for (let i = 0; i < unknown; i++) {
        if (Math.random() < p) t.W++;
        else t.L++;
      }
    }
  }

  const finals = [...byName.values()];
  for (const t of finals) {
    const games = t.W + t.L + (t.T || 0);
    t.simPct = games > 0 ? (t.W + (t.T || 0) * 0.5) / games : 0;
    t.simDiff = (t.RF || 0) - (t.RA || 0);
  }
  finals.sort((a, b) => b.simPct - a.simPct || b.simDiff - a.simDiff);
  return finals;
}

export function playoffProbability(teamName, teams, upcoming, options = {}) {
  const sims = options.simulations ?? DEFAULT_SIMULATIONS;
  const playoffSpots = options.playoffSpots ?? 6;
  const totalGames = options.totalGames ?? null;
  let made = 0;
  for (let i = 0; i < sims; i++) {
    const finals = simulateRemainingSchedule(teams, upcoming, { totalGames });
    const rank = finals.findIndex((t) => t.team === teamName);
    if (rank >= 0 && rank < playoffSpots) made++;
  }
  return made / sims;
}

// Count each team's games remaining directly from the full schedule, avoiding the
// hardcoded "regularSeasonGames" constant that sdabl-leaderboard had (which was
// wrong whenever a division didn't play exactly 10 games).
export function gamesRemaining(teamName, allEvents) {
  return allEvents.reduce((n, ev) => {
    if (ev.completed) return n;
    if (ev.home?.team === teamName || ev.away?.team === teamName) return n + 1;
    return n;
  }, 0);
}

// True remaining games per team. Prefer totalGames - GP (accounts for unpublished
// weeks), fall back to what's in the schedule when no totalGames is configured.
function trueRemaining(team, allEvents, totalGames) {
  if (totalGames) {
    const gp = team.GP ?? (team.W + team.L + (team.T || 0));
    return Math.max(0, totalGames - gp);
  }
  return gamesRemaining(team.team, allEvents);
}

// Clinching / elimination check.
// clinched = even if this team loses out, no other team can pass them (by wins)
// eliminated = even if this team wins out, they can't reach the playoff cutoff
export function clinchStatus(team, allTeams, allEvents, playoffSpots = 6, totalGames = null) {
  const myRem = trueRemaining(team, allEvents, totalGames);
  const myMin = team.W;               // assume we lose all remaining
  const myMax = team.W + myRem;       // assume we win all remaining

  const others = allTeams.filter((t) => t.team !== team.team);

  let couldFinishAbove = 0;
  for (const t of others) {
    const rem = trueRemaining(t, allEvents, totalGames);
    if (t.W + rem > myMin) couldFinishAbove++;
  }
  const clinched = couldFinishAbove < playoffSpots;

  let guaranteedAbove = 0;
  for (const t of others) {
    if (t.W > myMax) guaranteedAbove++;
  }
  const eliminated = guaranteedAbove >= playoffSpots;

  return { clinched, eliminated, remaining: myRem };
}

// Build standings as-of a cutoff point using only events up to and including idx.
function standingsAsOf(allEvents, cutoffIdx) {
  const teams = new Map();
  const seed = (name) => {
    if (!teams.has(name)) {
      teams.set(name, { team: name, W: 0, L: 0, T: 0, GP: 0, RF: 0, RA: 0 });
    }
    return teams.get(name);
  };
  for (let i = 0; i <= cutoffIdx; i++) {
    const ev = allEvents[i];
    if (!ev?.completed) continue;
    const a = seed(ev.away.team);
    const h = seed(ev.home.team);
    const aS = ev.away.score ?? 0;
    const hS = ev.home.score ?? 0;
    a.RF += aS; a.RA += hS; h.RF += hS; h.RA += aS;
    a.GP++; h.GP++;
    if (aS > hS) { a.W++; h.L++; }
    else if (hS > aS) { h.W++; a.L++; }
    else { a.T++; h.T++; }
  }
  return [...teams.values()].map((t) => ({
    ...t,
    PCT: t.GP ? (t.W + t.T * 0.5) / t.GP : 0,
  }));
}

// Playoff-probability history for a given team. Returns one point per completed
// game in the schedule (after each week's games settle), with the Monte Carlo
// playoff % as if the season stopped then.
export function playoffHistory(teamName, allEvents, options = {}) {
  const sims = options.simulations ?? 500;
  const playoffSpots = options.playoffSpots ?? 6;
  const totalGames = options.totalGames ?? null;

  // Order events by the index at which they appear in the schedule (already
  // date-ordered from the scraper). Identify finalization points.
  const finalIdxs = [];
  allEvents.forEach((ev, i) => { if (ev.completed) finalIdxs.push(i); });
  if (!finalIdxs.length) return [];

  // Group by date so the chart doesn't wiggle mid-day as Sunday doubleheaders
  // finalize one-by-one.
  const datePoints = [];
  let lastDate = null;
  for (const i of finalIdxs) {
    const d = allEvents[i].date;
    if (d === lastDate) datePoints[datePoints.length - 1].idx = i;
    else datePoints.push({ date: d, idx: i });
    lastDate = d;
  }

  const out = [];
  for (const { date, idx } of datePoints) {
    const teamsAtPoint = standingsAsOf(allEvents, idx);
    const remaining = allEvents
      .map((ev, i) => ({ ev, i }))
      .filter(({ ev, i }) => !ev.completed || i > idx)
      .map(({ ev }) => ev);
    const pct = playoffProbability(teamName, teamsAtPoint, remaining, {
      simulations: sims,
      playoffSpots,
      totalGames,
    });
    const me = teamsAtPoint.find((t) => t.team === teamName);
    out.push({
      date,
      W: me?.W ?? 0,
      L: me?.L ?? 0,
      T: me?.T ?? 0,
      playoffPct: pct,
    });
  }
  return out;
}

// Walk-forward evaluation of the win-probability model. For each completed
// game, reconstruct standings using ONLY prior completed games (no peeking),
// compute what our model predicted for that matchup, and compare to actuals.
// Returns per-game rows plus aggregate metrics.
export function evaluatePredictions(allEvents) {
  // Index events in schedule order; only finals contribute stats.
  const finalIdxs = [];
  allEvents.forEach((ev, i) => { if (ev.completed) finalIdxs.push(i); });

  const rows = [];
  for (const i of finalIdxs) {
    const ev = allEvents[i];
    // Stats as of the event BEFORE this one — walk-forward, no leakage.
    const prior = standingsAsOf(allEvents, i - 1);
    const home = prior.find((t) => t.team === ev.home.team);
    const away = prior.find((t) => t.team === ev.away.team);
    if (!home || !away) continue; // can't predict first appearance

    const predHome = winProbability(home, away, prior);
    const actualHome = ev.home.score > ev.away.score ? 1 : ev.home.score < ev.away.score ? 0 : 0.5;
    rows.push({
      date: ev.date,
      home: ev.home.team,
      away: ev.away.team,
      homeScore: ev.home.score,
      awayScore: ev.away.score,
      predHome,
      actualHome,
      correct: (predHome >= 0.5 && actualHome === 1) || (predHome < 0.5 && actualHome === 0),
      abs: Math.abs(predHome - actualHome),
      sq: (predHome - actualHome) ** 2,
    });
  }

  if (!rows.length) return { rows: [], metrics: null };

  const n = rows.length;
  const brier = rows.reduce((s, r) => s + r.sq, 0) / n;
  const mae = rows.reduce((s, r) => s + r.abs, 0) / n;
  const accuracy = rows.filter((r) => r.correct).length / n;
  // Log loss — clamp to avoid infinities on perfectly sure wrong predictions.
  const clamp = (p) => Math.max(1e-6, Math.min(1 - 1e-6, p));
  const logLoss =
    -rows.reduce((s, r) => {
      const p = clamp(r.predHome);
      return s + r.actualHome * Math.log(p) + (1 - r.actualHome) * Math.log(1 - p);
    }, 0) / n;

  // Reliability buckets. For home-team perspective: group predicted prob into
  // 5 bins and check what fraction of games in each bin actually saw a home win.
  const bucketEdges = [0, 0.2, 0.4, 0.6, 0.8, 1.0001];
  const buckets = [];
  for (let b = 0; b < bucketEdges.length - 1; b++) {
    const lo = bucketEdges[b], hi = bucketEdges[b + 1];
    const inBucket = rows.filter((r) => r.predHome >= lo && r.predHome < hi);
    if (!inBucket.length) {
      buckets.push({ lo, hi, n: 0, predicted: 0, observed: 0 });
      continue;
    }
    const predicted = inBucket.reduce((s, r) => s + r.predHome, 0) / inBucket.length;
    const observed = inBucket.reduce((s, r) => s + r.actualHome, 0) / inBucket.length;
    buckets.push({ lo, hi, n: inBucket.length, predicted, observed });
  }

  // Baseline: always predict 50%.
  const baselineBrier = rows.reduce((s, r) => s + (0.5 - r.actualHome) ** 2, 0) / n;

  return {
    rows,
    metrics: {
      games: n,
      brier,
      baselineBrier,
      brierSkill: 1 - brier / baselineBrier, // >0 means better than naive
      logLoss,
      mae,
      accuracy,
      buckets,
    },
  };
}

// Compute a "schedule difficulty" summary for a specific team, based on avg
// win probability in their remaining games.
export function scheduleDifficulty(teamName, teams, upcoming) {
  const byName = new Map(teams.map((t) => [t.team, t]));
  const mine = byName.get(teamName);
  if (!mine) return null;

  const myGames = upcoming.filter(
    (ev) => ev.home.team === teamName || ev.away.team === teamName,
  );
  if (!myGames.length) return null;

  const probs = myGames.map((ev) => {
    const oppName = ev.home.team === teamName ? ev.away.team : ev.home.team;
    const opp = byName.get(oppName);
    if (!opp) return 0.5;
    const isHome = ev.home.team === teamName;
    const home = isHome ? mine : opp;
    const away = isHome ? opp : mine;
    const pHome = winProbability(home, away, teams);
    return isHome ? pHome : 1 - pHome;
  });
  const avg = probs.reduce((a, b) => a + b, 0) / probs.length;
  return {
    games: myGames.length,
    avgWinProb: avg,
    ...difficultyLabel(avg),
  };
}
