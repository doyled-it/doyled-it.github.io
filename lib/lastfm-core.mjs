import fs from "node:fs";
import path from "node:path";
import { loadCache, saveCache, enrichWithAppleMusic } from "./apple-music.mjs";

const API = "https://ws.audioscrobbler.com/2.0/";
const MB_API = "https://musicbrainz.org/ws/2";
const CAA = "https://coverartarchive.org";
const UA = "doyled-it.com/1.0 (michael@doyled-it.com)";

const PLACEHOLDER_RE = /2a96cbd8b46e442fc41c2b86b821562f/;

function pickImage(images, size = "large") {
  if (!Array.isArray(images)) return "";
  const url = images.find((i) => i.size === size)?.["#text"]
    || images[images.length - 1]?.["#text"]
    || "";
  return PLACEHOLDER_RE.test(url) ? "" : url;
}

async function mbCoverArt(artist, track, fetchImpl) {
  try {
    const q = encodeURIComponent(`artist:"${artist}" AND recording:"${track}"`);
    const url = `${MB_API}/recording/?query=${q}&limit=1&fmt=json`;
    const res = await fetchImpl(url, { headers: { "User-Agent": UA } });
    if (!res.ok) return "";
    const data = await res.json();
    const release = data.recordings?.[0]?.releases?.[0];
    if (!release?.id) return "";
    const caaUrl = `${CAA}/release/${release.id}/front-250`;
    const check = await fetchImpl(caaUrl, { method: "HEAD", redirect: "follow" });
    return check.ok || check.status === 307 ? caaUrl : "";
  } catch {
    return "";
  }
}

async function mbArtistCover(artistName, fetchImpl) {
  try {
    const q = encodeURIComponent(`artist:"${artistName}"`);
    const url = `${MB_API}/release-group/?query=${q}&type=album&limit=1&fmt=json`;
    const res = await fetchImpl(url, { headers: { "User-Agent": UA } });
    if (!res.ok) return "";
    const data = await res.json();
    const rg = data["release-groups"]?.[0];
    if (!rg?.id) return "";
    const caaUrl = `${CAA}/release-group/${rg.id}/front-250`;
    const check = await fetchImpl(caaUrl, { method: "HEAD", redirect: "follow" });
    return check.ok || check.status === 307 ? caaUrl : "";
  } catch {
    return "";
  }
}

async function fillMissingArt(items, type, fetchImpl) {
  const delay = (ms) => new Promise((r) => setTimeout(r, ms));
  for (const item of items) {
    if (item.image) continue;
    if (type === "track") {
      item.image = await mbCoverArt(item.artist, item.name, fetchImpl);
    } else if (type === "artist") {
      item.image = await mbArtistCover(item.name, fetchImpl);
    }
    await delay(1100);
  }
}

export async function buildMusicData({
  user,
  apiKey,
  cachePath,
  fetchImpl = fetch,
  now = Date.now,
  ttlMs = 10 * 60 * 1000,
}) {
  let cached = null;
  try {
    if (fs.existsSync(cachePath)) {
      cached = JSON.parse(fs.readFileSync(cachePath, "utf8"));
    }
  } catch {}

  if (cached && now() - cached.fetchedAt < ttlMs) {
    return cached.data;
  }

  try {
    if (!user || !apiKey) throw new Error("missing user or apiKey");

    const base = `${API}?user=${encodeURIComponent(user)}&api_key=${apiKey}&format=json`;

    const urls = {
      recent: `${base}&method=user.getrecenttracks&limit=8`,
      topTracks: `${base}&method=user.gettoptracks&period=1month&limit=6`,
      topArtists: `${base}&method=user.gettopartists&period=1month&limit=6`,
      topArtistsAllTime: `${base}&method=user.gettopartists&period=overall&limit=50`,
      topAlbums: `${base}&method=user.gettopalbums&period=12month&limit=6`,
      topTags: `${base}&method=user.gettoptags&limit=20`,
      info: `${base}&method=user.getinfo`,
    };

    const responses = await Promise.all(
      Object.values(urls).map((u) => fetchImpl(u))
    );

    for (const r of responses) {
      if (!r.ok) throw new Error(`bad status ${r.status}`);
    }

    const [
      recentJson,
      topTracksJson,
      topArtistsJson,
      topArtistsAllTimeJson,
      topAlbumsJson,
      topTagsJson,
      infoJson,
    ] = await Promise.all(responses.map((r) => r.json()));

    const userInfo = infoJson?.user || {};
    const totalScrobbles = parseInt(userInfo.playcount ?? "0", 10);
    const registeredUnix = parseInt(userInfo.registered?.unixtime ?? "0", 10);
    const daysScrobbling = registeredUnix
      ? Math.max(1, Math.floor((Date.now() / 1000 - registeredUnix) / 86400))
      : 0;

    // Pull ~3 months of recent tracks for activity heatmap, week-over-week
    // trend, and a sharper listening-minutes estimate. Last.fm caps `limit`
    // at 200 per call; we walk back until we cross the 84-day boundary.
    const ninetyDaysAgo = Math.floor(now() / 1000) - 90 * 86400;
    const richScrobbles = await fetchScrobblesSince({ base, fetchImpl, since: ninetyDaysAgo, maxPages: 8 });

    const trendByWeek = bucketByWeek(richScrobbles, 12);
    const trendMax = trendByWeek.reduce((m, w) => (w.count > m ? w.count : m), 0);
    const activityHeatmap = bucketByDayHour(richScrobbles);
    const heatMax = activityHeatmap.flat().reduce((m, v) => (v > m ? v : m), 0);
    const listeningMinutes = Math.round((totalScrobbles * 3.5));
    const recent90dCount = richScrobbles.length;
    const recent90dMinutes = Math.round(recent90dCount * 3.5);

    const monthArtistNames = (topArtistsJson.topartists?.artist || []).map((a) => a.name.toLowerCase());
    const allTimeArtistNames = new Set(
      (topArtistsAllTimeJson.topartists?.artist || []).map((a) => a.name.toLowerCase())
    );
    const newArtists = monthArtistNames.filter((n) => !allTimeArtistNames.has(n));
    const discoveryRatePct = monthArtistNames.length
      ? Math.round((newArtists.length / monthArtistNames.length) * 100)
      : 0;

    const data = {
      stale: false,
      topGenre: (topTagsJson.toptags?.tag || [])[0]?.name || "",
      tagCloud: (topTagsJson.toptags?.tag || [])
        .map((t) => ({ name: t.name, count: parseInt(t.count ?? "0", 10) }))
        .filter((t) => t.count > 0)
        .slice(0, 18),
      trendByWeek,
      trendMax,
      activityHeatmap,
      heatMax,
      stats: {
        totalScrobbles,
        registeredUnix,
        daysScrobbling,
        avgPerDay: daysScrobbling ? Math.round(totalScrobbles / daysScrobbling) : 0,
        avgPerWeek: daysScrobbling ? Math.round((totalScrobbles / daysScrobbling) * 7) : 0,
        listeningMinutes,
        listeningHours: Math.round(listeningMinutes / 60),
        listeningDays: Math.round(listeningMinutes / 60 / 24),
        recent90dCount,
        recent90dMinutes,
        discoveryRatePct,
        newArtistsThisMonth: newArtists.length,
        country: userInfo.country || "",
      },
      recent: (recentJson.recenttracks?.track || []).map((t) => ({
        name: t.name,
        artist: t.artist?.["#text"] || t.artist?.name || "",
        image: pickImage(t.image),
        date: t.date?.["#text"] || "now playing",
        nowPlaying: t["@attr"]?.nowplaying === "true",
      })),
      topTracks: (topTracksJson.toptracks?.track || []).map((t) => ({
        name: t.name,
        artist: t.artist?.name || t.artist?.["#text"] || "",
        image: pickImage(t.image),
        plays: t.playcount || "0",
        url: t.url || "",
      })),
      topArtists: (topArtistsJson.topartists?.artist || []).map((a) => ({
        name: a.name,
        image: pickImage(a.image),
        plays: a.playcount || "0",
        url: a.url || "",
      })),
      topAlbums: (topAlbumsJson.topalbums?.album || []).map((a) => ({
        name: a.name,
        artist: a.artist?.name || "",
        image: pickImage(a.image),
        plays: a.playcount || "0",
        url: a.url || "",
      })),
    };

    await Promise.all([
      fillMissingArt(data.recent, "track", fetchImpl),
      fillMissingArt(data.topTracks, "track", fetchImpl),
      fillMissingArt(data.topArtists, "artist", fetchImpl),
      fillMissingArt(data.topAlbums, "track", fetchImpl),
    ]);

    // Add Apple Music deep links (best-effort, cached forever).
    const itunesCachePath = path.join(path.dirname(cachePath), "itunes.json");
    const itunesCache = await loadCache(itunesCachePath);
    await enrichWithAppleMusic({ items: data.topTracks, entity: "song", cache: itunesCache, fetchImpl });
    await enrichWithAppleMusic({ items: data.topArtists, entity: "musicArtist", cache: itunesCache, fetchImpl });
    await enrichWithAppleMusic({ items: data.topAlbums, entity: "album", cache: itunesCache, fetchImpl });
    await enrichWithAppleMusic({ items: data.recent, entity: "song", cache: itunesCache, fetchImpl });
    saveCache(itunesCachePath, itunesCache);

    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    fs.writeFileSync(cachePath, JSON.stringify({ fetchedAt: now(), data }));
    return data;
  } catch (err) {
    if (cached) {
      return { ...cached.data, stale: true };
    }
    return {
      stale: true,
      topGenre: "",
      tagCloud: [],
      trendByWeek: [],
      activityHeatmap: emptyHeatmap(),
      recent: [],
      topTracks: [],
      topArtists: [],
      topAlbums: [],
      error: err.message,
    };
  }
}

// Walk recenttracks pages backwards until we cross the `since` boundary or
// hit `maxPages`. Returns scrobbles with timestamp + artist + name.
async function fetchScrobblesSince({ base, fetchImpl, since, maxPages = 8 }) {
  const out = [];
  for (let page = 1; page <= maxPages; page++) {
    const url = `${base}&method=user.getrecenttracks&limit=200&page=${page}`;
    const res = await fetchImpl(url);
    if (!res.ok) break;
    const json = await res.json();
    const tracks = json?.recenttracks?.track ?? [];
    if (!tracks.length) break;
    let stop = false;
    for (const t of tracks) {
      const uts = parseInt(t.date?.uts ?? "0", 10);
      if (!uts) continue; // "now playing" entries have no date
      if (uts < since) { stop = true; break; }
      out.push({
        uts,
        name: t.name,
        artist: t.artist?.["#text"] || t.artist?.name || "",
      });
    }
    if (stop) break;
    if (tracks.length < 200) break;
  }
  return out;
}

// Group scrobbles into the last `weeks` weekly buckets, oldest first.
// Each bucket is { startUts, endUts, count }. Used for the trend bar chart.
function bucketByWeek(scrobbles, weeks) {
  const now = Math.floor(Date.now() / 1000);
  const weekSec = 7 * 86400;
  const buckets = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const endUts = now - i * weekSec;
    const startUts = endUts - weekSec;
    buckets.push({ startUts, endUts, count: 0 });
  }
  for (const s of scrobbles) {
    for (const b of buckets) {
      if (s.uts >= b.startUts && s.uts < b.endUts) { b.count++; break; }
    }
  }
  return buckets;
}

// Build a 7×24 day-of-week × hour-of-day count matrix in Michael's local
// time (America/Los_Angeles), regardless of where the build runs (CF
// builders are UTC). Day 0 = Sunday so the heatmap reads Sun-Sat.
function bucketByDayHour(scrobbles, tz = "America/Los_Angeles") {
  const grid = emptyHeatmap();
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    hour: "2-digit",
    hour12: false,
  });
  const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  for (const s of scrobbles) {
    const parts = fmt.formatToParts(new Date(s.uts * 1000));
    const wd = parts.find((p) => p.type === "weekday")?.value;
    let hr = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0", 10);
    if (hr === 24) hr = 0; // Intl returns "24" for midnight in some locales
    const day = dayMap[wd];
    if (day !== undefined && Number.isFinite(hr)) grid[day][hr]++;
  }
  return grid;
}

function emptyHeatmap() {
  return Array.from({ length: 7 }, () => new Array(24).fill(0));
}
