import fs from "node:fs";
import path from "node:path";

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
      topTracks: `${base}&method=user.gettoptracks&period=7day&limit=6`,
      topArtists: `${base}&method=user.gettopartists&period=1month&limit=6`,
      topAlbums: `${base}&method=user.gettopalbums&period=12month&limit=6`,
      topTags: `${base}&method=user.gettoptags&limit=5`,
    };

    const responses = await Promise.all(
      Object.values(urls).map((u) => fetchImpl(u))
    );

    for (const r of responses) {
      if (!r.ok) throw new Error(`bad status ${r.status}`);
    }

    const [recentJson, topTracksJson, topArtistsJson, topAlbumsJson, topTagsJson] =
      await Promise.all(responses.map((r) => r.json()));

    const data = {
      stale: false,
      topGenre: (topTagsJson.toptags?.tag || [])[0]?.name || "",
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
      recent: [],
      topTracks: [],
      topArtists: [],
      topAlbums: [],
      error: err.message,
    };
  }
}
