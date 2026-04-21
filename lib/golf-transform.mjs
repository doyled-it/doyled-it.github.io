const COURSE_MAP = {
  "25.8/76": "The Loma Club",
  "30.5/96": "Balboa Park GC (9H)",
  "71.5/126": "Balboa Park GC",
  "68.3/119": "Sea 'N Air GC",
  "75/139": "Torrey Pines (South)",
  "71.5/125": "Torrey Pines (North)",
  "70.8/126": "Noosa Springs CC",
  "68.9/131": "Mt. Woodson GC",
  "66.5/125": "Mt. Woodson GC",
  "68.4/120": "Redmond Ridge GC",
  "69.2/120": "Balboa Park GC",
  "70.1/123": "Balboa Park GC",
  "53.4/73": "Mission Bay GC",
  "70/126": "Sierra Sage GC",
  "70.9/130": "Carlton Oaks CC",
  "70/117": "Cottonwood GC",
  "73/127": "Admiral Baker (North)",
  "71.5/130": "Mt. Coolum GC",
  "68.9/119": "Mission Trails GC",
};

export function enrichScores(scores) {
  return scores.map((s) => ({
    ...s,
    course_name: s.course_name || COURSE_MAP[`${s.course_rating}/${s.slope_rating}`] || `${s.course_rating}/${s.slope_rating}`,
  }));
}

function avg(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function pct(n) {
  return Math.round(n * 100);
}

export { computeGoals };

// User-configured goals. Each goal is a target on a tracked metric + a
// deadline. `lowerIsBetter` flips progress math for stats like handicap index
// where dropping is improvement.
const GOALS = [
  {
    id: "sub5-hi",
    label: "Break 5.0 handicap",
    metric: "handicapIndex",
    target: 4.9,
    deadline: "2026-12-31",
    lowerIsBetter: true,
    blurb: "Sub-5 HI by end of year",
  },
];

function computeGoals(currentHI, trend) {
  const today = new Date();
  const startHI = trend?.[0]?.hi ?? currentHI;

  // Recent pace: how much has HI moved in the last 90 days?
  const ninety = new Date(today.getTime() - 90 * 86_400_000);
  const trendPoints = (trend ?? []).map((p) => ({
    date: new Date(p.date),
    hi: p.hi,
  }));
  const recentStart = trendPoints.find((p) => p.date >= ninety) ?? trendPoints[0];
  const recentEnd = trendPoints[trendPoints.length - 1];
  const recent90dDelta =
    recentEnd && recentStart
      ? Math.round((recentEnd.hi - recentStart.hi) * 10) / 10
      : 0;

  return GOALS.map((g) => {
    const current = currentHI;
    const deadline = new Date(g.deadline);
    const daysLeft = Math.ceil((deadline - today) / 86_400_000);
    const progress = g.lowerIsBetter
      ? (startHI - current) / (startHI - g.target)
      : (current - startHI) / (g.target - startHI);
    const pct = Math.max(0, Math.min(100, Math.round(progress * 100)));
    const gap = g.lowerIsBetter ? current - g.target : g.target - current;
    const hit = g.lowerIsBetter ? current <= g.target : current >= g.target;

    // Pace math: required strokes/month vs actual strokes/month lately.
    const monthsLeft = Math.max(0.1, daysLeft / 30);
    const requiredPerMonth = Math.round((gap / monthsLeft) * 100) / 100;
    const recentPerMonth = Math.round((recent90dDelta / 3) * 100) / 100; // last 90d → /month
    const onPace =
      daysLeft > 0 &&
      ((g.lowerIsBetter && recentPerMonth <= -requiredPerMonth) ||
        (!g.lowerIsBetter && recentPerMonth >= requiredPerMonth));

    // Project forward: if we keep the current pace, where do we end up?
    const projectedHI =
      recentEnd && recentPerMonth !== 0
        ? Math.round((current + recentPerMonth * monthsLeft) * 10) / 10
        : current;

    // Build the chart series: actual history + a projection point at the deadline.
    const history = (trend ?? []).map((p) => ({ date: p.date, hi: p.hi, kind: "actual" }));
    const hiValues = [...history.map((p) => p.hi), current, startHI, g.target];
    const rawMax = Math.max(...hiValues);
    const rawMin = Math.min(...hiValues);
    const headroom = Math.max(0.5, (rawMax - rawMin) * 0.1);
    const hiMax = Math.ceil((rawMax + headroom) * 10) / 10;
    const hiMin = Math.floor((rawMin - headroom * 0.3) * 10) / 10;
    const projection = [
      { date: today.toISOString().slice(0, 10), hi: current, kind: "actual" },
      { date: g.deadline, hi: g.target, kind: "required" },
    ];

    return {
      ...g,
      current,
      startHI,
      pct,
      gap: Math.round(gap * 10) / 10,
      daysLeft,
      hit,
      requiredPerMonth,
      recentPerMonth,
      onPace,
      projectedHI,
      history,
      projection,
      hiMax,
      hiMin,
    };
  });
}

export function computeStats(scores) {
  const full18 = scores.filter((s) => s.number_of_holes === 18 || s.adjusted_gross_score > 50);
  const nine = scores.filter((s) => s.number_of_holes === 9 || s.adjusted_gross_score <= 50);
  const withStats = scores.filter((s) => s.statistics);
  const withHoles = scores.filter((s) => s.hole_details?.length > 0);

  const full18Scores = full18.map((s) => s.adjusted_gross_score);
  const nineScores = nine.map((s) => s.adjusted_gross_score);

  // Best score-to-par across 18-hole rounds
  let bestToPar = null;
  for (const s of full18) {
    if (s.hole_details?.length > 0) {
      const par = s.hole_details.reduce((sum, h) => sum + h.par, 0);
      const toPar = s.adjusted_gross_score - par;
      if (bestToPar === null || toPar < bestToPar) bestToPar = toPar;
    }
  }
  // Best score-to-par across 9-hole rounds
  let bestToPar9 = null;
  for (const s of nine) {
    if (s.hole_details?.length > 0) {
      const par = s.hole_details.reduce((sum, h) => sum + h.par, 0);
      const toPar = s.adjusted_gross_score - par;
      if (bestToPar9 === null || toPar < bestToPar9) bestToPar9 = toPar;
    }
  }

  const pars = withHoles.flatMap((s) => s.hole_details.map((h) => h.par));
  const totalPar = withHoles.reduce((sum, s) => {
    return sum + s.hole_details.reduce((hs, h) => hs + h.par, 0);
  }, 0);
  const totalStrokes = withHoles.reduce((sum, s) => {
    return sum + s.hole_details.reduce((hs, h) => hs + h.adjusted_gross_score, 0);
  }, 0);

  const scoringDist = { birdies: 0, pars: 0, bogeys: 0, doubles: 0, triples: 0, total: 0 };
  for (const s of withHoles) {
    for (const h of s.hole_details) {
      const diff = h.adjusted_gross_score - h.par;
      scoringDist.total++;
      if (diff <= -1) scoringDist.birdies++;
      else if (diff === 0) scoringDist.pars++;
      else if (diff === 1) scoringDist.bogeys++;
      else if (diff === 2) scoringDist.doubles++;
      else scoringDist.triples++;
    }
  }

  const holeTypePerf = { par3: [], par4: [], par5: [] };
  for (const s of withHoles) {
    for (const h of s.hole_details) {
      const key = h.par === 3 ? "par3" : h.par === 5 ? "par5" : "par4";
      holeTypePerf[key].push(h.adjusted_gross_score - h.par);
    }
  }

  const avgStats = { fairways: 0, gir: 0, putts: 0, onePutt: 0, twoPutt: 0, threePutt: 0 };
  if (withStats.length) {
    avgStats.fairways = avg(withStats.map((s) => s.statistics.fairway_hits_percent || 0));
    avgStats.gir = avg(withStats.map((s) => s.statistics.gir_percent || 0));
    avgStats.putts = avg(withStats.filter((s) => s.statistics.putts_total).map((s) => s.statistics.putts_total));
    avgStats.onePutt = avg(withStats.map((s) => s.statistics.one_putt_or_better_percent || 0));
    avgStats.twoPutt = avg(withStats.map((s) => s.statistics.two_putt_percent || 0));
    avgStats.threePutt = avg(withStats.map((s) => s.statistics.three_putt_or_worse_percent || 0));
  }

  const courseMap = new Map();
  for (const s of scores) {
    const name = s.course_name;
    if (!courseMap.has(name)) courseMap.set(name, []);
    courseMap.get(name).push(s);
  }
  const courses = [...courseMap.entries()]
    .map(([name, rounds]) => ({
      name,
      rounds: rounds.length,
      avgScore: Math.round(avg(rounds.map((r) => r.adjusted_gross_score)) * 10) / 10,
      bestScore: Math.min(...rounds.map((r) => r.adjusted_gross_score)),
      avgDiff: Math.round(avg(rounds.map((r) => r.differential)) * 10) / 10,
    }))
    .sort((a, b) => b.rounds - a.rounds);

  const recentForm = {
    last5: Math.round(avg(full18.slice(0, 5).map((s) => s.adjusted_gross_score)) * 10) / 10,
    last10: Math.round(avg(full18.slice(0, 10).map((s) => s.adjusted_gross_score)) * 10) / 10,
    last20: Math.round(avg(full18.slice(0, 20).map((s) => s.adjusted_gross_score)) * 10) / 10,
  };

  // --- Front vs Back 9 averages (18-hole rounds only) ---
  const frontBackRounds = full18.filter(
    (s) => Number.isFinite(s.front9_adjusted) && Number.isFinite(s.back9_adjusted) &&
           s.front9_adjusted > 0 && s.back9_adjusted > 0,
  );
  const frontBack = {
    rounds: frontBackRounds.length,
    front9Avg: Math.round(avg(frontBackRounds.map((s) => s.front9_adjusted)) * 10) / 10,
    back9Avg: Math.round(avg(frontBackRounds.map((s) => s.back9_adjusted)) * 10) / 10,
  };

  // --- Miss dispersion (average across rounds that tracked it) ---
  const missPct = (field) => {
    const vals = withStats
      .map((s) => s.statistics[field])
      .filter((v) => typeof v === "number" && Number.isFinite(v));
    return vals.length ? pct(avg(vals)) : 0;
  };
  const missDispersion = {
    left: missPct("missed_left_percent"),
    right: missPct("missed_right_percent"),
    long: missPct("missed_long_percent"),
    short: missPct("missed_short_percent"),
  };

  // --- Toughest / easiest holes by stroke allocation ---
  // Group every hole we've ever played by its handicap ranking (1=hardest, 18=easiest)
  // and compute avg score-to-par. If the user plays multiple courses the stroke
  // allocation means "relative hole difficulty" on that course.
  const strokeMap = new Map();
  for (const s of withHoles) {
    for (const h of s.hole_details) {
      const sa = h.stroke_allocation;
      if (!sa) continue;
      if (!strokeMap.has(sa)) strokeMap.set(sa, []);
      strokeMap.get(sa).push(h.adjusted_gross_score - h.par);
    }
  }
  const holeDifficulty = [...strokeMap.entries()]
    .map(([sa, vs]) => ({
      stroke_allocation: sa,
      rounds: vs.length,
      avgToPar: Math.round(avg(vs) * 100) / 100,
    }))
    .sort((a, b) => a.stroke_allocation - b.stroke_allocation);

  // --- Scrambling: % of holes where GIR was missed but score ≤ par ---
  let scrambleAttempts = 0;
  let scrambleSaves = 0;
  for (const s of withHoles) {
    for (const h of s.hole_details) {
      if (h.gir_flag === false && h.par) {
        scrambleAttempts++;
        if (h.adjusted_gross_score <= h.par) scrambleSaves++;
      }
    }
  }
  const scramblePct = scrambleAttempts ? pct(scrambleSaves / scrambleAttempts) : 0;
  // Breakdown: GIR rate, and what happens when you do miss
  let girAttempts = 0;
  let girSuccess = 0;
  let missedBogey = 0; // miss GIR but make bogey (acceptable)
  let missedDouble = 0; // miss GIR and double+ (leaking strokes)
  for (const s of withHoles) {
    for (const h of s.hole_details) {
      if (h.par) {
        girAttempts++;
        if (h.gir_flag) girSuccess++;
        else {
          const diff = h.adjusted_gross_score - h.par;
          if (diff === 1) missedBogey++;
          else if (diff >= 2) missedDouble++;
        }
      }
    }
  }
  const scrambling = {
    pct: scramblePct,
    attempts: scrambleAttempts,
    saves: scrambleSaves,
    missedBogey,
    missedDouble,
    girPct: girAttempts ? pct(girSuccess / girAttempts) : 0,
  };

  // --- Differential distribution (histogram bins of 2.0 each) ---
  const diffs = scores.map((s) => s.differential).filter((d) => Number.isFinite(d));
  const binSize = 2;
  const diffBuckets = new Map();
  for (const d of diffs) {
    const bin = Math.floor(d / binSize) * binSize;
    diffBuckets.set(bin, (diffBuckets.get(bin) || 0) + 1);
  }
  const diffHistogram = [...diffBuckets.entries()]
    .map(([lo, count]) => ({ lo, hi: lo + binSize, count }))
    .sort((a, b) => a.lo - b.lo);

  // --- Monthly activity (last 12 months with any rounds) ---
  const monthlyMap = new Map();
  for (const s of scores) {
    if (!s.played_at) continue;
    const ym = s.played_at.slice(0, 7); // YYYY-MM
    monthlyMap.set(ym, (monthlyMap.get(ym) || 0) + 1);
  }
  const monthly = [...monthlyMap.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .slice(-12)
    .map(([ym, n]) => ({ ym, count: n }));

  // --- Exceptional rounds ---
  const exceptional = scores.filter((s) => s.exceptional);

  // --- Score-to-par trend (chronological) + rolling-5 average ---
  const chronological = [...scores]
    .filter((s) => s.hole_details?.length > 0 && (s.number_of_holes === 18 || s.adjusted_gross_score > 50))
    .sort((a, b) => (a.played_at < b.played_at ? -1 : 1));
  const scoreTrend = chronological.map((s, i) => {
    const par = s.hole_details.reduce((sum, h) => sum + h.par, 0);
    const toPar = s.adjusted_gross_score - par;
    const window = chronological.slice(Math.max(0, i - 4), i + 1);
    const rolling = window.reduce((sum, r) => {
      const p = r.hole_details.reduce((ps, h) => ps + h.par, 0);
      return sum + (r.adjusted_gross_score - p);
    }, 0) / window.length;
    return {
      date: s.played_at,
      course: s.course_name,
      score: s.adjusted_gross_score,
      toPar,
      rolling5: Math.round(rolling * 10) / 10,
      differential: s.differential,
    };
  });

  // --- Score-to-par trend bounds (so templates don't need a min/max filter) ---
  if (scoreTrend.length) {
    const tpVals = scoreTrend.map((p) => p.toPar);
    scoreTrend.min = Math.min(...tpVals);
    scoreTrend.max = Math.max(...tpVals);
  }

  // --- Handicap index trend (USGA best-N-of-last-20). We use 18-hole rounds
  // only because 9-hole and 18-hole differentials live on different scales —
  // mixing them skews the computation. GHIN's real HI combines 9-hole rounds
  // separately, which we don't replicate. This gives a close approximation. ---
  const lowestNTable = {
    3: 1, 4: 1, 5: 1, 6: 2, 7: 2, 8: 2, 9: 3, 10: 3, 11: 3,
    12: 4, 13: 4, 14: 4, 15: 5, 16: 5, 17: 6, 18: 6, 19: 7,
  };
  const adjustmentTable = {
    3: -2.0, 4: -1.0, 5: 0, 6: -1.0, 7: 0, 8: 0,
  };
  const chron18 = [...full18].sort((a, b) => (a.played_at < b.played_at ? -1 : 1));
  const handicapTrend = [];
  for (let i = 0; i < chron18.length; i++) {
    const window = chron18.slice(Math.max(0, i - 19), i + 1);
    const n = window.length;
    if (n < 3) continue;
    const sortedDiffs = window.map((r) => r.differential).filter(Number.isFinite).sort((a, b) => a - b);
    const take = lowestNTable[n] ?? 8;
    if (sortedDiffs.length < take) continue;
    const lowest = sortedDiffs.slice(0, take);
    const avgLow = lowest.reduce((a, b) => a + b, 0) / lowest.length;
    const adjustment = adjustmentTable[n] ?? 0;
    const hi = Math.round((avgLow + adjustment) * 10) / 10;
    handicapTrend.push({
      date: chron18[i].played_at,
      rounds: n,
      hi,
    });
  }

  if (handicapTrend.length) {
    const hiVals = handicapTrend.map((p) => p.hi);
    handicapTrend.min = Math.min(...hiVals);
    handicapTrend.max = Math.max(...hiVals);
  }

  // --- Diff histogram bounds ---
  if (diffHistogram.length) {
    diffHistogram.maxCount = Math.max(...diffHistogram.map((b) => b.count));
  }
  if (monthly.length) {
    monthly.maxCount = Math.max(...monthly.map((m) => m.count));
  }
  if (holeDifficulty.length) {
    const vals = holeDifficulty.map((h) => h.avgToPar);
    holeDifficulty.min = Math.min(...vals);
    holeDifficulty.max = Math.max(...vals);
  }

  // --- "Used in HI" flag: which of the last 20 (18-hole) rounds contribute ---
  const recent20 = chron18.slice(-20);
  const recent20Diffs = recent20.map((r) => ({ id: r.id, d: r.differential })).sort((a, b) => a.d - b.d);
  const takeNow = lowestNTable[recent20.length] ?? 8;
  const usedIds = new Set(recent20Diffs.slice(0, takeNow).map((x) => x.id));

  return {
    frontBack,
    missDispersion,
    holeDifficulty,
    scramblePct,
    scrambling,
    diffHistogram,
    monthly,
    exceptional,
    scoreTrend,
    handicapTrend,
    usedIds: [...usedIds],
    totalRounds: scores.length,
    full18Rounds: full18.length,
    nineRounds: nine.length,
    low18: full18Scores.length ? Math.min(...full18Scores) : null,
    low18ToPar: bestToPar,
    low9: nineScores.length ? Math.min(...nineScores) : null,
    low9ToPar: bestToPar9,
    avg18: Math.round(avg(full18Scores) * 10) / 10,
    avgToPar: withHoles.length ? Math.round((totalStrokes - totalPar) / withHoles.length * 10) / 10 : null,
    bestDifferential: scores.length ? Math.min(...scores.map((s) => s.differential)) : null,
    recentForm,
    scoring: (() => {
      const s = {
        birdies: scoringDist.total ? pct(scoringDist.birdies / scoringDist.total) : 0,
        pars: scoringDist.total ? pct(scoringDist.pars / scoringDist.total) : 0,
        bogeys: scoringDist.total ? pct(scoringDist.bogeys / scoringDist.total) : 0,
        doubles: scoringDist.total ? pct(scoringDist.doubles / scoringDist.total) : 0,
        triples: scoringDist.total ? pct(scoringDist.triples / scoringDist.total) : 0,
      };
      s.max = Math.max(s.birdies, s.pars, s.bogeys, s.doubles, s.triples, 1);
      return s;
    })(),
    holeType: {
      par3: Math.round(avg(holeTypePerf.par3) * 100) / 100,
      par4: Math.round(avg(holeTypePerf.par4) * 100) / 100,
      par5: Math.round(avg(holeTypePerf.par5) * 100) / 100,
    },
    shotStats: {
      fairways: pct(avgStats.fairways),
      gir: pct(avgStats.gir),
      avgPutts: Math.round(avgStats.putts * 10) / 10,
      onePutt: pct(avgStats.onePutt),
      twoPutt: pct(avgStats.twoPutt),
      threePutt: pct(avgStats.threePutt),
    },
    courses,
  };
}
