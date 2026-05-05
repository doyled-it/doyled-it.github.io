import { execSync } from "node:child_process";

// YYYY-MM-DD of the most recent commit that touched the live stats files.
// Surfaces in the footer next to the version, so a stats refresh is visible
// even when the code version doesn't change.
const TRACKED = ["src/_data/baseball.json", "src/_data/golf-raw.json"];

export default function () {
  try {
    const iso = execSync(`git log -1 --format=%cI -- ${TRACKED.join(" ")}`, { encoding: "utf8" }).trim();
    return iso.slice(0, 10) || new Date().toISOString().slice(0, 10);
  } catch {
    return new Date().toISOString().slice(0, 10);
  }
}
