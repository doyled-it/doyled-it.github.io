import fs from "node:fs/promises";
import path from "node:path";

// Rules for "words" posts (src/words/<slug>/index.md). No dependencies: the
// publish script imports this in CI without an npm install.

// True only when the leading front matter block has `published: true`
// (case variants of true allowed). Body text never counts.
export function isPublished(markdown) {
  const m = String(markdown).match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  return !!m && /^published:[ \t]+(?:true|True|TRUE)[ \t]*(?:#.*)?$/m.test(m[1]);
}

// Drafts get no page; published posts live at /words/<slug>/.
export function wordsPermalink(data) {
  return data.published === true ? `/words/${data.page.fileSlug}/` : false;
}

// Published posts only, newest first.
export function publishedPosts(items) {
  return items.filter((i) => i.data.published === true).sort((a, b) => b.date - a.date);
}

const subdirs = async (dir) =>
  (await fs.readdir(dir, { withFileTypes: true }))
    .filter((e) => e.isDirectory() && !e.name.startsWith("."))
    .map((e) => e.name);

// Mirror published posts (index.md and images/ only) from srcDir into destDir. Only subdirectories
// of destDir are ever removed, so loose files there (words.11tydata.js) stay.
export async function publishWords(srcDir, destDir) {
  await fs.mkdir(destDir, { recursive: true });
  const published = [];
  for (const slug of await subdirs(srcDir)) {
    const md = await fs.readFile(path.join(srcDir, slug, "index.md"), "utf8").catch(() => null);
    if (md !== null && isPublished(md)) published.push(slug);
  }
  const removed = (await subdirs(destDir)).filter((s) => !published.includes(s));
  for (const slug of removed) await fs.rm(path.join(destDir, slug), { recursive: true, force: true });
  for (const slug of published) {
    const to = path.join(destDir, slug);
    await fs.rm(to, { recursive: true, force: true });
    const from = path.join(srcDir, slug);
    await fs.mkdir(to, { recursive: true });
    await fs.copyFile(path.join(from, "index.md"), path.join(to, "index.md"));
    // A post is one markdown file plus one image folder; nothing else ships.
    await fs.cp(path.join(from, "images"), path.join(to, "images"), {
      recursive: true,
      filter: (f) => !path.basename(f).startsWith("."),
    }).catch((e) => {
      if (e.code !== "ENOENT") throw e;
    });
  }
  return { published: published.sort(), removed: removed.sort() };
}
