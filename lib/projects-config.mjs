// Curated structure for the projects page: which repos appear, in which themed
// section, with which sprite, in what order. `description` is an optional
// override; without it the live GitHub description (cached in
// src/_data/github-repos.json) is used. owner defaults to "doyled-it".
// Shared by src/_data/projects.js (render) and scripts/fetch-projects.mjs.

export const SECTIONS = [
  {
    title: "Tools & AI",
    sprite: "tools-ai",
    repos: [
      { repo: "agent-view" },
      { repo: "tutti" },
      { repo: "wavecrest" },
      { repo: "claude-skills" },
      { repo: "claude-vault-skills" },
      { repo: "excalidraw-skill" },
      { repo: "explain-codebase-skill" },
      { repo: "lawyer-brain", description: "RAG chatbot grounded in Five Four Podcast transcripts. FastAPI, LangChain and Chroma on the backend, React on the front." },
    ],
  },
  {
    title: "Obsidian",
    sprite: "obsidian",
    repos: [
      { repo: "obsidian-tag-filter", description: "Community plugin for filtering notes by tags." },
      { repo: "obsidian-plugin-dev-skill" },
      { repo: "obsidian-baseball", description: "My rec-league baseball stats tracked in Obsidian with Dataview. Hitting, fielding, pitching, calculated rates, game logs." },
    ],
  },
  {
    title: "Baseball",
    sprite: "baseball",
    repos: [
      { repo: "big-eiffel", description: "How likely was Ty France's 2025 NLDS ball to clear the fence it hit a cable in front of? Three estimates: empirical pooling, a drag-plus-Magnus physics model, and physics-informed quantile regression." },
      { repo: "umps-vs-players", description: "Data essay on MLB's first season of ABS challenges: do catchers read the strike zone better than umpires? Full season, 371,581 called pitches." },
      { repo: "sdabl-leaderboard", description: "A leaderboard site for the San Diego Adult Baseball League. Standings, stats, player rankings." },
      { repo: "dbags", description: "Homepage for Danny's Big Ass Glove softball team." },
    ],
  },
  {
    title: "Golf",
    sprite: "golf",
    repos: [
      { repo: "golf-stats", description: "Personal golf stats dashboard pulling from GHIN. Handicap, scoring trends, shot stats, course performance." },
      { repo: "practice-playbook", description: "A golf practice playbook site: structured drills and blocks built around what the stats say needs work." },
      { repo: "ghin", description: "Fork of an unofficial GHIN API wrapper, patched for current response quirks." },
    ],
  },
  {
    title: "Music & culture",
    sprite: "music",
    repos: [
      { repo: "codex.doyled-it.com", title: "Codex Galdr", url: "https://codex.doyled-it.com", description: "A side-by-side archive of Heilung's lyrics with translation, grounded annotation and per-album theming." },
      { repo: "theneedlepoint", description: "Visualizes data from The Needle Drop reviews.", extra: { label: "theneedlescrape", url: "https://github.com/doyled-it/theneedlescrape", before: "Companion scraper at" } },
      { repo: "like-to-discover", description: "Spotify app that archives every Discover Weekly like into a long-running playlist." },
      { repo: "ogham", description: "Transliterate text into ogham, drawn as SVG." },
    ],
  },
  {
    title: "Research / MITRE OSS",
    sprite: "janus",
    repos: [
      { owner: "janus-llm", repo: "janus-llm", description: "LLM-powered code modernization via chunking, iterative prompting and RAG." },
      { owner: "mitrefireline", repo: "simfire", description: "Open-source wildfire simulator for training reinforcement learning agents. Published at NeurIPS 2023." },
      { owner: "mitrefireline", repo: "simharness", description: "The RL training harness paired with SimFire. Agent training, reward shaping, experiment management." },
    ],
  },
  {
    title: "Web & data",
    sprite: "web-data",
    repos: [
      { repo: "doyled-it.github.io", title: "doyled-it.com", url: "https://doyled-it.com", description: "The one you're looking at. 11ty static build, Cloudflare Worker for the chat endpoint, pastel HyperCard aesthetic, cursor buddies, Last.fm integration." },
      { repo: "three-blueberries", title: "three-blueberries", url: "https://blueberries.doyled-it.com" },
      { repo: "ratchet", description: "The Body Fights Back, a data essay on weight, willpower and the biology of staying lean. One self-contained page, hand-built SVG charts." },
    ],
  },
];
