import fs from "node:fs";
import path from "node:path";

const API = "https://ws.audioscrobbler.com/2.0/";

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
  } catch { /* corrupted cache — ignore */ }

  if (cached && now() - cached.fetchedAt < ttlMs) {
    return cached.data;
  }

  try {
    if (!user || !apiKey) throw new Error("missing user or apiKey");

    const recentUrl = `${API}?method=user.getrecenttracks&user=${encodeURIComponent(user)}&api_key=${apiKey}&format=json&limit=12`;
    const topUrl = `${API}?method=user.gettoptracks&user=${encodeURIComponent(user)}&api_key=${apiKey}&format=json&period=7day&limit=10`;

    const [recentRes, topRes] = await Promise.all([fetchImpl(recentUrl), fetchImpl(topUrl)]);
    if (!recentRes.ok || !topRes.ok) throw new Error(`bad status ${recentRes.status}/${topRes.status}`);

    const recentJson = await recentRes.json();
    const topJson = await topRes.json();

    const data = {
      stale: false,
      recent: (recentJson.recenttracks?.track || []).map((t) => ({
        name: t.name,
        artist: t.artist?.["#text"] || t.artist?.name || "",
        date: t.date?.["#text"] || "now playing",
      })),
      top: (topJson.toptracks?.track || []).map((t) => ({
        name: t.name,
        artist: t.artist?.name || t.artist?.["#text"] || "",
        plays: t.playcount || "0",
      })),
    };

    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    fs.writeFileSync(cachePath, JSON.stringify({ fetchedAt: now(), data }));
    return data;
  } catch (err) {
    if (cached) {
      return { ...cached.data, stale: true };
    }
    return { stale: true, recent: [], top: [], error: err.message };
  }
}
