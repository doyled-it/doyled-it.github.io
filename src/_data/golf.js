import fs from "node:fs";
import path from "node:path";
import {
  enrichScores,
  computeStats,
  computeGoals,
} from "../../lib/golf-transform.mjs";

export default function () {
  const raw = JSON.parse(
    fs.readFileSync(path.resolve("src/_data/golf-raw.json"), "utf8")
  );
  const scores = enrichScores(raw.scores);
  const stats = computeStats(scores);
  const usedSet = new Set(stats.usedIds || []);
  const scoresWithUsedFlag = scores.map((s) => ({
    ...s,
    usedInHI: usedSet.has(s.id),
  }));
  const goals = computeGoals(raw.golfer?.handicapIndex ?? 0, stats.handicapTrend);
  return {
    golfer: raw.golfer,
    scores: scoresWithUsedFlag,
    stats,
    goals,
  };
}
