import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { isPublished, wordsPermalink, publishedPosts, publishWords } from "../lib/words.mjs";

const fm = (line) => `---\ntitle: a\n${line}\n---\nbody`;

test("isPublished accepts true in any of the three spellings", () => {
  for (const v of ["true", "True", "TRUE"]) assert.equal(isPublished(fm(`published: ${v}`)), true);
});

test("isPublished rejects false, missing, quoted, and no front matter", () => {
  assert.equal(isPublished(fm("published: false")), false);
  assert.equal(isPublished(fm("draft: yes")), false);
  assert.equal(isPublished(fm('published: "true"')), false);
  assert.equal(isPublished(fm("published: 'true'")), false);
  assert.equal(isPublished("just a body\npublished: true"), false);
});

test("isPublished agrees with YAML on spacing and comments", () => {
  assert.equal(isPublished(fm("published:true")), false);
  assert.equal(isPublished("---\ntitle: a\npublished:\ntrue\n---\nbody"), false);
  assert.equal(isPublished(fm("published: true # note")), true);
  assert.equal(isPublished(fm("published: true   ")), true);
});

test("isPublished ignores body text", () => {
  assert.equal(isPublished("---\npublished: false\n---\npublished: true"), false);
});

test("isPublished handles CRLF", () => {
  assert.equal(isPublished("---\r\ntitle: a\r\npublished: true\r\n---\r\nbody"), true);
});

test("wordsPermalink gives a URL only for published posts", () => {
  const page = { fileSlug: "hello-world" };
  assert.equal(wordsPermalink({ published: true, page }), "/words/hello-world/");
  assert.equal(wordsPermalink({ published: false, page }), false);
  assert.equal(wordsPermalink({ page }), false);
});

test("publishedPosts filters and sorts newest first", () => {
  const p = (name, date, published) => ({ name, date: new Date(date), data: { published } });
  const out = publishedPosts([
    p("old", "2026-01-01", true),
    p("draft", "2026-03-01", false),
    p("none", "2026-03-02", undefined),
    p("new", "2026-02-01", true),
  ]);
  assert.deepEqual(out.map((x) => x.name), ["new", "old"]);
});

const post = (published) => `---\ntitle: a\npublished: ${published}\n---\nbody`;
const exists = (p) => fs.access(p).then(() => true, () => false);

async function withDirs(fn) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "words-"));
  const src = path.join(root, "src");
  const dest = path.join(root, "dest");
  await fs.mkdir(src);
  await fs.mkdir(dest);
  try {
    await fn(src, dest);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}

const write = async (file, text) => {
  await fs.mkdir(path.dirname(file), { recursive: true });
  await fs.writeFile(file, text);
};

test("publishWords copies published folders with images and skips drafts", () =>
  withDirs(async (src, dest) => {
    await write(path.join(src, "hi/index.md"), post("true"));
    await write(path.join(src, "hi/images/a.png"), "png");
    await write(path.join(src, "hi/.DS_Store"), "x");
    await write(path.join(src, "wip/index.md"), post("false"));
    const out = await publishWords(src, dest);
    assert.deepEqual(out, { published: ["hi"], removed: [] });
    assert.equal(await fs.readFile(path.join(dest, "hi/index.md"), "utf8"), post("true"));
    assert.equal(await fs.readFile(path.join(dest, "hi/images/a.png"), "utf8"), "png");
    assert.equal(await exists(path.join(dest, "hi/.DS_Store")), false);
    assert.equal(await exists(path.join(dest, "wip")), false);
  }));

test("publishWords removes folders that became drafts or lost their source", () =>
  withDirs(async (src, dest) => {
    await write(path.join(src, "now-draft/index.md"), post("false"));
    await write(path.join(dest, "now-draft/index.md"), post("true"));
    await write(path.join(dest, "gone/index.md"), post("true"));
    const out = await publishWords(src, dest);
    assert.deepEqual(out, { published: [], removed: ["gone", "now-draft"] });
    assert.equal(await exists(path.join(dest, "gone")), false);
    assert.equal(await exists(path.join(dest, "now-draft")), false);
  }));

test("publishWords drops images deleted from the source", () =>
  withDirs(async (src, dest) => {
    await write(path.join(src, "hi/index.md"), post("true"));
    await write(path.join(src, "hi/images/a.png"), "png");
    await publishWords(src, dest);
    await fs.rm(path.join(src, "hi/images/a.png"));
    await publishWords(src, dest);
    assert.equal(await exists(path.join(dest, "hi/images/a.png")), false);
  }));

test("publishWords ignores dot dirs and folders without index.md, and keeps dest files", () =>
  withDirs(async (src, dest) => {
    await write(path.join(src, ".DS_Store/index.md"), post("true"));
    await write(path.join(src, "notes/todo.txt"), "x");
    await write(path.join(dest, "words.11tydata.js"), "keep");
    for (let i = 0; i < 2; i++) {
      const out = await publishWords(src, dest);
      assert.deepEqual(out, { published: [], removed: [] });
    }
    assert.equal(await fs.readFile(path.join(dest, "words.11tydata.js"), "utf8"), "keep");
    assert.equal(await exists(path.join(dest, ".DS_Store")), false);
    assert.equal(await exists(path.join(dest, "notes")), false);
  }));

test("publishWords copies only index.md and images, nested folders included", () =>
  withDirs(async (src, dest) => {
    await write(path.join(src, "hi/index.md"), post("true"));
    await write(path.join(src, "hi/notes.md"), "stray");
    await write(path.join(src, "hi/x.11tydata.js"), "stray");
    await write(path.join(src, "hi/images/a.png"), "png");
    await write(path.join(src, "hi/images/deep/b.png"), "png2");
    await write(path.join(src, "hi/images/.hidden"), "x");
    await publishWords(src, dest);
    assert.equal(await exists(path.join(dest, "hi/notes.md")), false);
    assert.equal(await exists(path.join(dest, "hi/x.11tydata.js")), false);
    assert.equal(await fs.readFile(path.join(dest, "hi/index.md"), "utf8"), post("true"));
    assert.equal(await fs.readFile(path.join(dest, "hi/images/a.png"), "utf8"), "png");
    assert.equal(await fs.readFile(path.join(dest, "hi/images/deep/b.png"), "utf8"), "png2");
    assert.equal(await exists(path.join(dest, "hi/images/.hidden")), false);
  }));
