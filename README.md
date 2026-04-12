# doyled-it.com

Personal site. Eleventy + pastel HyperCard aesthetic, cracktro landing, cursor
buddies, Last.fm music card. Full replacement of the prior al-folio Jekyll
site (preserved on branch `legacy/al-folio`).

## Develop

```sh
npm install
npm run dev    # http://localhost:8080
```

## Test

```sh
npm test
```

Unit tests cover résumé date filters, Last.fm caching, and cursor-buddy
direction logic.

## Build

```sh
npm run build
```

Produces `_site/` including:

- Static HTML for all 7 cards (home, about, résumé, projects, words, music, contact)
- `resume.pdf` built via HackMyResume + Puppeteer (uses the `jsonresume-theme-full-of-it` theme from a sibling directory)

A parallel "pastel-themed" PDF pipeline using a custom 11ty print template is
available via `npm run build:resume-pdf:new` for future iteration — it does
not yet match the legacy theme's quality.

## Music card (Last.fm)

The music card fetches recent + top tracks from Last.fm at build time. For
local builds with real data, set environment variables:

```sh
cp .env.example .env
# edit .env with your values
dotenv -e .env -- npm run build
```

Without credentials, the build succeeds and the card shows a helpful stub
message.

## Deploy

Pushes to `main` trigger `.github/workflows/deploy.yml`, which builds and
deploys to GitHub Pages.

### One-time setup

1. GitHub repo → **Settings → Pages → Source: GitHub Actions**.
2. GitHub repo → **Settings → Secrets and variables → Actions**, add:
   - `LASTFM_USER` — your Last.fm username
   - `LASTFM_API_KEY` — a key from <https://www.last.fm/api/account/create>
3. Custom domain: `CNAME` at repo root holds `doyled-it.com`. DNS already configured.

## Repository layout

```
.eleventy.js                          # 11ty config
lib/                                  # pure modules with unit tests
  lastfm-core.mjs
  resume-filters.mjs
scripts/
  build-resume-pdf.mjs                # hackmyresume → puppeteer pipeline
  build-resume-pdf-new.mjs            # future pastel-theme pipeline
src/
  _data/                              # site constants, cards, résumé, last.fm
  _includes/                          # base layout, card chassis, includes
  assets/
    css/                              # main, cracktro, resume-web, resume-print
    js/                               # buddies, keyboard-nav
    sprites/                          # oneko (canonical), ghost/duck (placeholders)
  words/                              # markdown posts
  *.njk                               # 7 cards + resume-print + sitemap
tests/                                # node:test unit tests
```
