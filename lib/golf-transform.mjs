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

  return {
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
    scoring: {
      birdies: scoringDist.total ? pct(scoringDist.birdies / scoringDist.total) : 0,
      pars: scoringDist.total ? pct(scoringDist.pars / scoringDist.total) : 0,
      bogeys: scoringDist.total ? pct(scoringDist.bogeys / scoringDist.total) : 0,
      doubles: scoringDist.total ? pct(scoringDist.doubles / scoringDist.total) : 0,
      triples: scoringDist.total ? pct(scoringDist.triples / scoringDist.total) : 0,
    },
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
