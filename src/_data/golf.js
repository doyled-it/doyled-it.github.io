import fs from "node:fs";
import path from "node:path";
import { enrichScores, computeStats } from "../../lib/golf-transform.mjs";

export default function () {
  const raw = JSON.parse(
    fs.readFileSync(path.resolve("src/_data/golf.json"), "utf8")
  );
  const scores = enrichScores(raw.scores);
  return {
    golfer: raw.golfer,
    scores,
    stats: computeStats(scores),
  };
}
