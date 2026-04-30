// Resolve "artist + track/album/artist name" to Apple Music deep links via
// the public iTunes Search API. No auth required, free, lightly rate-limited.
//
// Each lookup is cached forever in `.cache/itunes.json` keyed by entity+query
// so we don't re-fetch on every build.

import fs from "node:fs";
import path from "node:path";

const ENDPOINT = "https://itunes.apple.com/search";

export async function loadCache(cachePath) {
  try {
    if (fs.existsSync(cachePath)) {
      return JSON.parse(fs.readFileSync(cachePath, "utf8"));
    }
  } catch {}
  return {};
}

export function saveCache(cachePath, cache) {
  fs.mkdirSync(path.dirname(cachePath), { recursive: true });
  fs.writeFileSync(cachePath, JSON.stringify(cache));
}

// Loose normalize for fuzzy match comparisons.
function norm(s) {
  return (s ?? "")
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, "") // drop "(feat. X)", "[remix]"
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function isPlausibleMatch(hit, entity, expected) {
  const expArtist = norm(expected.artist);
  const expName = norm(expected.name);
  const hitArtist = norm(hit.artistName);
  const hitName = norm(hit.trackName ?? hit.collectionName ?? hit.artistName);
  if (entity === "musicArtist") {
    return hitArtist && expName && (hitArtist.includes(expName) || expName.includes(hitArtist));
  }
  // For song/album we require the artist to match (or be a substring) AND
  // the title to overlap. iTunes Search loves to surface random covers
  // and remixes when the exact match doesn't exist.
  if (!expArtist || !hitArtist) return false;
  const artistOk = hitArtist.includes(expArtist) || expArtist.includes(hitArtist);
  if (!artistOk) return false;
  if (!expName || !hitName) return false;
  return hitName.includes(expName) || expName.includes(hitName);
}

// entity ∈ "song" | "album" | "musicArtist"
// `expected` is { artist, name } used to verify the hit matches.
export async function resolveAppleMusic({ entity, term, expected, cache, fetchImpl = fetch }) {
  const key = `${entity}:${term.toLowerCase().trim()}`;
  if (key in cache) return cache[key];
  try {
    // Pull a few results so we can pick the best match instead of trusting
    // the first hit (which is often a soundalike for obscure tracks).
    const url = `${ENDPOINT}?term=${encodeURIComponent(term)}&entity=${entity}&limit=5&country=us`;
    const res = await fetchImpl(url);
    if (!res.ok) {
      cache[key] = null;
      return null;
    }
    const data = await res.json();
    const candidates = data.results ?? [];
    const hit = candidates.find((c) => isPlausibleMatch(c, entity, expected ?? {}));
    if (!hit) {
      cache[key] = null;
      return null;
    }
    const url2 = hit.collectionViewUrl || hit.trackViewUrl || hit.artistViewUrl || null;
    cache[key] = url2;
    return url2;
  } catch {
    cache[key] = null;
    return null;
  }
}

// Enrich an array of {name, artist?} items with `appleMusicUrl`. Mutates.
export async function enrichWithAppleMusic({ items, entity, cache, fetchImpl = fetch }) {
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));
  for (const item of items) {
    const term =
      entity === "musicArtist"
        ? item.name
        : `${item.artist ?? ""} ${item.name}`.trim();
    if (!term) continue;
    const wasCached = `${entity}:${term.toLowerCase().trim()}` in cache;
    item.appleMusicUrl = await resolveAppleMusic({
      entity,
      term,
      expected: { artist: item.artist, name: item.name },
      cache,
      fetchImpl,
    });
    if (!wasCached) await delay(250);
  }
}
