import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { buildMusicData } from "../lib/lastfm-core.mjs";

const CACHE_DIR = path.resolve(".cache-test");
const cachePath = path.join(CACHE_DIR, "lastfm.json");

function fakeFetchOk() {
  return async (url) => ({
    ok: true,
    json: async () => ({
      recenttracks: { track: [{ name: "Track A", artist: { "#text": "Artist A" }, date: { "#text": "01 Jan 2026, 00:00" } }] },
      toptracks: { track: [{ name: "Top A", artist: { name: "Artist A" }, playcount: "5" }] },
    }),
  });
}

function fakeFetchFail() {
  return async () => ({ ok: false, status: 500 });
}

before(() => { fs.rmSync(CACHE_DIR, { recursive: true, force: true }); });
after(() => { fs.rmSync(CACHE_DIR, { recursive: true, force: true }); });

test("buildMusicData returns live data and writes cache", async () => {
  const data = await buildMusicData({
    user: "testuser",
    apiKey: "testkey",
    cachePath,
    fetchImpl: fakeFetchOk(),
    now: () => 1000,
  });
  assert.equal(data.stale, false);
  assert.equal(data.recent.length, 1);
  assert.equal(data.top.length, 1);
  assert.ok(fs.existsSync(cachePath));
});

test("buildMusicData returns cached data when TTL not expired", async () => {
  fs.writeFileSync(cachePath, JSON.stringify({ fetchedAt: 1000, data: { recent: [{ name: "Cached" }], top: [], stale: false } }));
  const data = await buildMusicData({
    user: "testuser",
    apiKey: "testkey",
    cachePath,
    fetchImpl: () => { throw new Error("should not be called"); },
    now: () => 1000 + 60 * 1000,
    ttlMs: 10 * 60 * 1000,
  });
  assert.equal(data.recent[0].name, "Cached");
});

test("buildMusicData falls back to stale cache on fetch failure", async () => {
  fs.writeFileSync(cachePath, JSON.stringify({ fetchedAt: 0, data: { recent: [{ name: "Old" }], top: [], stale: false } }));
  const data = await buildMusicData({
    user: "testuser",
    apiKey: "testkey",
    cachePath,
    fetchImpl: fakeFetchFail(),
    now: () => 1000 * 60 * 60 * 24,
    ttlMs: 10 * 60 * 1000,
  });
  assert.equal(data.stale, true);
  assert.equal(data.recent[0].name, "Old");
});

test("buildMusicData returns empty stub when no cache and fetch fails", async () => {
  const data = await buildMusicData({
    user: "testuser",
    apiKey: "testkey",
    cachePath: path.join(CACHE_DIR, "missing.json"),
    fetchImpl: fakeFetchFail(),
    now: () => 0,
  });
  assert.equal(data.stale, true);
  assert.deepEqual(data.recent, []);
  assert.deepEqual(data.top, []);
});
