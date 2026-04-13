import fs from "node:fs";
import path from "node:path";

const API = "https://ws.audioscrobbler.com/2.0/";

function pickImage(images, size = "large") {
  if (!Array.isArray(images)) return "";
  const match = images.find((i) => i.size === size);
  return match?.["#text"] || images[images.length - 1]?.["#text"] || "";
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
      recent: `${base}&method=user.getrecenttracks&limit=12`,
      topTracks: `${base}&method=user.gettoptracks&period=7day&limit=5`,
      topArtists: `${base}&method=user.gettopartists&period=1month&limit=5`,
      topAlbums: `${base}&method=user.gettopalbums&period=12month&limit=5`,
    };

    const responses = await Promise.all(
      Object.values(urls).map((u) => fetchImpl(u))
    );

    for (const r of responses) {
      if (!r.ok) throw new Error(`bad status ${r.status}`);
    }

    const [recentJson, topTracksJson, topArtistsJson, topAlbumsJson] =
      await Promise.all(responses.map((r) => r.json()));

    const data = {
      stale: false,
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

    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    fs.writeFileSync(cachePath, JSON.stringify({ fetchedAt: now(), data }));
    return data;
  } catch (err) {
    if (cached) {
      return { ...cached.data, stale: true };
    }
    return {
      stale: true,
      recent: [],
      topTracks: [],
      topArtists: [],
      topAlbums: [],
      error: err.message,
    };
  }
}
