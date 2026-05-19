// One-off screenshotter: serve _site, snap a few pages, save PNGs.
import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import { extname, join } from "node:path";
import puppeteer from "puppeteer";

const ROOT = new URL("../_site/", import.meta.url);
const PORT = 8181;

const types = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
};

const server = http.createServer(async (req, res) => {
  try {
    let url = decodeURIComponent(req.url.split("?")[0]);
    if (url.endsWith("/")) url += "index.html";
    let path = new URL("." + url, ROOT);
    try { await stat(path); } catch {
      path = new URL("." + url + "/index.html", ROOT);
    }
    const body = await readFile(path);
    res.writeHead(200, { "content-type": types[extname(path.pathname)] || "text/plain" });
    res.end(body);
  } catch (e) {
    res.writeHead(404); res.end("404");
  }
});
await new Promise((r) => server.listen(PORT, r));

const browser = await puppeteer.launch({
  args: ["--no-sandbox", "--disable-setuid-sandbox"],
});
const page = await browser.newPage();
await page.setViewport({ width: 1100, height: 900, deviceScaleFactor: 2 });

const shots = [
  { name: "home-full", url: "/", full: true },
  { name: "home-webring", url: "/", selector: ".webring" },
  { name: "words", url: "/words/", full: true },
];

for (const s of shots) {
  await page.goto(`http://127.0.0.1:${PORT}${s.url}`, { waitUntil: "networkidle0" });
  await new Promise((r) => setTimeout(r, 800));
  if (s.selector) {
    const el = await page.$(s.selector);
    if (el) {
      await el.screenshot({ path: `/tmp/preview-${s.name}.png` });
      console.log("wrote", `/tmp/preview-${s.name}.png`);
      continue;
    }
  }
  await page.screenshot({
    path: `/tmp/preview-${s.name}.png`,
    fullPage: !!s.full,
  });
  console.log("wrote", `/tmp/preview-${s.name}.png`);
}

await browser.close();
server.close();
