# Words Editor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Michael writes, edits, and publishes blog posts ("words") from his Mac or phone through a web editor, with unpublished drafts kept private.

**Architecture:** Posts live in a new private repo, `doyled-it/words`, one folder per post (`posts/<slug>/index.md` plus `posts/<slug>/images/`). Sveltia CMS on `doyled-it.com/admin` edits that repo through the GitHub API. A GitHub Action in `words` copies published post folders into this site's `src/words/` and pushes with a deploy key, which triggers the normal Cloudflare Workers deploy.

**Tech Stack:** Eleventy 3, Sveltia CMS 0.246.1 (CDN), Node 20 built-ins only (`node:fs`, `node:path`, `node:test`), GitHub Actions.

**Spec:** Approved in chat on 2026-10-29 (no separate file). The approved design:
- Editor at `/admin`, Sveltia CMS, sign-in with a GitHub token once per device, preview styled with the site's CSS.
- Drafts stay private: the source of truth is the private `doyled-it/words` repo.
- A folder per post: `posts/<slug>/index.md` and `posts/<slug>/images/`. Folder names are the slug, no date; the date is front matter.
- Front matter: `title`, `date`, `published` (off by default), optional `description`.
- Publishing copies a published post's whole folder into `src/words/<slug>/`, removes unpublished or deleted posts, and never copies draft folders or their images.
- The site skips anything not marked published as a safety net.
- Blog posts are Michael's writing only; nothing in this plan writes post prose.

## Global Constraints

- `lib/words.mjs` and `scripts/publish-words.mjs` use Node built-ins only, so the `words` Action runs them without `npm install`.
- Post URLs stay `/words/<slug>/`; the existing `/words/hello-world/` URL must not change.
- `published` counts only when it is YAML boolean true in the front matter (`true`, `True`, `TRUE`, unquoted).
- Sveltia CMS is pinned to `0.246.1`.
- No em dashes in code, comments, copy, or commit messages.
- Tests run with `npm test` (`node --test 'tests/**/*.test.mjs'`).

## Review Focus

- `published: true` appearing in the post body while the front matter says false must not publish (Task 1 test).
- Files saved with CRLF line endings must still parse (Task 1 test).
- A folder with no `index.md`, or a dot-folder like `.DS_Store`, in `posts/` is ignored, not published or crashed on (Task 2 test).
- An image removed from a published post disappears from the site on the next publish (Task 2 test: destination folder is replaced, not merged).
- Files in `src/words/` that are not post folders (`words.11tydata.js`) are never deleted by publishing (Task 2 test).

---

### Task 1: Front matter and permalink rules

**Files:**
- Create: `lib/words.mjs`
- Test: `tests/words.test.mjs`

**Interfaces:**
- Produces: `isPublished(markdown: string): boolean`, `wordsPermalink(data: {published?: unknown, page: {fileSlug: string}}): string | false`, `publishedPosts(items: Array<{date: Date, data: {published?: unknown}}>): Array` (filtered to `data.published === true`, sorted newest first).

- [ ] **Step 1: Write the failing tests** in `tests/words.test.mjs`:
  - `isPublished` true for `---\ntitle: a\npublished: true\n---\nbody`, and for `True` and `TRUE`.
  - false for `published: false`, for a missing key, for `published: "true"` and `published: 'true'`, for no front matter at all.
  - false for `---\npublished: false\n---\npublished: true` (body text does not count).
  - true for the CRLF version: `---\r\ntitle: a\r\npublished: true\r\n---\r\nbody`.
  - `wordsPermalink({published: true, page: {fileSlug: "hello-world"}})` equals `"/words/hello-world/"`; `published: false` or missing returns `false`.
  - `publishedPosts` drops `published: false` and missing, keeps `true`, sorts by `date` descending.
- [ ] **Step 2: Run `node --test tests/words.test.mjs`.** Expected: FAIL, module not found.
- [ ] **Step 3: Implement the three functions in `lib/words.mjs`.** `isPublished` reads only the block between the first `---` line and the next `---` line, with `\r?\n` line splits, and matches `/^published:\s*(true|True|TRUE)\s*$/m`.
- [ ] **Step 4: Run `node --test tests/words.test.mjs`.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(words): front matter and permalink rules for posts`.

### Task 2: Publish post folders

**Files:**
- Create: `scripts/publish-words.mjs`
- Modify: `lib/words.mjs`
- Test: `tests/words.test.mjs`

**Interfaces:**
- Consumes: `isPublished` (Task 1).
- Produces: `publishWords(srcDir: string, destDir: string): Promise<{published: string[], removed: string[]}>` (both sorted), and the CLI `node scripts/publish-words.mjs <srcDir> <destDir>`, which prints `published: a, b` and `removed: c` and exits 0, or exits 1 with a usage line when an argument is missing.

- [ ] **Step 1: Write the failing tests** using temp dirs from `fs.mkdtemp(os.tmpdir())`:
  - a published post folder (with `images/a.png`) is copied to `dest/<slug>/index.md` and `dest/<slug>/images/a.png`; a draft folder is not copied; the result lists only the published slug.
  - a folder in dest whose source is now a draft, and a folder in dest with no source, are both removed and listed in `removed`.
  - republishing after deleting `images/a.png` from the source removes it from dest.
  - `src/.DS_Store/`, `src/notes/` (no `index.md`) are ignored; `dest/words.11tydata.js` survives every run.
- [ ] **Step 2: Run `node --test tests/words.test.mjs`.** Expected: FAIL, `publishWords` is not exported.
- [ ] **Step 3: Implement `publishWords`.** A post is a non-dot subdirectory of `srcDir` that contains `index.md`. Each published post's dest folder is removed and recopied with `fs.cp(src, dest, {recursive: true})`, skipping dot-files. Only subdirectories of `destDir` are ever removed. Then write the CLI wrapper in `scripts/publish-words.mjs`.
- [ ] **Step 4: Run `npm test`.** Expected: all tests PASS.
- [ ] **Step 5: Commit** `feat(words): publish post folders from the words repo`.

### Task 3: Site reads post folders

**Files:**
- Create: `src/words/words.11tydata.js`, `src/words/hello-world/index.md`
- Delete: `src/words/2026-04-11-hello-world.md`
- Modify: `.eleventy.js:57-61` (words collection) and the passthrough block at `.eleventy.js:12-18`, `src/robots.txt`

**Interfaces:**
- Consumes: `wordsPermalink`, `publishedPosts` (Task 1).

- [ ] **Step 1: Wire it up.**
  - `words.11tydata.js` default-exports `{layout: "layouts/post.njk", eleventyComputed: {permalink: wordsPermalink}}`.
  - The collection becomes `publishedPosts(collection.getFilteredByGlob("src/words/*/index.md"))`.
  - Add `eleventyConfig.addPassthroughCopy("src/words/*/images/**")`.
  - `hello-world/index.md` keeps the old title, date, and body, adds `published: true`, and drops `layout` and `permalink`.
  - `robots.txt` gains `Disallow: /admin/` under `User-agent: *`.
- [ ] **Step 2: Verify with a real build.** Run `npm ci` (with `PUPPETEER_SKIP_DOWNLOAD=1`) if `node_modules` is missing, then `npx @11ty/eleventy --quiet`. Expected:
  - `_site/words/hello-world/index.html` exists.
  - `_site/words/index.html` and `_site/feed.xml` list "hello world".
  - A temporary `src/words/scratch/index.md` with `published: false` and an `images/x.png` produces neither `_site/words/scratch/index.html` nor an index entry. With `published: true` it produces both, plus `_site/words/scratch/images/x.png`. Delete the scratch folder afterwards.
- [ ] **Step 3: Run `npm test`.** Expected: PASS.
- [ ] **Step 4: Commit** `feat(words): build posts from per-post folders`.

### Task 4: Admin editor page

**Files:**
- Create: `src/admin/index.html`, `src/admin/config.yml`
- Modify: `.eleventy.js` passthrough block

- [ ] **Step 1: Write the page and config.**
  - `index.html` has front matter `permalink: /admin/index.html` and `eleventyExcludeFromCollections: true`, `<meta name="robots" content="noindex">`, and the title `words · admin`. It loads `https://unpkg.com/@sveltia/cms@0.246.1/dist/sveltia-cms.js`, then calls `CMS.registerPreviewStyle("/assets/css/main.css")` and `CMS.registerPreviewStyle("/assets/css/crt.css")`.
  - `config.yml`:

```yaml
backend:
  name: github
  repo: doyled-it/words
  branch: main
media_folder: media
public_folder: /media
site_url: https://doyled-it.com
collections:
  - name: posts
    label: Words
    label_singular: Post
    folder: posts
    path: "{{slug}}/index"
    media_folder: images
    public_folder: images
    slug: "{{slug}}"
    create: true
    sortable_fields: [date, title]
    summary: "{{title}} ({{published}})"
    fields:
      - { name: title, label: Title, widget: string }
      - { name: date, label: Date, widget: datetime, time_format: false, date_format: "YYYY-MM-DD" }
      - { name: published, label: Published, widget: boolean, default: false }
      - { name: description, label: Description, widget: string, required: false }
      - { name: body, label: Body, widget: markdown }
```

  - Add `eleventyConfig.addPassthroughCopy({"src/admin/config.yml": "admin/config.yml"})`.
- [ ] **Step 2: Verify.** Build, serve `_site` locally, open `/admin/` in Playwright. Expected: the Sveltia sign-in screen renders with a "Sign In with Token" option, and the console shows no config errors.
- [ ] **Step 3: Commit** `feat(words): Sveltia CMS editor at /admin`.

### Task 5: The words repo and publish Action

**Files (new repo `doyled-it/words`, private):**
- Create: `README.md`, `posts/hello-world/index.md` (same as Task 3), `.github/workflows/publish.yml`

- [ ] **Step 1: Create the repo and its content.** `publish.yml`:
  - runs on `push` to `main` with paths `posts/**` and on `workflow_dispatch`, with `concurrency: publish` (no cancel).
  - checks out this repo to `words/`, and `doyled-it/doyled-it.github.io` to `site/` with `ssh-key: ${{ secrets.SITE_DEPLOY_KEY }}`.
  - sets up Node from `site/.nvmrc` and runs `node site/scripts/publish-words.mjs words/posts site/src/words`.
  - commits `src/words` in `site/` as `github-actions[bot]` with `chore(words): publish from doyled-it/words@<short sha>`, only when there are staged changes.
  - pushes, retrying up to 3 times with `git pull --rebase`.
- [ ] **Step 2: Deploy key.** Generate an ed25519 key in the scratchpad. Add the public half to the site repo with `gh repo deploy-key add --allow-write --title words-publish`, and the private half as the `SITE_DEPLOY_KEY` secret on `words`. Then delete the local copy.
- [ ] **Step 3: End-to-end check (after the site PR is merged).**
  - A draft post pushed to `words` produces no change in the site repo.
  - Flipping it to `published: true` adds `src/words/<slug>/` to the site and the page goes live.
  - Deleting it removes it again.
  - The hello world post is unchanged throughout.
