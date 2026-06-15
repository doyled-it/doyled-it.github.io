# doyled-it.com

Personal site. Eleventy 3 (11ty) static build wrapped in a Cloudflare
Worker. Pastel HyperCard / cracktro aesthetic, cursor buddies, per-hobby
data cards (baseball, golf, music, movies), and a sardonic pixel-buddy
chatbot ("botty") that floats on every page and talks to Claude. Replaces
the prior al-folio Jekyll site (preserved on `legacy/al-folio`).

## Develop

```sh
npm install
npm run dev    # http://localhost:8080
```

## Test

```sh
npm test
```

Unit tests cover résumé date filters, Last.fm caching, baseball stat
helpers, and cursor-buddy direction logic.

## Build

```sh
npm run build
```

Produces `_site/` including:

- Static HTML for all 9 cards (home, résumé, projects, words, music,
  movies, contact, baseball, golf)
- 8 short-URL redirect stubs (`/m`, `/cal`, `/gh`, `/p`, `/li`, `/s`,
  `/c`, `/w`) for the printed business card QR codes
- `resume.pdf` — copied from the committed `src/resume.pdf` (regenerated
  on `resume.json` changes via the `update-resume-pdf` workflow)

Individual steps (chained by `npm run build`):

| Script | What it does |
|---|---|
| `npm run build:bio` | Bundle `src/_data/bio-bundle.json` for the chatbot |
| `npm run build:site` | Run Eleventy → `_site/` |
| `npm run build:resume` | Regenerate `src/resume.pdf` (Puppeteer) |

For static-only iteration, `npm run build:eleventy` runs `build:bio` +
`build:site` (skips the resume PDF). This is also what Cloudflare runs on
deploy — Puppeteer can't run there, so the committed `src/resume.pdf` is
passthrough-copied.

## Hosting

Cloudflare Workers, configured by `wrangler.toml`. Pushing to `main`
triggers the CF GitHub integration → it runs `npm run build:eleventy`
then `npx wrangler deploy`. The Worker:

- Serves `_site/` as static assets via the `ASSETS` binding
- Routes `POST /api/chat` through `worker/index.js` to Claude (handles
  both opening-line "quip" mode and the full conversational "chat" mode
  used by the botty widget)

Botty uses Cloudflare Turnstile (invisible mode) + a per-IP daily rate
limit backed by a Workers KV namespace. After the first Turnstile solve,
the Worker mints a session token so subsequent chat sends skip the
Turnstile round-trip.

### Worker config (CF dashboard)

Variables / secrets the Worker needs:

| Name | Type | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | secret | Claude API access |
| `TURNSTILE_SECRET_KEY` | secret | Turnstile server-side verification |
| `LASTFM_USER` | build env var | Music card + bio bundle |
| `LASTFM_API_KEY` | build env var | Music card + bio bundle |
| `CARD_CHAT_DISABLED` | env var | `"true"` flips the chat kill switch |
| `RATE_LIMIT` (KV namespace) | binding | Per-IP rate limit + chat sessions |

## Hobby data

### Music card (Last.fm)

The music card pulls a rich slice of Last.fm at build time: total
scrobbles, recent + top tracks/artists/albums, a 12-week listening trend,
a 7×24 day-of-week × hour activity heatmap (in Pacific time), a genre
cloud aggregated from artist tags, and Apple Music + Last.fm deep links
on every item.

Local builds need credentials in `.env`:

```sh
cp .env.example .env
# edit .env with LASTFM_USER + LASTFM_API_KEY
npm run build
```

Without credentials the build succeeds and the card shows a stub.

### Refreshing hobby stats

| Script | What it refreshes |
|---|---|
| `npm run update:stats` | All three — `update:baseball` + `update:golf` + `update:league` |
| `npm run update:baseball` | `src/_data/baseball.json` from `~/vaults/baseball` |
| `npm run update:golf` | `src/_data/golf-raw.json` straight from GHIN (needs `GHIN_USERNAME` + `GHIN_PASSWORD` in `.env`) |
| `npm run update:league` | `src/_data/league.json` by scraping sdabl1.info (uses `scripts/sdabl-sources.json`) |

`update:golf` uses the `doyled-it/ghin` fork (pinned in `package.json`)
which tolerates GHIN's current response shape, and pulls full scores
(with per-hole + statistics detail) plus the handicap record into
`golf-raw.json` — the file the golf page actually reads.

#### Where each piece runs

Two of these can't run on GitHub-hosted runners: **GHIN** (golf) and
**sdabl1.info** (league) both return `403` to datacenter IPs. So the
automation is split:

- **`.github/workflows/update-stats.yml`** (GitHub-hosted, daily 6am UTC):
  baseball only. The `obsidian-baseball` repo is public, so this just
  works.
- **`.github/workflows/update-stats-local.yml`** (self-hosted, daily
  6:30am UTC): golf + league. Needs a **self-hosted runner on a
  residential connection** (e.g. a home server) labelled `self-hosted`,
  plus repo secrets `GHIN_USERNAME` / `GHIN_PASSWORD`. Until a runner is
  registered, its scheduled runs just queue harmlessly — trigger it from
  the Actions tab once the runner is online.

Each new league season, update `scripts/sdabl-sources.json` with the
active season's `page_node_id` (from the division page URL on
sdabl1.info). Finished seasons stay frozen in `league.json`.

You can still refresh everything by hand any time with
`npm run update:stats` from a residential connection, then commit the
JSON diff under `src/_data/`.

## Botty (the chat widget)

A pixel-buddy chatbot widget pinned to every page. Resting on the
bottom-right of the viewport, he blinks/smirks/shifts via a 19-expression
SVG face, fires page-aware quips, and opens a chat panel on click.

Two modes share one endpoint (`POST /api/chat`):

- **Quip mode** — short opening lines. After 4s of dwell (or ~250px of
  mouse movement), botty pops a contextual one-liner. Most fire from a
  local 175+ entry quip bank (`src/_data/botty-quips.json`); the first
  fresh-page quip optionally calls Claude for an LLM-generated greeting
  using collected visitor signals.
- **Chat mode** — full Q&A about Michael (work, hobbies, publications,
  recent GitHub activity, listening habits). Strictly scoped: refuses
  off-topic questions and prompt-injection attempts, capped at 4
  sentences and 250 output tokens, redirects to email for anything
  substantive.

The Worker calls Claude Haiku 4.5 with a build-time-bundled bio as a
cached system prompt. The bundle (`src/_data/bio-bundle.json`, gitignored)
is built by `scripts/compile-bio.mjs` and combines:

- `src/_data/bio.json` — hand-curated voice guide + hobbies
- `src/_data/baseball.json` — per-season summary stats
- `src/_data/golf-raw.json` — current handicap + last 5 rounds
- `src/_data/resume.json` — publications with summaries
- GitHub public API — recent repos, top languages, follower count
- Last.fm — top tracks/artists/albums, listening hours, peak hour/day,
  discovery rate, full genre cloud

### Visitor signals (for quip selection)

Botty collects a wide signal panel in the browser: timezone, language,
referer, browser/platform, mac chip (WebGL renderer probe), battery
level + charging, connection type, screen aspect (ultrawide/vertical),
high-refresh-rate display, dark/reduced-motion prefs, GPC/DNT, WebGPU
support, PWA-installed, touch-on-desktop, cores/RAM, storage quota,
reload count, etc. Quips trigger on any combination via predicate
suffixes (`_gte`, `_lte`, `_starts`, `_contains`, `_not`, `_len_gte`)
and weight to bias the surprising lines over generic filler.

## Repository layout

```
.eleventy.js                  # 11ty config
wrangler.toml                 # Cloudflare Worker config
worker/
  index.js                    # Worker entrypoint (POST /api/chat)
lib/                          # pure modules with unit tests
  lastfm-core.mjs             # rich Last.fm fetch + derivations
  apple-music.mjs             # iTunes Search → Apple Music URL resolver
  baseball-filters.mjs
  golf-transform.mjs
  resume-filters.mjs
  botty-quips.mjs             # quip predicate evaluator + weighted picker
  botty-engagement.mjs        # dwell/mouse engagement state machine
scripts/
  build-resume-pdf.mjs        # hackmyresume → puppeteer pipeline
  compile-bio.mjs             # builds bio-bundle.json for the chatbot
  sync-stats.mjs              # update:baseball — pull baseball from vault
  fetch-golf.mjs              # update:golf — pull GHIN → golf-raw.json
  update-league.mjs           # update:league — scrape sdabl1.info → league.json
  scrape-sdabl.mjs            # headless snapshot of a sdabl1.info division page
  parse-sdabl.mjs             # snapshot HTML → league.json
  sdabl-sources.json          # active season → sdabl1.info page_node_id
  gen-*.mjs                   # node-canvas pixel-art generators
src/
  _data/                      # site constants, cards, résumé, hobby JSON
    botty-quips.json          # quip bank (175+ weighted, predicate-keyed)
    dataUpdated.js            # YYYY-MM-DD of last stats commit (for footer)
    pkg.js                    # exposes package.json version (for footer)
  _includes/
    botty.njk                 # widget markup (sprite + bubble + panel + SVG face)
    footer.njk                # version + data-refresh date footer
  assets/css/botty.css
  assets/js/botty.js          # browser orchestrator (face loop, swim, quips)
  words/                      # markdown posts
  *.njk                       # 9 cards + resume-print + sitemap + redirect
tests/                        # node:test unit tests
vendor/                       # vendored npm packages
.github/workflows/
  update-stats.yml            # daily 6am UTC (GitHub-hosted): refresh baseball
  update-stats-local.yml      # daily 6:30am UTC (self-hosted): golf + league
  update-resume-pdf.yml       # on resume.json change: regen src/resume.pdf
  version-bump.yml            # on PR merge: read version:* labels, bump + tag
  release.yml                 # on tag push (or dispatch): create GH release
```

## Versioning + releases

PRs labelled `version:major` / `version:minor` / `version:patch` trigger
`version-bump.yml` on merge: it bumps `package.json`, prepends a
`CHANGELOG.md` entry, commits with `[skip ci]`, tags `vX.Y.Z`, then
explicitly dispatches `release.yml` to create the GitHub release with
auto-generated notes. The footer shows the current version (linked to its
release) plus `data YYYY-MM-DD` — the date of the most recent commit
touching the live stats files.
