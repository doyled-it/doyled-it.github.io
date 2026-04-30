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

// entity ∈ "song" | "album" | "musicArtist"
export async function resolveAppleMusic({ entity, term, cache, fetchImpl = fetch }) {
  const key = `${entity}:${term.toLowerCase().trim()}`;
  if (key in cache) return cache[key];
  try {
    const url = `${ENDPOINT}?term=${encodeURIComponent(term)}&entity=${entity}&limit=1&country=us`;
    const res = await fetchImpl(url);
    if (!res.ok) {
      cache[key] = null;
      return null;
    }
    const data = await res.json();
    const hit = data.results?.[0];
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
// `entity` controls what we search for. Pauses 250ms between misses to be
// nice to iTunes.
export async function enrichWithAppleMusic({ items, entity, cache, fetchImpl = fetch }) {
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));
  for (const item of items) {
    const term =
      entity === "musicArtist"
        ? item.name
        : `${item.artist ?? ""} ${item.name}`.trim();
    if (!term) continue;
    const wasCached = `${entity}:${term.toLowerCase().trim()}` in cache;
    item.appleMusicUrl = await resolveAppleMusic({ entity, term, cache, fetchImpl });
    if (!wasCached) await delay(250);
  }
}
