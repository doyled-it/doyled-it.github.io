#!/usr/bin/env node
// Pull the latest GHIN data directly into src/_data/golf.json using the
// doyled-it fork of the `ghin` library (which accepts GHIN's current
// response shape: NaN stat percents + "Temporary" score status).
//
// Requires GHIN_USERNAME and GHIN_PASSWORD in the environment (or in
// a local .env file).

import "dotenv/config";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { GhinClient } from "ghin";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(repoRoot, "src/_data/golf.json");

const username = process.env.GHIN_USERNAME;
const password = process.env.GHIN_PASSWORD;
if (!username || !password) {
  console.error("error: set GHIN_USERNAME and GHIN_PASSWORD (or put them in .env).");
  process.exit(1);
}

console.log("🏌️  Fetching GHIN data...");
const ghin = new GhinClient({ username, password });

const golfers = await ghin.golfers.search({
  ghin: parseInt(username, 10),
  status: "Active",
});
const golfer = golfers[0];
if (!golfer) {
  console.error("error: no golfer found for that GHIN number");
  process.exit(2);
}
console.log(`   ${golfer.first_name} ${golfer.last_name} · HI ${golfer.handicap_index}`);

const scoresData = await ghin.golfers.getScores(parseInt(username, 10), {
  count: 100,
});
console.log(`   ${scoresData.scores.length} rounds`);

const data = {
  golfer: {
    ghin: golfer.ghin,
    name: `${golfer.first_name} ${golfer.last_name}`,
    firstName: golfer.first_name,
    lastName: golfer.last_name,
    handicapIndex: golfer.handicap_index,
    club: golfer.club_name,
    state: golfer.state,
    status: golfer.status,
  },
  scores: scoresData.scores,
  metadata: {
    fetchedAt: new Date().toISOString(),
    totalRounds: scoresData.scores.length,
    dateRange: {
      earliest: scoresData.scores[scoresData.scores.length - 1]?.played_at,
      latest: scoresData.scores[0]?.played_at,
    },
  },
};

writeFileSync(out, JSON.stringify(data, null, 2));
console.log(`✅ wrote ${out}`);
