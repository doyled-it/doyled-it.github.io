// View-model for the 18Birdies on-course section of the golf page.
//
// Reads the committed src/_data/18birdies.json (produced locally by the
// birdies-export tool from the 18Birdies app's own data) and precomputes the
// stats and chart geometry the partial renders. Mirrors golfRange.js: all the
// math lives here so the Nunjucks template stays declarative.
//
// 18Birdies tracks full-swing shots only (no per-shot putts), so putting is
// surfaced as the per-round aggregate.

import fs from "node:fs";
import path from "node:path";

const SRC = path.resolve("src/_data/18birdies.json");
const YARDS_PER_M = 1.09361;

function clubLabel(num, type) {
  if (num == null) return "?";
  if (type === 1) return num === "1" ? "Driver" : `${num}-Wood`;
  if (type === 3) return `${num}-Iron`;
  if (type === 4) {
    const named = { P: "PW", G: "GW", L: "LW", S: "SW", A: "AW" };
    if (named[num]) return named[num];
    if (/^\d+$/.test(num)) return `${num}°`;
    return num;
  }
  return num;
}

function median(xs) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const sum = (xs) => xs.reduce((a, b) => a + (b || 0), 0);
const r1 = (x) => Math.round(x * 10) / 10;

// Decompose an approach miss into along-target (long/short) and lateral
// (right/left) yardage, using a local equirectangular projection around the
// start point. Returns null when any coordinate is missing.
function missVector(shot) {
  const { start, end, aim } = shot;
  if (!start || !end || !aim) return null;
  const [lng0, lat0] = start;
  const latRad = (lat0 * Math.PI) / 180;
  const toM = (p) => [
    (p[0] - lng0) * 111320 * Math.cos(latRad),
    (p[1] - lat0) * 110540,
  ];
  const tgt = toM(aim);
  const tlen = Math.hypot(tgt[0], tgt[1]);
  if (tlen < 1) return null;
  const ux = tgt[0] / tlen;
  const uy = tgt[1] / tlen;
  const missPt = toM(end);
  const mx = missPt[0] - tgt[0];
  const my = missPt[1] - tgt[1];
  const along = (mx * ux + my * uy) * YARDS_PER_M; // + long, - short
  const lateral = (mx * uy - my * ux) * YARDS_PER_M; // + right, - left
  return { along, lateral };
}

function empty() {
  return { ok: false };
}

export default function () {
  if (!fs.existsSync(SRC)) return empty();
  let doc;
  try {
    doc = JSON.parse(fs.readFileSync(SRC, "utf8"));
  } catch {
    return empty();
  }
  const rounds = doc.rounds || [];
  const shots = doc.shots || [];
  if (!rounds.length) return empty();

  const r18 = rounds.filter((r) => r.holes === 18 && typeof r.toPar === "number");
  const r9 = rounds.filter((r) => r.holes === 9 && typeof r.toPar === "number");
  const best = (rs) =>
    rs.length
      ? rs.reduce((a, b) => (b.toPar < a.toPar ? b : a))
      : null;

  // Scoring distribution across all rounds (counts of hole outcomes).
  const dist = ["eagles", "birdies", "pars", "bogeys", "doublePlus"].map((k) => ({
    key: k,
    count: sum(rounds.map((r) => r[k])),
  }));
  const distTotal = sum(dist.map((d) => d.count)) || 1;
  const scoreDist = dist.map((d) => ({
    key: d.key,
    label: { eagles: "Eagle+", birdies: "Birdie", pars: "Par", bogeys: "Bogey", doublePlus: "Dbl+" }[d.key],
    count: d.count,
    pct: Math.round((100 * d.count) / distTotal),
  }));

  // Club True Distances (filtered by the app's include flag).
  const byClub = new Map();
  for (const s of shots) {
    if (!s.inc || !s.td || s.td <= 0 || s.club == null) continue;
    if (!byClub.has(s.club)) byClub.set(s.club, { club: s.club, type: s.type, tds: [] });
    byClub.get(s.club).tds.push(s.td);
  }
  let clubs = [...byClub.values()]
    .filter((c) => c.tds.length >= 3)
    .map((c) => ({
      club: c.club,
      label: clubLabel(c.club, c.type),
      shots: c.tds.length,
      median: Math.round(median(c.tds)),
      avg: Math.round(mean(c.tds)),
      max: Math.round(Math.max(...c.tds)),
    }))
    .sort((a, b) => b.median - a.median);
  const clubMax = clubs.length ? clubs[0].median : 1;
  clubs = clubs.map((c) => ({ ...c, barPct: Math.round((100 * c.median) / clubMax) }));

  // Performance by lie.
  const lieOrder = ["Tee", "Fairway", "Rough", "Sand", "Recovery"];
  const byLieMap = new Map();
  for (const s of shots) {
    if (!s.lie) continue;
    if (!byLieMap.has(s.lie)) byLieMap.set(s.lie, []);
    byLieMap.get(s.lie).push(s);
  }
  const lieTotal = sum([...byLieMap.values()].map((v) => v.length)) || 1;
  const byLie = lieOrder
    .filter((l) => byLieMap.has(l))
    .map((l) => {
      const v = byLieMap.get(l);
      const tds = v.map((s) => s.td).filter((x) => typeof x === "number" && x > 0);
      return {
        lie: l,
        shots: v.length,
        pct: Math.round((100 * v.length) / lieTotal),
        avgDist: tds.length ? Math.round(mean(tds)) : null,
      };
    });

  // Approach dispersion: aimed non-tee shots that finish near the target.
  const WIN = 40; // yards window around the pin
  const points = [];
  for (const s of shots) {
    if (s.lie === "Tee") continue;
    const mv = missVector(s);
    if (!mv) continue;
    if (Math.abs(mv.along) > WIN || Math.abs(mv.lateral) > WIN) continue;
    points.push({ x: r1(mv.lateral), y: r1(mv.along), club: clubLabel(s.club, s.type) });
  }
  const dispersion = {
    window: WIN,
    count: points.length,
    points,
    avgLong: points.length ? r1(mean(points.map((p) => p.y))) : 0,
    avgLateral: points.length ? r1(mean(points.map((p) => p.x))) : 0,
  };

  // By course (over par per hole, course-length agnostic).
  const byCourseMap = new Map();
  for (const r of rounds) {
    if (typeof r.toPar !== "number" || !r.holes) continue;
    if (!byCourseMap.has(r.course)) byCourseMap.set(r.course, []);
    byCourseMap.get(r.course).push(r.toPar / r.holes);
  }
  const byCourse = [...byCourseMap.entries()]
    .map(([course, vs]) => ({ course, rounds: vs.length, overParPerHole: r1(mean(vs)) }))
    .sort((a, b) => b.rounds - a.rounds);

  const recent = [...rounds]
    .sort((a, b) => (b.date || 0) - (a.date || 0))
    .slice(0, 15)
    .map((r) => ({
      date: new Date(r.date).toISOString().slice(0, 10),
      course: r.course,
      holes: r.holes,
      strokes: r.strokes,
      toPar: r.toPar,
    }));

  const putts18 = r18.map((r) => r.putts).filter((p) => typeof p === "number" && p > 0);

  return {
    ok: true,
    generatedAt: doc.generatedAt,
    profile: doc.profile || {},
    summary: {
      rounds: rounds.length,
      rounds18: r18.length,
      rounds9: r9.length,
      shots: shots.length,
      girPct: Math.round((100 * sum(rounds.map((r) => r.gir))) / (sum(rounds.map((r) => r.girHoles)) || 1)),
      fairwayPct: Math.round((100 * sum(rounds.map((r) => r.fairways))) / (sum(rounds.map((r) => r.fairwayHoles)) || 1)),
      avgPutts18: putts18.length ? r1(mean(putts18)) : null,
      avgToPar18: r18.length ? r1(mean(r18.map((r) => r.toPar))) : null,
      avgToPar9: r9.length ? r1(mean(r9.map((r) => r.toPar))) : null,
      best18: best(r18),
      best9: best(r9),
    },
    scoreDist,
    clubs,
    byLie,
    dispersion,
    byCourse,
    recent,
  };
}
