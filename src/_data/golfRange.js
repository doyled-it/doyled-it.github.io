// Range-session view model for the golf page, built from src/_data/mlm.json
// (MLM2PRO shots pulled by scripts/fetch-mlm.mjs).
//
// Club stats pool every shot across every session in mlm.json, so the bag
// view sharpens as sessions pile up. Chart geometry is computed here so the
// template only has to place pre-scaled points.
//
// Mishits: with 3 to 6 shots per club, IQR fences are too unstable to trust,
// so a shot is flagged against its own club's median instead. It is a mishit
// when it carries under MISHIT_CARRY of the median, or when its smash factor
// is MISHIT_SMASH or more below the median (the signature of an off-center
// strike) and it also came up short. The second condition keeps a wedge with
// a low smash but a normal carry from being thrown out. A shot that launches
// LOW_LAUNCH degrees or more under the club's median is also a mishit: that is
// a thin strike, which on a wedge flies long instead of short. Mishits still show on
// every chart (hollow, red outline) but are left out of averages, boxes,
// ellipses and gapping.

import fs from "node:fs";
import path from "node:path";

const MISHIT_CARRY = 0.85;
const MISHIT_SMASH = 0.1;
const SMASH_ALSO_SHORT = 0.95;
const LOW_LAUNCH = 6; // degrees under the club's median launch
const MIN_SHOTS_TO_FLAG = 3;
const TIGHT_GAP = 6; // yards; consecutive clubs closer than this overlap
// The MLM2PRO only measures spin with RPT-marked balls; with range balls the
// app models spin, spin axis and the curve (side) instead. Flip this if you
// start hitting RPT balls.
const SPIN_ESTIMATED = true;

const TZ = "America/Los_Angeles";
const fmtDate = (iso, opts) => new Intl.DateTimeFormat("en-US", { timeZone: TZ, ...opts }).format(new Date(iso));

const isNum = (x) => typeof x === "number" && Number.isFinite(x);
const r1 = (x) => (isNum(x) ? Math.round(x * 10) / 10 : null);
const r2 = (x) => (isNum(x) ? Math.round(x * 100) / 100 : null);
const mean = (xs) => {
  const ys = xs.filter(isNum);
  return ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : null;
};
const sd = (xs) => {
  const ys = xs.filter(isNum);
  if (ys.length < 2) return null;
  const m = mean(ys);
  return Math.sqrt(ys.reduce((a, b) => a + (b - m) ** 2, 0) / (ys.length - 1));
};
// Linear-interpolated quantile (same as numpy's default).
const quantile = (xs, p) => {
  const ys = xs.filter(isNum).sort((a, b) => a - b);
  if (!ys.length) return null;
  const i = (ys.length - 1) * p;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return ys[lo] + (ys[hi] - ys[lo]) * (i - lo);
};
const median = (xs) => quantile(xs, 0.5);
const niceFloor = (x, step) => Math.floor(x / step) * step;
const niceCeil = (x, step) => Math.ceil(x / step) * step;
const ticks = (lo, hi, step) => {
  const out = [];
  for (let v = lo; v <= hi + 1e-9; v += step) out.push(Math.round(v * 10) / 10);
  return out;
};
const signed = (x, unit = "") => (isNum(x) ? `${x > 0 ? "+" : ""}${r1(x)}${unit}` : "–");
const lr = (x) => (!isNum(x) ? "–" : Math.abs(x) < 0.5 ? "on line" : `${Math.abs(r1(x))} ${x > 0 ? "R" : "L"}`);

export default function () {
  const file = path.resolve("src/_data/mlm.json");
  if (!fs.existsSync(file)) return { hasData: false };
  const mlm = JSON.parse(fs.readFileSync(file, "utf8"));
  const sessions = (mlm.sessions || []).filter((s) => (s.shots || []).length);
  if (!sessions.length) return { hasData: false };

  // Bag order and model per club, taken from the per-session summaries.
  const meta = new Map();
  for (const s of sessions) {
    for (const c of s.clubs || []) {
      if (!meta.has(c.club)) meta.set(c.club, { order: c.order, code: c.code, model: c.model });
    }
  }

  const shots = sessions.flatMap((s) =>
    s.shots.map((sh) => ({ ...sh, sessionId: s.id, sessionDate: s.date }))
  );
  const byClub = new Map();
  for (const sh of shots) {
    if (!byClub.has(sh.club)) byClub.set(sh.club, []);
    byClub.get(sh.club).push(sh);
  }

  const names = [...byClub.keys()].sort(
    (a, b) => (meta.get(a)?.order ?? 99) - (meta.get(b)?.order ?? 99)
  );
  const hueFor = (i) => Math.round((i / Math.max(names.length - 1, 1)) * 280);

  const clubs = names.map((name, i) => {
    const all = byClub.get(name);
    const medCarry = median(all.map((x) => x.carry));
    const medSmash = median(all.map((x) => x.smash));
    const medLaunch = median(all.map((x) => x.launch));
    const canFlag = all.length >= MIN_SHOTS_TO_FLAG;
    const flagged = all.map((sh) => {
      const reasons = [];
      if (canFlag && isNum(sh.carry) && sh.carry < MISHIT_CARRY * medCarry) reasons.push("short");
      if (
        canFlag &&
        isNum(sh.smash) &&
        sh.smash <= medSmash - MISHIT_SMASH + 1e-9 &&
        isNum(sh.carry) &&
        sh.carry < SMASH_ALSO_SHORT * medCarry
      ) {
        reasons.push("off-center strike");
      }
      if (canFlag && isNum(sh.launch) && sh.launch <= medLaunch - LOW_LAUNCH + 1e-9) reasons.push("launched low");
      return { ...sh, mishit: reasons.length > 0, why: reasons.join(", ") };
    });
    const clean = flagged.filter((x) => !x.mishit);
    const col = (k) => clean.map((x) => x[k]);
    const avg = (k) => mean(col(k));
    const carries = col("carry");
    return {
      club: name,
      code: meta.get(name)?.code ? meta.get(name).code.toUpperCase() : null,
      model: meta.get(name)?.model ?? null,
      slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      color: `hsl(${hueFor(i)}, 70%, 38%)`,
      n: all.length,
      nClean: clean.length,
      nMishit: all.length - clean.length,
      carry: r1(avg("carry")),
      carrySd: r1(sd(carries)),
      total: r1(avg("total")),
      side: r1(avg("side")),
      sideSd: r1(sd(col("side"))),
      ballSpeed: r1(avg("ballSpeed")),
      clubSpeed: r1(avg("clubSpeed")),
      smash: r2(avg("smash")),
      launch: r1(avg("launch")),
      launchDir: r1(avg("launchDir")),
      spin: isNum(avg("spin")) ? Math.round(avg("spin")) : null,
      spinAxis: r1(avg("spinAxis")),
      apex: r1(avg("apex")),
      descent: r1(avg("descent")),
      attack: r1(avg("attack")),
      clubPath: r1(avg("clubPath")),
      maxCarry: r1(Math.max(...flagged.map((x) => x.carry).filter(isNum))),
      box: {
        min: r1(Math.min(...carries)),
        q1: r1(quantile(carries, 0.25)),
        med: r1(median(carries)),
        q3: r1(quantile(carries, 0.75)),
        max: r1(Math.max(...carries)),
      },
      sideLabel: lr(avg("side")),
      // Yardage card: where most clean shots land (20th to 80th percentile).
      yard: {
        typical: r1(median(carries)),
        lo: r1(quantile(carries, 0.2)),
        hi: r1(quantile(carries, 0.8)),
        total: r1(median(col("total"))),
      },
      kind: /driver|wood|hybrid/i.test(name) ? "woods" : /wedge/i.test(name) ? "wedges" : "irons",
      mishitRate: all.length ? (all.length - clean.length) / all.length : 0,
      medCarryAll: medCarry,
      shots: flagged.map((x, j) => ({ ...x, n: j + 1 })),
    };
  });

  // Gapping: median clean carry against the next club down the bag.
  clubs.forEach((c, i) => {
    const next = clubs[i + 1];
    c.gap = next && isNum(c.box.med) && isNum(next.box.med) ? r1(c.box.med - next.box.med) : null;
    c.tightGap = c.gap != null && c.gap < TIGHT_GAP;
    c.nextClub = next?.club ?? null;
  });

  const clubByName = new Map(clubs.map((c) => [c.club, c]));
  const allShots = clubs.flatMap((c) => c.shots.map((sh) => ({ ...sh, color: c.color })));
  const carriesAll = allShots.map((x) => x.carry).filter(isNum);

  // ---- Box-and-whisker (carry per club, horizontal rows) ----
  const bw = { w: 760, rowH: 30, padL: 118, padR: 70, padT: 10, padB: 30 };
  bw.h = bw.padT + clubs.length * bw.rowH + bw.padB;
  bw.plotW = bw.w - bw.padL - bw.padR;
  bw.plotH = clubs.length * bw.rowH;
  bw.lo = niceFloor(Math.min(...carriesAll) - 5, 25);
  bw.hi = niceCeil(Math.max(...carriesAll) + 5, 25);
  const bx = (v) => r1(bw.padL + ((v - bw.lo) / (bw.hi - bw.lo)) * bw.plotW);
  bw.ticks = ticks(bw.lo, bw.hi, 25).map((v) => ({ v, x: bx(v) }));
  bw.rows = clubs.map((c, i) => {
    const cy = bw.padT + i * bw.rowH + bw.rowH / 2;
    return {
      club: c.club,
      color: c.color,
      cy,
      gap: c.gap,
      tightGap: c.tightGap,
      nextClub: c.nextClub,
      box: c.box,
      x: {
        min: bx(c.box.min),
        q1: bx(c.box.q1),
        med: bx(c.box.med),
        q3: bx(c.box.q3),
        max: bx(c.box.max),
        boxW: r1(Math.max(bx(c.box.q3) - bx(c.box.q1), 1)),
      },
      // Spread points vertically a little so repeats don't stack.
      points: c.shots.map((sh, j) => ({
        x: bx(sh.carry),
        y: r1(cy + ((j % 3) - 1) * 5),
        mishit: sh.mishit,
        tip: `${c.club} #${sh.n}: ${sh.carry} carry, ${lr(sh.side)}, smash ${sh.smash}${sh.mishit ? ` (mishit: ${sh.why})` : ""}`,
      })),
    };
  });

  // ---- Dispersion: side (x) vs carry (y), every shot ----
  const dp = { w: 760, h: 480, padL: 48, padR: 16, padT: 14, padB: 34 };
  dp.plotW = dp.w - dp.padL - dp.padR;
  dp.plotH = dp.h - dp.padT - dp.padB;
  const sideMax = niceCeil(Math.max(10, ...allShots.map((x) => Math.abs(x.side ?? 0))) + 2, 10);
  dp.xLo = -sideMax;
  dp.xHi = sideMax;
  dp.yLo = niceFloor(Math.min(...carriesAll) - 5, 25);
  dp.yHi = niceCeil(Math.max(...carriesAll) + 5, 25);
  const dx = (v) => r1(dp.padL + ((v - dp.xLo) / (dp.xHi - dp.xLo)) * dp.plotW);
  const dy = (v) => r1(dp.padT + ((dp.yHi - v) / (dp.yHi - dp.yLo)) * dp.plotH);
  dp.xTicks = ticks(dp.xLo, dp.xHi, 10).map((v) => ({ v, x: dx(v), label: v === 0 ? "0" : `${Math.abs(v)}${v < 0 ? "L" : "R"}` }));
  dp.yTicks = ticks(dp.yLo, dp.yHi, 25).map((v) => ({ v, y: dy(v) }));
  // How much wider a yard of side looks than a yard of carry.
  dp.stretch = Math.round((dp.plotW / (dp.xHi - dp.xLo)) / (dp.plotH / (dp.yHi - dp.yLo)));
  dp.centerX = dx(0);
  dp.ellipses = clubs
    .filter((c) => c.nClean >= 3 && isNum(c.sideSd) && isNum(c.carrySd))
    .map((c) => ({
      club: c.club,
      color: c.color,
      cx: dx(c.side),
      cy: dy(c.carry),
      rx: r1(Math.max((c.sideSd / (dp.xHi - dp.xLo)) * dp.plotW, 2)),
      ry: r1(Math.max((c.carrySd / (dp.yHi - dp.yLo)) * dp.plotH, 2)),
    }));
  dp.points = allShots.map((sh) => ({
    x: dx(sh.side),
    y: dy(sh.carry),
    color: sh.color,
    mishit: sh.mishit,
    tip: `${sh.club} #${sh.n}: ${sh.carry} carry, ${lr(sh.side)}${sh.mishit ? ` (mishit: ${sh.why})` : ""}`,
  }));

  // ---- Per-club deep dive: zoomed dispersion around that club ----
  for (const c of clubs) {
    const z = { w: 360, h: 300, padL: 44, padR: 12, padT: 12, padB: 30 };
    z.plotW = z.w - z.padL - z.padR;
    z.plotH = z.h - z.padT - z.padB;
    const sMax = niceCeil(Math.max(10, ...c.shots.map((x) => Math.abs(x.side ?? 0))) + 2, 10);
    const cs = c.shots.map((x) => x.carry).filter(isNum);
    z.xLo = -sMax;
    z.xHi = sMax;
    z.yLo = niceFloor(Math.min(...cs) - 5, 10);
    z.yHi = niceCeil(Math.max(...cs) + 5, 10);
    const zx = (v) => r1(z.padL + ((v - z.xLo) / (z.xHi - z.xLo)) * z.plotW);
    const zy = (v) => r1(z.padT + ((z.yHi - v) / (z.yHi - z.yLo)) * z.plotH);
    const xStep = sMax <= 20 ? 5 : 10;
    const yStep = z.yHi - z.yLo <= 40 ? 10 : 20;
    z.xTicks = ticks(z.xLo, z.xHi, xStep).map((v) => ({ x: zx(v), label: v === 0 ? "0" : `${Math.abs(v)}${v < 0 ? "L" : "R"}` }));
    z.yTicks = ticks(z.yLo, z.yHi, yStep).map((v) => ({ v, y: zy(v) }));
    z.centerX = zx(0);
    z.ellipse =
      c.nClean >= 3 && isNum(c.sideSd) && isNum(c.carrySd)
        ? {
            cx: zx(c.side),
            cy: zy(c.carry),
            rx: r1(Math.max((c.sideSd / (z.xHi - z.xLo)) * z.plotW, 2)),
            ry: r1(Math.max((c.carrySd / (z.yHi - z.yLo)) * z.plotH, 2)),
          }
        : null;
    z.points = c.shots.map((sh) => ({
      x: zx(sh.side),
      y: zy(sh.carry),
      n: sh.n,
      mishit: sh.mishit,
      tip: `#${sh.n}: ${sh.carry} carry, ${lr(sh.side)}${sh.mishit ? ` (mishit: ${sh.why})` : ""}`,
    }));
    c.zoom = z;
    // Ball flight in neutral terms (positive = right on every MLM angle).
    const start = !isNum(c.launchDir) ? null : Math.abs(c.launchDir) < 2 ? "starts on line" : `starts ${Math.abs(c.launchDir)}° ${c.launchDir > 0 ? "right" : "left"}`;
    const curve = !isNum(c.spinAxis)
      ? null
      : (Math.abs(c.spinAxis) < 3 ? "flies straight" : `curves ${c.spinAxis > 0 ? "right" : "left"}${Math.abs(c.spinAxis) >= 10 ? " hard" : ""}`) +
        (SPIN_ESTIMATED ? " (est.)" : "");
    c.shape = [start, curve].filter(Boolean).join(", ") || "–";
    c.attackLabel = signed(c.attack, "°");
    c.pathLabel = signed(c.clubPath, "°");
    c.launchDirLabel = signed(c.launchDir, "°");
    c.spinAxisLabel = signed(c.spinAxis, "°");
  }

  // ---- Session log ----
  const sessionRows = sessions.map((s) => ({
    id: s.id,
    date: fmtDate(s.date, { month: "short", day: "numeric", year: "numeric" }),
    time: fmtDate(s.date, { hour: "numeric", minute: "2-digit" }),
    type: (s.type || "").toLowerCase(),
    shots: s.shotCount,
    clubs: (s.clubs || []).length,
    minutes: s.durationMin,
    longestCarry: s.longestCarry,
    fastestClub: s.fastestClub,
    mishits: allShots.filter((x) => x.sessionId === s.id && x.mishit).length,
  }));

  const course = courseComparison(clubs);
  if (course) course.fairway = fairwayPrediction(clubs, course);
  const practice = practiceVsScoring(mlm.history || []);
  const odds = oddsModel(clubs);
  const speed = speedTracker(sessions);

  const driver = clubByName.get("Driver");
  const tight = clubs.filter((c) => c.tightGap);

  return {
    hasData: true,
    spinEstimated: SPIN_ESTIMATED,
    fetchedAt: mlm.fetchedAt,
    sinceLabel: fmtDate(mlm.since, { month: "short", day: "numeric", year: "numeric" }),
    sessions: sessionRows,
    totals: {
      sessions: sessions.length,
      shots: allShots.length,
      clubs: clubs.length,
      mishits: allShots.filter((x) => x.mishit).length,
      longestCarry: r1(Math.max(...carriesAll)),
      fastestClub: r1(Math.max(...allShots.map((x) => x.clubSpeed).filter(isNum))),
      driverCarry: driver?.carry ?? null,
      driverSmash: driver?.smash ?? null,
      avgSide: r1(mean(allShots.filter((x) => !x.mishit).map((x) => x.side))),
      avgSideLabel: lr(mean(allShots.filter((x) => !x.mishit).map((x) => x.side))),
    },
    rules: {
      carryPct: Math.round(MISHIT_CARRY * 100),
      smashDrop: MISHIT_SMASH,
      alsoShortPct: Math.round(SMASH_ALSO_SHORT * 100),
      lowLaunch: LOW_LAUNCH,
      minShots: MIN_SHOTS_TO_FLAG,
      tightGap: TIGHT_GAP,
    },
    tightGaps: tight.map((c) => ({ club: c.club, next: c.nextClub, gap: c.gap })),
    clubs,
    boxplot: bw,
    dispersion: dp,
    course,
    odds,
    practice,
    speed,
    yardageGroups: ["woods", "irons", "wedges"]
      .map((k) => ({ kind: k, clubs: clubs.filter((c) => c.kind === k && c.nClean > 0) }))
      .filter((g) => g.clubs.length),
  };
}

// ---- Range vs course ----
// GHIN hole stats use the same codes for drive_accuracy and
// approach_shot_accuracy: 0 = left, 1 = right, 2 = long, 3 = short. (Decoded by
// matching hole-level codes to GHIN's own per-round missed_*_percent stats.)
const MISS = ["left", "right", "long", "short"];
const COURSE_ROUNDS = 20; // most recent rounds with hole-level miss data
const START_LINE = 2; // degrees; start direction inside this counts as on line
const RANGE_MISS_YD = 8; // yards off the club's median carry counts as short/long

function courseComparison(clubs) {
  const file = path.resolve("src/_data/golf-raw.json");
  if (!fs.existsSync(file)) return null;
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  const rounds = (raw.scores || [])
    .filter((s) => (s.hole_details || []).some((h) => h.approach_shot_accuracy != null || h.drive_accuracy != null))
    .sort((a, b) => new Date(b.played_at) - new Date(a.played_at))
    .slice(0, COURSE_ROUNDS);
  if (!rounds.length) return null;

  const tee = { fairway: 0, left: 0, right: 0, long: 0, short: 0 };
  const appr = { green: 0, left: 0, right: 0, long: 0, short: 0 };
  for (const r of rounds) {
    for (const h of r.hole_details || []) {
      if (h.par >= 4) {
        if (h.fairway_hit === true) tee.fairway++;
        else if (h.drive_accuracy != null) tee[MISS[h.drive_accuracy]]++;
      }
      if (h.gir_flag === true) appr.green++;
      else if (h.approach_shot_accuracy != null) appr[MISS[h.approach_shot_accuracy]]++;
    }
  }
  const share = (o, keys) => {
    const n = keys.reduce((a, k) => a + o[k], 0);
    return Object.fromEntries(keys.map((k) => [k, n ? Math.round((o[k] / n) * 100) : 0]).concat([["n", n]]));
  };

  const shotsOf = (pred) => clubs.filter(pred).flatMap((c) => c.shots.map((sh) => ({ ...sh, med: c.medCarryAll })));
  const startShare = (xs) => {
    const ys = xs.filter((x) => isNum(x.launchDir));
    const n = ys.length || 1;
    return {
      left: Math.round((ys.filter((x) => x.launchDir < -START_LINE).length / n) * 100),
      online: Math.round((ys.filter((x) => Math.abs(x.launchDir) <= START_LINE).length / n) * 100),
      right: Math.round((ys.filter((x) => x.launchDir > START_LINE).length / n) * 100),
      avg: r1(mean(ys.map((x) => x.launchDir))),
      n: ys.length,
    };
  };
  const depthShare = (xs) => {
    const ys = xs.filter((x) => isNum(x.carry));
    const n = ys.length || 1;
    return {
      short: Math.round((ys.filter((x) => x.carry < x.med - RANGE_MISS_YD).length / n) * 100),
      long: Math.round((ys.filter((x) => x.carry > x.med + RANGE_MISS_YD).length / n) * 100),
      n: ys.length,
    };
  };
  const teeShots = shotsOf((c) => c.kind === "woods");
  const apprShots = shotsOf((c) => c.kind === "irons" || /pitching|gap/i.test(c.club));

  const out = {
    rounds: rounds.length,
    since: fmtDate(rounds[rounds.length - 1].played_at, { month: "short", year: "numeric" }),
    tee: { all: share(tee, ["fairway", "left", "right", "long", "short"]), miss: share(tee, ["left", "right"]) },
    appr: {
      all: share(appr, ["green", "left", "right", "long", "short"]),
      miss: share(appr, ["left", "right", "long", "short"]),
    },
    range: {
      teeStart: startShare(teeShots),
      apprStart: startShare(apprShots),
      apprDepth: depthShare(apprShots),
      apprSide: r1(mean(apprShots.filter((x) => !x.mishit).map((x) => x.side))),
    },
    rules: { startLine: START_LINE, rangeMissYd: RANGE_MISS_YD },
  };

  // Plain-language read of the two side by side.
  const notes = [];
  const tm = out.tee.miss;
  const ts = out.range.teeStart;
  if (tm.n) {
    const courseSide = tm.left > tm.right ? "left" : tm.right > tm.left ? "right" : null;
    const rangeSide = ts.avg < -START_LINE ? "left" : ts.avg > START_LINE ? "right" : null;
    if (courseSide && rangeSide === courseSide) {
      notes.push(`Off the tee you miss ${courseSide} more often on the course (${tm[courseSide]}% of missed fairways), and your woods start ${Math.abs(ts.avg)}° ${rangeSide} on average at the range. Same miss in both places.`);
    } else if (courseSide && rangeSide) {
      const woods = clubs.filter((c) => c.kind === "woods" && isNum(c.spinAxis));
      const axis = mean(woods.map((c) => c.spinAxis));
      const curveSide = isNum(axis) && Math.abs(axis) >= 3 ? (axis > 0 ? "right" : "left") : null;
      notes.push(
        `Off the tee you miss ${courseSide} more often on the course (${tm[courseSide]}% of missed fairways), but your woods start ${rangeSide} at the range (${ts[rangeSide]}% of swings, measured).` +
          (curveSide === courseSide
            ? ` The range's estimated spin curves them back ${curveSide}; if that curve grows on the course, it would explain the ${courseSide} miss.`
            : " The course miss probably comes from curve or aim rather than start line.")
      );
    } else if (courseSide) {
      notes.push(`Off the tee you miss ${courseSide} more often on the course (${tm[courseSide]}% of missed fairways); your woods start close to on line at the range.`);
    }
  }
  const am = out.appr.miss;
  if (am.n) {
    const biggest = ["left", "right", "long", "short"].sort((a, b) => am[b] - am[a])[0];
    if (biggest === "short") {
      notes.push(`Short is your most common missed green on the course (${am.short}%, against ${am.long}% long). At the range ${out.range.apprDepth.short}% of iron shots carried ${RANGE_MISS_YD}+ yards short of that club's median and ${out.range.apprDepth.long}% carried that far long. Your misses come up short, so pick the club for your typical carry, not your best one.`);
    } else {
      notes.push(`Your most common missed green on the course is ${biggest} (${am[biggest]}%).`);
    }
    const lr = am.left - am.right;
    if (Math.abs(lr) <= 5) {
      notes.push(`Left and right green misses are close to even on the course (${am.left}% vs ${am.right}%), even though the range model puts your irons ${lrText(out.range.apprSide)} on average. Your irons start ${out.range.apprStart.online}% of the time within ${START_LINE}° of on line, which is measured, so the course is backing the start line more than the estimated curve.`);
    }
  }
  out.notes = notes;
  return out;
}
const lrText = (x) => (!isNum(x) ? "on line" : Math.abs(x) < 0.5 ? "on line" : `${Math.abs(r1(x))} yd ${x > 0 ? "right" : "left"}`);

// ---- Green-hitting odds ----
// Each club is treated as a normal spread around its average clean shot. With
// 3 to 6 shots per club a raw SD can be absurdly small (three 6-irons within
// 2 yards), so each club's SD is blended with the whole bag's typical spread
// (scaled to that club's distance) as if that bag spread were PRIOR_SHOTS more
// shots. A mishit is assumed to miss the green.
const PRIOR_SHOTS = 4;

function oddsModel(clubs) {
  const usable = clubs.filter((c) => c.nClean >= 2 && isNum(c.carry));
  const ratios = (k) =>
    usable.filter((c) => c.nClean >= 3 && isNum(c[k])).map((c) => c[k] / c.carry);
  const carryCv = median(ratios("carrySd")) ?? 0.04;
  const sideCv = median(ratios("sideSd")) ?? 0.05;
  const blend = (sdv, n, prior) => {
    const df = Math.max(n - 1, 0);
    const s2 = isNum(sdv) ? sdv * sdv : 0;
    return Math.sqrt((df * s2 + PRIOR_SHOTS * prior * prior) / (df + PRIOR_SHOTS));
  };
  return {
    priorShots: PRIOR_SHOTS,
    clubs: usable.map((c) => ({
      club: c.club,
      code: c.code,
      color: c.color,
      carry: c.carry,
      side: c.side ?? 0,
      carrySd: r1(blend(c.carrySd, c.nClean, carryCv * c.carry)),
      sideSd: r1(blend(c.sideSd, c.nClean, sideCv * c.carry)),
      mishitRate: r2(c.mishitRate),
      n: c.n,
    })),
  };
}

// ---- Expected vs actual fairways ----
// Driver landing spots (left/right) as a normal spread, all swings counted
// (a mishit can still find the fairway). The SD is blended with the bag's
// typical side spread the same way the green odds are. Fairway widths are
// assumptions, not measured: 30 yards is the headline.
const FAIRWAY_WIDTHS = [25, 30, 35];

const erf = (x) => {
  // Abramowitz and Stegun 7.1.26, accurate to about 1e-7.
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return x >= 0 ? y : -y;
};
const normCdf = (x, m, s) => 0.5 * (1 + erf((x - m) / (s * Math.SQRT2)));

function fairwayPrediction(clubs, course) {
  const d = clubs.find((c) => c.club === "Driver");
  if (!d) return null;
  const sides = d.shots.map((x) => x.side).filter(isNum);
  if (sides.length < 2) return null;
  const others = clubs.filter((c) => c.nClean >= 3 && isNum(c.sideSd)).map((c) => c.sideSd / c.carry);
  const prior = (median(others) ?? 0.05) * (d.carry ?? 250);
  const df = sides.length - 1;
  const sdv = Math.sqrt((df * sd(sides) ** 2 + PRIOR_SHOTS * prior * prior) / (df + PRIOR_SHOTS));
  const m = mean(sides);
  const at = (w) => Math.round((normCdf(w / 2, m, sdv) - normCdf(-w / 2, m, sdv)) * 100);
  return {
    widths: FAIRWAY_WIDTHS.map((w) => ({ width: w, pct: at(w) })),
    predicted: at(30),
    actual: course.tee.all.fairway,
    shots: sides.length,
    meanSide: r1(m),
    sd: r1(sdv),
  };
}

// ---- Practice vs scoring ----
// Every practice session ever (date and size only) against 18-hole score
// differentials over the same stretch.
const AFTER_DAYS = 7; // a round within this many days of a session counts as "after practice"
const MIN_GROUP = 5; // rounds needed in each group before the comparison is shown as meaningful

function practiceVsScoring(history) {
  const file = path.resolve("src/_data/golf-raw.json");
  if (!history.length || !fs.existsSync(file)) return null;
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  const sessions = history.map((h) => ({ ...h, t: new Date(h.date).getTime() })).sort((a, b) => a.t - b.t);
  const start = sessions[0].t - 14 * 86400000;
  const end = Date.now();
  const rounds = (raw.scores || [])
    .filter((s) => s.number_of_holes === 18 && isNum(Number(s.differential)) && s.differential !== null)
    .map((s) => ({ t: new Date(s.played_at).getTime(), diff: Number(s.differential), date: s.played_at }))
    .filter((r) => r.t >= start && r.t <= end)
    .sort((a, b) => a.t - b.t);
  if (!rounds.length) return null;

  // Rolling 5-round average.
  rounds.forEach((r, i) => {
    const win = rounds.slice(Math.max(0, i - 4), i + 1);
    r.roll = mean(win.map((x) => x.diff));
    r.afterPractice = sessions.some((s) => s.t <= r.t && r.t - s.t <= AFTER_DAYS * 86400000);
  });
  const after = rounds.filter((r) => r.afterPractice);
  const other = rounds.filter((r) => !r.afterPractice);

  const ch = { w: 760, h: 240, padL: 44, padR: 16, padT: 14, padB: 64 };
  ch.plotW = ch.w - ch.padL - ch.padR;
  ch.plotH = ch.h - ch.padT - ch.padB;
  const dLo = Math.floor(Math.min(...rounds.map((r) => r.diff)) - 1);
  const dHi = Math.ceil(Math.max(...rounds.map((r) => r.diff)) + 1);
  const x = (t) => r1(ch.padL + ((t - start) / (end - start)) * ch.plotW);
  const y = (v) => r1(ch.padT + ((dHi - v) / (dHi - dLo)) * ch.plotH);
  const step = Math.max(1, Math.round((dHi - dLo) / 4));
  ch.yTicks = [];
  for (let v = dLo; v <= dHi; v += step) ch.yTicks.push({ v, y: y(v) });
  ch.points = rounds.map((r) => ({
    x: x(r.t),
    y: y(r.diff),
    after: r.afterPractice,
    tip: `${fmtDate(r.date, { month: "short", day: "numeric", year: "numeric" })}: differential ${r.diff}${r.afterPractice ? ` (within ${AFTER_DAYS} days of a range session)` : ""}`,
  }));
  ch.rollPath = rounds.map((r, i) => `${i ? "L" : "M"} ${x(r.t)} ${y(r.roll)}`).join(" ");
  const maxShots = Math.max(...sessions.map((s) => s.shots || 0), 1);
  const stripTop = ch.padT + ch.plotH + 12;
  const stripH = 22;
  ch.strip = { top: stripTop, h: stripH, labelY: stripTop + stripH + 16 };
  ch.sessions = sessions.map((s) => {
    const hgt = r1(Math.max(3, ((s.shots || 0) / maxShots) * stripH));
    return {
      x: x(s.t),
      y: r1(stripTop + stripH - hgt),
      h: hgt,
      tip: `${fmtDate(s.date, { month: "short", day: "numeric", year: "numeric" })}: range session, ${s.shots} shots`,
    };
  });
  // Month labels along the bottom, every other month if crowded.
  ch.months = [];
  const d0 = new Date(start);
  const months = [];
  for (let m = new Date(d0.getFullYear(), d0.getMonth() + 1, 1); m.getTime() <= end; m.setMonth(m.getMonth() + 1)) months.push(new Date(m));
  const every = months.length > 8 ? 2 : 1;
  months.forEach((m, i) => {
    if (i % every) return;
    ch.months.push({ x: x(m.getTime()), label: fmtDate(m.toISOString(), { month: "short", year: "2-digit" }) });
  });

  return {
    chart: ch,
    sessions: sessions.length,
    shots: sessions.reduce((a, s) => a + (s.shots || 0), 0),
    rounds: rounds.length,
    afterDays: AFTER_DAYS,
    after: { n: after.length, avg: r1(mean(after.map((r) => r.diff))) },
    other: { n: other.length, avg: r1(mean(other.map((r) => r.diff))) },
    enough: after.length >= MIN_GROUP && other.length >= MIN_GROUP,
    minGroup: MIN_GROUP,
    firstSession: fmtDate(sessions[0].date, { month: "short", year: "numeric" }),
  };
}

// ---- Swing-speed tracker ----
// Driver club-head speed per session over time, with the fastest swing marked.
// Club speed is measured (not modeled from spin), so every driver swing counts,
// mishits included: a thinned drive is still a real swing-speed sample.
function speedTracker(sessions) {
  const rows = sessions
    .map((s) => {
      const drv = s.shots.filter((x) => /driver/i.test(x.club) && isNum(x.clubSpeed));
      if (!drv.length) return null;
      const cs = drv.map((x) => x.clubSpeed);
      const bs = drv.map((x) => x.ballSpeed).filter(isNum);
      return {
        id: s.id,
        date: s.date,
        t: new Date(s.date).getTime(),
        n: drv.length,
        avg: r1(mean(cs)),
        max: r1(Math.max(...cs)),
        ballMax: bs.length ? r1(Math.max(...bs)) : null,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.t - b.t);
  if (!rows.length) return null;

  const ch = { w: 760, h: 220, padL: 44, padR: 16, padT: 16, padB: 32 };
  ch.plotW = ch.w - ch.padL - ch.padR;
  ch.plotH = ch.h - ch.padT - ch.padB;
  const vals = rows.flatMap((d) => [d.avg, d.max]).filter(isNum);
  ch.lo = niceFloor(Math.min(...vals) - 3, 5);
  ch.hi = niceCeil(Math.max(...vals) + 3, 5);
  const n = rows.length;
  const x = (i) => r1(n === 1 ? ch.padL + ch.plotW / 2 : ch.padL + (i * ch.plotW) / (n - 1));
  const y = (v) => r1(ch.padT + ((ch.hi - v) / (ch.hi - ch.lo)) * ch.plotH);
  ch.yTicks = ticks(ch.lo, ch.hi, 5).map((v) => ({ v, y: y(v) }));
  ch.points = rows.map((d, i) => ({
    x: x(i),
    yAvg: y(d.avg),
    yMax: y(d.max),
    label: fmtDate(d.date, { month: "short", day: "numeric" }),
    tipAvg: `${fmtDate(d.date, { month: "short", day: "numeric", year: "numeric" })}: ${d.avg} mph average over ${d.n} drive${d.n === 1 ? "" : "s"}`,
    tipMax: `${fmtDate(d.date, { month: "short", day: "numeric", year: "numeric" })}: ${d.max} mph fastest`,
  }));
  ch.avgPath = n > 1 ? rows.map((d, i) => `${i ? "L" : "M"} ${x(i)} ${y(d.avg)}`).join(" ") : null;
  ch.single = n === 1;

  const latest = rows[rows.length - 1];
  const fastest = rows.reduce((a, b) => (b.max > a.max ? b : a));
  const bestAvg = rows.reduce((a, b) => (b.avg > a.avg ? b : a));
  const ballMaxes = rows.map((d) => d.ballMax).filter(isNum);
  return {
    chart: ch,
    sessions: n,
    latest: { avg: latest.avg, max: latest.max, date: fmtDate(latest.date, { month: "short", day: "numeric" }) },
    fastest: { max: fastest.max, date: fmtDate(fastest.date, { month: "short", year: "numeric" }) },
    bestAvg: bestAvg.avg,
    bestBall: ballMaxes.length ? Math.max(...ballMaxes) : null,
    // 1 mph of club speed is worth roughly 2.5 to 3 yards of driver carry; the
    // midpoint is a fair rule of thumb to motivate speed work.
    yardsPerMph: 2.75,
  };
}
