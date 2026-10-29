// Rules for "words" posts (src/words/<slug>/index.md). No dependencies: the
// publish script imports this in CI without an npm install.

// True only when the leading front matter block has `published: true`
// (case variants of true allowed). Body text never counts.
export function isPublished(markdown) {
  const m = String(markdown).match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
  return !!m && /^published:\s*(true|True|TRUE)\s*$/m.test(m[1]);
}

// Drafts get no page; published posts live at /words/<slug>/.
export function wordsPermalink(data) {
  return data.published === true ? `/words/${data.page.fileSlug}/` : false;
}

// Published posts only, newest first.
export function publishedPosts(items) {
  return items.filter((i) => i.data.published === true).sort((a, b) => b.date - a.date);
}
