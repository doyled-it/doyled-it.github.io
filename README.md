# doyled-it.com

Personal site. Eleventy + pastel HyperCard aesthetic, cracktro landing,
cursor buddies, and per-hobby data cards (baseball, golf, music). Full
replacement of the prior al-folio Jekyll site (preserved on branch
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

- Static HTML for all 8 cards (home, résumé, projects, words, music,
  contact, baseball, golf)
- `resume.pdf` built via HackMyResume + Puppeteer using the
  `jsonresume-theme-full-of-it` theme (vendored at
  `vendor/jsonresume-theme-full-of-it/` so CI builds work without a
  sibling checkout)

A parallel "pastel-themed" PDF pipeline using a custom 11ty print template
is available via `npm run build:resume-pdf:new` — it does not yet match
the legacy theme's quality.

## Hobby data

### Music card (Last.fm)

The music card fetches recent + top tracks from Last.fm at build time.
For local builds with real data, copy the example env file and supply
credentials:

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

CI also refreshes the JSON weekly via `.github/workflows/update-stats.yml`,
which clones the source repos and commits any changes.

### Golf card

`src/_data/golf-raw.json` (raw GHIN payload) feeds `src/_data/golf.js`,
which derives stats, goals, and a view-model for the golf card. Refresh
GHIN data locally with:

```sh
# .env must contain GHIN_USERNAME + GHIN_PASSWORD
npm run fetch:golf
```

The fetch uses the `doyled-it/ghin` fork (pinned in `package.json`) which
tolerates GHIN's current response shape.

## Deploy

Pushes to `main` trigger `.github/workflows/deploy.yml`, which builds and
deploys to GitHub Pages.

### One-time setup

1. GitHub repo → **Settings → Pages → Source: GitHub Actions**.
2. GitHub repo → **Settings → Secrets and variables → Actions**, add:
   - `LASTFM_USER` — your Last.fm username
   - `LASTFM_API_KEY` — a key from <https://www.last.fm/api/account/create>
3. Custom domain: `CNAME` at repo root holds `doyled-it.com`. DNS already
   configured.

## Repository layout

```
.eleventy.js                          # 11ty config
lib/                                  # pure modules with unit tests
  lastfm-core.mjs
  resume-filters.mjs
  baseball-filters.mjs
scripts/
  build-resume-pdf.mjs                # hackmyresume → puppeteer pipeline
  build-resume-pdf-new.mjs            # future pastel-theme pipeline
  sync-stats.mjs                      # baseball stats from local vault
  fetch-golf.mjs                      # GHIN golf data → golf-raw.json
  gen-*.mjs                           # node-canvas pixel-art generators
  *-sdabl.mjs                         # historical baseball league importers
src/
  _data/                              # site constants, cards, résumé,
                                      #   last.fm, baseball, golf
  _includes/                          # base layout, titlebar, panels, footer
  assets/
    css/                              # main, cracktro, resume-web, resume-print
    js/                               # buddies, keyboard-nav, chiptune
    sprites/                          # oneko, baseball, golfcart, ghost, duck
    audio/                            # NSF chiptunes (played via nsf-player)
    fonts/
  words/                              # markdown posts
  *.njk                               # 8 cards + resume-print + sitemap
tests/                                # node:test unit tests
vendor/                               # vendored npm packages
```
