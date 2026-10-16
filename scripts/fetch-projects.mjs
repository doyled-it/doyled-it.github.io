#!/usr/bin/env node
// Refresh the live GitHub descriptions for the projects page into
// src/_data/github-repos.json. The curated structure (which repos, sections,
// sprites, overrides) lives in src/_data/projects.js; this only fills in the
// fallback description, url and language for each repo it lists.
//
// Public API, no auth needed, but GITHUB_TOKEN (present in CI) raises the rate
// limit. The file is only rewritten when something changed.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { SECTIONS } from "../lib/projects-config.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(repoRoot, "src/_data/github-repos.json");
const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;

const repos = [];
for (const s of SECTIONS) {
  for (const r of s.repos) {
    repos.push({ owner: r.owner || "doyled-it", repo: r.repo });
    if (r.extra?.url) {
      const m = r.extra.url.match(/github\.com\/([^/]+)\/([^/]+)/);
      if (m) repos.push({ owner: m[1], repo: m[2] });
    }
  }
}

const headers = { "user-agent": "doyled-it-fetch-projects", accept: "application/vnd.github+json" };
if (token) headers.authorization = `Bearer ${token}`;

const cache = {};
for (const { owner, repo } of repos) {
  const k = `${owner}/${repo}`;
  if (cache[k]) continue;
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
  if (!res.ok) {
    console.warn(`⚠️  ${k}: GitHub returned ${res.status}; keeping any existing entry`);
    const prev = existsSync(out) ? JSON.parse(readFileSync(out, "utf8")) : {};
    if (prev[k]) cache[k] = prev[k];
    continue;
  }
  const j = await res.json();
  cache[k] = {
    url: j.html_url,
    description: j.description || "",
    language: j.language || null,
    homepage: j.homepage || null,
    archived: !!j.archived,
  };
}

const sorted = Object.fromEntries(Object.keys(cache).sort().map((k) => [k, cache[k]]));
const next = JSON.stringify(sorted, null, 2) + "\n";
const prev = existsSync(out) ? readFileSync(out, "utf8") : "";
if (prev === next) {
  console.log(`✅ projects: ${Object.keys(sorted).length} repos, no change`);
} else {
  writeFileSync(out, next);
  console.log(`✅ projects: wrote ${Object.keys(sorted).length} repos to ${out}`);
}
