// Letterboxd data layer. Mirrors lib/lastfm-core.mjs:
// - pure functions for parsing/derivation (testable in isolation)
// - buildMovieData() orchestrates fetch → cache → parse → derive
// - dependency-injected fetch + clock for tests
// - graceful degradation: fetch failure returns cached `data` with stale=true,
//   or empty stub if no cache.

const HTML_ENTITIES = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
};

function decodeHtml(s) {
  if (!s) return s;
  return s.replace(/&(amp|lt|gt|quot|#39|apos);/g, (m) => HTML_ENTITIES[m] ?? m);
}

function matchOne(block, regex) {
  const m = block.match(regex);
  return m ? m[1] : null;
}

// Parse a single <item> block into a film object, or null if malformed.
function parseItem(block) {
  const title = matchOne(block, /<letterboxd:filmTitle>([\s\S]*?)<\/letterboxd:filmTitle>/);
  if (!title) return null; // require at minimum a film title
  const yearStr = matchOne(block, /<letterboxd:filmYear>(\d+)<\/letterboxd:filmYear>/);
  const ratingStr = matchOne(block, /<letterboxd:memberRating>([\d.]+)<\/letterboxd:memberRating>/);
  const liked = /<letterboxd:memberLike>Yes<\/letterboxd:memberLike>/.test(block);
  const rewatch = /<letterboxd:rewatch>Yes<\/letterboxd:rewatch>/.test(block);
  const watchedDate = matchOne(block, /<letterboxd:watchedDate>(\d{4}-\d{2}-\d{2})<\/letterboxd:watchedDate>/);
  const tmdbStr = matchOne(block, /<tmdb:movieId>(\d+)<\/tmdb:movieId>/);
  const letterboxdUrl = matchOne(block, /<link>([\s\S]*?)<\/link>/);
  // Poster lives inside <description><![CDATA[...]]></description>; pull first <img src="...">
  const description = matchOne(block, /<description>([\s\S]*?)<\/description>/);
  const posterUrl = description ? matchOne(description, /<img src="([^"]+)"/) : null;

  return {
    title: decodeHtml(title.trim()),
    year: yearStr ? parseInt(yearStr, 10) : null,
    rating: ratingStr ? parseFloat(ratingStr) : null,
    liked,
    rewatch,
    watchedDate, // "YYYY-MM-DD" string, never new Date()'d
    tmdbId: tmdbStr ? parseInt(tmdbStr, 10) : null,
    letterboxdUrl: letterboxdUrl ? letterboxdUrl.trim() : null,
    posterUrl,
  };
}

export function parseLetterboxdRss(xml) {
  if (!xml || typeof xml !== "string") return [];
  const out = [];
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = itemRe.exec(xml)) !== null) {
    try {
      const film = parseItem(m[1]);
      if (film) out.push(film);
    } catch (err) {
      console.warn(`letterboxd: skipped malformed <item>: ${err.message}`);
    }
  }
  return out;
}

// Parse a "YYYY-MM-DD" string as a local-Pacific date. Construction via
// `new Date(year, monthIdx, day)` avoids the UTC-midnight off-by-one that
// `new Date("2026-04-18")` produces in Pacific timezones.
export function parsePacificDate(s) {
  if (!s || typeof s !== "string") return null;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [, y, mo, d] = m;
  return new Date(parseInt(y, 10), parseInt(mo, 10) - 1, parseInt(d, 10));
}

// Mode of decades, formatted as "1990s" / "2010s" / etc. Skips null years.
// Returns null if no valid years.
export function computeTopDecade(years) {
  const counts = new Map();
  for (const y of years) {
    if (typeof y !== "number" || !Number.isFinite(y)) continue;
    const decade = Math.floor(y / 10) * 10;
    counts.set(decade, (counts.get(decade) ?? 0) + 1);
  }
  if (!counts.size) return null;
  let topDecade = null;
  let topCount = -1;
  for (const [dec, c] of counts) {
    if (c > topCount) { topDecade = dec; topCount = c; }
  }
  return `${topDecade}s`;
}

// Build 10 buckets from 0.5 to 5.0 in 0.5-star increments.
export function computeRatingHistogram(films) {
  const buckets = [];
  for (let r = 0.5; r <= 5.0 + 1e-9; r += 0.5) {
    buckets.push({ rating: Math.round(r * 10) / 10, count: 0 });
  }
  for (const f of films) {
    if (typeof f.rating !== "number") continue;
    const idx = Math.round(f.rating * 2) - 1;
    if (idx >= 0 && idx < buckets.length) buckets[idx].count++;
  }
  return buckets;
}

const DAY_MS = 86400000;
const WEEKS_IN_CALENDAR = 26;
const WEEKS_IN_TREND = 12;

// Build a 26-week × 7-day calendar grid, oldest first.
// Each cell: { date: "YYYY-MM-DD", count, films: [] }.
// Films with null watchedDate or outside the window are silently excluded.
export function computeCalendar(films, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const totalDays = WEEKS_IN_CALENDAR * 7;
  const cells = [];
  // Walk back totalDays from today, oldest first.
  for (let i = totalDays - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * DAY_MS);
    cells.push({
      date: formatYMD(d),
      count: 0,
      films: [],
    });
  }
  // Index cells by date for O(1) lookup
  const byDate = new Map(cells.map((c) => [c.date, c]));
  for (const f of films) {
    if (!f.watchedDate) continue;
    const cell = byDate.get(f.watchedDate);
    if (cell) {
      cell.count++;
      cell.films.push(f);
    }
  }
  return cells;
}

// Build 12 weekly buckets, oldest first.
// Each bucket: { startDate: "YYYY-MM-DD", count }.
export function computeTrendByWeek(films, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const buckets = [];
  for (let i = WEEKS_IN_TREND - 1; i >= 0; i--) {
    const start = new Date(today.getTime() - (i + 1) * 7 * DAY_MS + DAY_MS);
    const end = new Date(today.getTime() - i * 7 * DAY_MS + DAY_MS);
    buckets.push({
      startDate: formatYMD(start),
      _start: start,
      _end: end,
      count: 0,
    });
  }
  for (const f of films) {
    if (!f.watchedDate) continue;
    const d = parsePacificDate(f.watchedDate);
    if (!d) continue;
    for (const b of buckets) {
      if (d >= b._start && d < b._end) { b.count++; break; }
    }
  }
  // Drop internal _start / _end before returning
  return buckets.map(({ _start, _end, ...rest }) => rest);
}

function formatYMD(d) {
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, "0");
  const da = String(d.getDate()).padStart(2, "0");
  return `${y}-${mo}-${da}`;
}
