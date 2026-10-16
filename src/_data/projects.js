// Projects page model. Curated allowlist (which repos, which themed section,
// which sprite, in what order) plus a live GitHub description as the fallback.
//
// Each repo's blurb is the `description` override when set, otherwise the live
// GitHub repo description cached in src/_data/github-repos.json (refreshed by
// scripts/fetch-projects.mjs and committed). Overrides exist only where a repo
// has no GitHub description or where a hand-written line reads better.
//
// To add a project: drop its repo name into the right section below. To change
// how it reads, set `description`. Nothing here goes stale on its own: the
// weekly job refreshes the live descriptions.

import fs from "node:fs";
import path from "node:path";
import { SECTIONS } from "../../lib/projects-config.mjs";

// owner defaults to "doyled-it"; set it for repos in another org.
const key = (r) => `${r.owner || "doyled-it"}/${r.repo}`;

export default function () {
  const cachePath = path.resolve("src/_data/github-repos.json");
  const cache = fs.existsSync(cachePath) ? JSON.parse(fs.readFileSync(cachePath, "utf8")) : {};
  return SECTIONS.map((s) => ({
    title: s.title,
    sprite: s.sprite,
    items: s.repos.map((r) => {
      const gh = cache[key(r)] || {};
      return {
        name: r.title || r.repo,
        url: r.url || gh.url || `https://github.com/${key(r)}`,
        description: r.description || gh.description || "",
        extra: r.extra || null,
      };
    }),
  }));
}
