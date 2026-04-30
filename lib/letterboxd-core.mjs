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
