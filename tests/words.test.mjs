import { test } from "node:test";
import assert from "node:assert/strict";
import { isPublished, wordsPermalink, publishedPosts } from "../lib/words.mjs";

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
