#!/usr/bin/env node
// Pull MLM2PRO range sessions from Rapsodo's RCloud API (mlm.rapsodo.com) into
// src/_data/mlm.json. There is no public API; this mirrors what the RCloud web
// app (golf-cloud.rapsodo.com) does: log in with email + password, then send
// the returned JWT as "Authorization: JWT <token>" on each request.
//
// Only sessions on or after `since` in scripts/mlm-sources.json are kept (the
// most recent session when this was set up, plus everything after it).
//
// The API is metric (meters, m/s); values are converted to yards, mph and feet
// here so the site can render them as-is.
//
// Requires MLM_EMAIL and MLM_PASSWORD in the environment (or a local .env).

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://mlm.rapsodo.com";
const M_TO_YD = 1.09361;
const MS_TO_MPH = 2.23694;
const M_TO_FT = 3.28084;

// Local runs read .env; CI passes the secrets as env vars and has no .env.
if (existsSync(join(repoRoot, ".env"))) process.loadEnvFile(join(repoRoot, ".env"));

const { since } = JSON.parse(readFileSync(join(repoRoot, "scripts/mlm-sources.json"), "utf8"));
const email = process.env.MLM_EMAIL;
const password = process.env.MLM_PASSWORD;
if (!email || !password) {
  console.error("error: set MLM_EMAIL and MLM_PASSWORD (or put them in .env).");
  process.exit(1);
}

async function api(path, { token, method = "GET", body } = {}) {
  const res = await fetch(API + path, {
    method,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      ...(token ? { authorization: `JWT ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new Error(`${method} ${path} -> ${res.status} ${json?.message ?? ""}`.trim());
  }
  return json;
}

const ymd = (d) => d.toISOString().slice(0, 10);
const num = (v) => (typeof v === "number" ? v : v == null || v === "" ? null : Number(v));
const round = (v, p = 1) => {
  const n = num(v);
  return n == null || !Number.isFinite(n) ? null : Math.round(n * 10 ** p) / 10 ** p;
};
const scale = (v, k) => (num(v) == null ? null : num(v) * k);
const mean = (xs) => {
  const ys = xs.filter((x) => x != null && Number.isFinite(x));
  return ys.length ? ys.reduce((a, b) => a + b, 0) / ys.length : null;
};
const stdev = (xs) => {
  const ys = xs.filter((x) => x != null && Number.isFinite(x));
  if (ys.length < 2) return null;
  const m = mean(ys);
  return Math.sqrt(ys.reduce((a, b) => a + (b - m) ** 2, 0) / (ys.length - 1));
};

console.log("⛳ Logging in to Rapsodo RCloud...");
const login = await api("/auth/login", { method: "POST", body: { email, password } });
// The login token can arrive with the scheme already glued on ("JWTeyJ…");
// strip it so the header is always exactly "JWT <token>".
const token = String(login.token ?? "").replace(/^JWT\s*/, "");

const { clubs } = await api("/club/v2", { token });
const clubById = new Map(clubs.map((c) => [String(c.id), c]));

// The activities query takes calendar dates, so pad a day each side and then
// filter on the exact session timestamp.
const sinceDate = new Date(since);
const start = ymd(new Date(sinceDate.getTime() - 86400000));
const end = ymd(new Date(Date.now() + 86400000));
const list = await api(`/session/v2/activities?startDate=${start}&endDate=${end}`, { token });
const listed = list.data ?? [];
if ((list.total ?? 0) > listed.length) {
  console.warn(`⚠️  activities returned ${listed.length} of ${list.total}; some sessions may be missing`);
}
const wanted = listed.filter((s) => new Date(s.date) >= sinceDate);
console.log(`   ${wanted.length} session(s) since ${since}`);

const sessions = [];
for (const s of wanted) {
  const { data } = await api(`/session/v2/activities/${s.id}`, { token });
  const shots = (data.shots ?? []).map((sh) => {
    const club = clubById.get(String(sh.clubId));
    return {
      id: String(sh.id),
      time: sh.startDate,
      club: club?.name ?? "Unknown",
      clubCode: club?.code ?? null,
      clubId: String(sh.clubId),
      clubOrder: club?.order ?? 99,
      carry: round(scale(sh.carry, M_TO_YD)),
      total: round(scale(sh.carryTotal, M_TO_YD)),
      side: round(scale(sh.sideCarry, M_TO_YD)),
      ballSpeed: round(scale(sh.ballSpeed, MS_TO_MPH)),
      clubSpeed: round(scale(sh.clubSpeed, MS_TO_MPH)),
      smash: round(sh.smashFactor, 2),
      launch: round(sh.launchAngle),
      launchDir: round(sh.launchDirection),
      spin: num(sh.spinRate) == null ? null : Math.round(num(sh.spinRate)),
      spinAxis: round(sh.spinAxis),
      apex: round(scale(sh.apex, M_TO_FT)),
      descent: round(sh.descentAngle),
      attack: round(sh.attackAngle),
      clubPath: round(sh.clubPath),
    };
  });

  // Per-club summary, in bag order (driver first).
  const byClub = new Map();
  for (const sh of shots) {
    if (!byClub.has(sh.club)) byClub.set(sh.club, []);
    byClub.get(sh.club).push(sh);
  }
  const clubSummary = [...byClub.entries()]
    .map(([name, xs]) => {
      const c = clubById.get(xs[0].clubId);
      return {
        club: name,
        code: xs[0].clubCode,
        model: c ? [c.brandName, c.modelName].filter(Boolean).join(" ") : null,
        order: xs[0].clubOrder,
        shots: xs.length,
        carry: round(mean(xs.map((x) => x.carry))),
        carrySd: round(stdev(xs.map((x) => x.carry))),
        maxCarry: round(Math.max(...xs.map((x) => x.carry ?? -Infinity))),
        total: round(mean(xs.map((x) => x.total))),
        side: round(mean(xs.map((x) => x.side))),
        ballSpeed: round(mean(xs.map((x) => x.ballSpeed))),
        clubSpeed: round(mean(xs.map((x) => x.clubSpeed))),
        smash: round(mean(xs.map((x) => x.smash)), 2),
        launch: round(mean(xs.map((x) => x.launch))),
        spin: Math.round(mean(xs.map((x) => x.spin)) ?? 0) || null,
      };
    })
    .sort((a, b) => a.order - b.order);

  sessions.push({
    id: s.id,
    date: s.date,
    type: s.sessionType,
    app: s.application,
    durationMin: num(s.duration),
    shotCount: shots.length,
    longestCarry: round(Math.max(...shots.map((x) => x.carry ?? -Infinity))),
    avgBallSpeed: round(mean(shots.map((x) => x.ballSpeed))),
    fastestClub: round(Math.max(...shots.map((x) => x.clubSpeed ?? -Infinity))),
    clubs: clubSummary,
    shots: shots.map(({ clubOrder, clubId, ...rest }) => rest),
  });
}

sessions.sort((a, b) => new Date(b.date) - new Date(a.date));
const out = join(repoRoot, "src/_data/mlm.json");
const shotTotal = sessions.reduce((a, s) => a + s.shotCount, 0);
// Leave the file alone when nothing changed, so the weekly job doesn't commit
// a new fetchedAt stamp on its own.
const prev = existsSync(out) ? JSON.parse(readFileSync(out, "utf8")) : null;
if (prev && prev.since === since && JSON.stringify(prev.sessions) === JSON.stringify(sessions)) {
  console.log(`✅ no new sessions (${sessions.length} session(s), ${shotTotal} shots); ${out} unchanged`);
} else {
  writeFileSync(out, JSON.stringify({ fetchedAt: new Date().toISOString(), since, sessions }, null, 2) + "\n");
  console.log(`✅ wrote ${out} (${sessions.length} session(s), ${shotTotal} shots)`);
}
