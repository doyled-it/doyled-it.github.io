import path from "node:path";
import { buildMusicData } from "../../lib/lastfm-core.mjs";

export default async function () {
  const user = process.env.LASTFM_USER;
  const apiKey = process.env.LASTFM_API_KEY;
  const cachePath = path.resolve(".cache/lastfm.json");

  if (!user || !apiKey) {
    console.warn("lastfm: LASTFM_USER or LASTFM_API_KEY not set; returning empty stub");
    return {
      stale: true,
      recent: [],
      topTracks: [],
      topArtists: [],
      topAlbums: [],
      tagCloud: [],
      trendByWeek: [],
      trendMax: 0,
      activityHeatmap: Array.from({ length: 7 }, () => new Array(24).fill(0)),
      heatMax: 0,
      stats: null,
      error: "missing credentials",
    };
  }

  return buildMusicData({ user, apiKey, cachePath });
}
