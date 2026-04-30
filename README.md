# doyled-it.com

Personal site. Eleventy 3 (11ty) static build wrapped in a Cloudflare
Worker. Pastel HyperCard / cracktro aesthetic, cursor buddies, per-hobby
data cards (baseball, golf, music), and a `/card` chat endpoint backed by
Claude. Replaces the prior al-folio Jekyll site (preserved on
`legacy/al-folio`).

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
  contact, baseball, golf, card)
- 8 short-URL redirect stubs (`/m`, `/cal`, `/gh`, `/p`, `/li`, `/s`,
  `/c`, `/w`) for the printed business card QR codes
- `resume.pdf` — copied from the committed `src/resume.pdf` (regenerated
  on `resume.json` changes via the `update-resume-pdf` workflow)

For static-only iteration, `npm run build:eleventy` skips the resume PDF.

## Hosting

Cloudflare Workers, configured by `wrangler.toml`. Pushing to `main`
triggers the CF GitHub integration → it runs `npm run build:eleventy`
then `npx wrangler deploy`. The Worker:

- Serves `_site/` as static assets via the `ASSETS` binding
- Routes `POST /card/chat` through `worker/index.js` to Claude

The `/card` chatbot uses Cloudflare Turnstile + a per-IP daily rate limit
backed by a Workers KV namespace.

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

### Baseball card

`src/_data/baseball.json` and `league.json` drive the baseball card
(season stats, career analytics, playoff brackets, league context).
Refresh from a local Obsidian vault with:

```sh
npm run sync:stats
```

CI also refreshes the JSON weekly via `.github/workflows/update-stats.yml`.

### Golf card

`src/_data/golf-raw.json` (raw GHIN payload) feeds `src/_data/golf.js`,
which derives stats, goals, and a view-model. Refresh GHIN data locally:

```sh
# .env must contain GHIN_USERNAME + GHIN_PASSWORD
npm run fetch:golf
```

The fetch uses the `doyled-it/ghin` fork (pinned in `package.json`) which
tolerates GHIN's current response shape.

## /card chatbot

A chat UI at `/card` that answers questions about Michael — work, hobbies,
publications, recent GitHub activity, listening habits. Strictly scoped:
refuses off-topic questions and prompt-injection attempts, redirects to
email for anything substantive.

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

## Repository layout

```
.eleventy.js                  # 11ty config
wrangler.toml                 # Cloudflare Worker config
worker/
  index.js                    # Worker entrypoint (POST /card/chat)
lib/                          # pure modules with unit tests
  lastfm-core.mjs             # rich Last.fm fetch + derivations
  apple-music.mjs             # iTunes Search → Apple Music URL resolver
  baseball-filters.mjs
  golf-transform.mjs
  resume-filters.mjs
scripts/
  build-resume-pdf.mjs        # hackmyresume → puppeteer pipeline
  compile-bio.mjs             # builds bio-bundle.json for the chatbot
  sync-stats.mjs              # baseball stats from local vault
  fetch-golf.mjs              # GHIN golf data → golf-raw.json
  gen-*.mjs                   # node-canvas pixel-art generators
src/
  _data/                      # site constants, cards, résumé, hobby JSON
  _includes/                  # base layout, titlebar, panels, footer
  assets/                     # css, js, fonts, sprites, audio
  words/                      # markdown posts
  *.njk                       # 9 cards + resume-print + sitemap + redirect
tests/                        # node:test unit tests
vendor/                       # vendored npm packages
```
