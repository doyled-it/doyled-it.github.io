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
// a low smash but a normal carry from being thrown out. Mishits still show on
// every chart (hollow, red outline) but are left out of averages, boxes,
// ellipses and gapping.

import fs from "node:fs";
import path from "node:path";

const MISHIT_CARRY = 0.85;
const MISHIT_SMASH = 0.1;
const SMASH_ALSO_SHORT = 0.95;
const MIN_SHOTS_TO_FLAG = 3;
const TIGHT_GAP = 6; // yards; consecutive clubs closer than this overlap

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
    const curve = !isNum(c.spinAxis) ? null : Math.abs(c.spinAxis) < 3 ? "flies straight" : `curves ${c.spinAxis > 0 ? "right" : "left"}${Math.abs(c.spinAxis) >= 10 ? " hard" : ""}`;
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

  const driver = clubByName.get("Driver");
  const tight = clubs.filter((c) => c.tightGap);

  return {
    hasData: true,
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
      minShots: MIN_SHOTS_TO_FLAG,
      tightGap: TIGHT_GAP,
    },
    tightGaps: tight.map((c) => ({ club: c.club, next: c.nextClub, gap: c.gap })),
    clubs,
    boxplot: bw,
    dispersion: dp,
  };
}
