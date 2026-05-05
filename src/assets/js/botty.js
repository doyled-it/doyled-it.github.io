import { pickQuip } from "/lib/botty-quips.mjs";
import { createEngagement } from "/lib/botty-engagement.mjs";

const CONFIG = {
  triggerTimeMs: 4000,
  triggerMousePx: 250,
  triggerTimeMsMobile: 5000,
  burstEndAfterMs: 120000,
  bubbleAutoHideMs: 6000,
  qrArrivalDelayMs: 1000,
  prefetchQuip: true,
  fallbackOnly: false,
  invitePromptDelayMs: 22000,
};

const URL_OK = /^(https?:\/\/|\/|mailto:|tel:)/i;

let sessionToken = "";
let turnstileReady = null;

const els = {
  botty: document.getElementById("botty"),
  bubble: document.getElementById("botty-bubble"),
  sprite: document.getElementById("botty-sprite"),
  face: document.getElementById("botty-face"),
  panel: document.getElementById("botty-panel"),
  panelClose: document.getElementById("botty-panel-close"),
  panelLog: document.getElementById("botty-panel-log"),
  panelForm: document.getElementById("botty-panel-form"),
  panelInput: document.getElementById("botty-panel-input"),
  panelSend: document.getElementById("botty-panel-send"),
};

// Each expression names a variant per part-group. Anything omitted → that
// part stays hidden. Weight controls how often it's picked from the resting
// state; ms controls how long it's held before reverting to resting.
const EXPRESSIONS = {
  resting:  { weight: 0,  ms: 0,    parts: { eyes: "open" } },
  blink:    { weight: 18, ms: 140,  parts: { eyes: "closed" } },
  glanceL:  { weight: 6,  ms: 900,  parts: { eyes: "glance-l" } },
  glanceR:  { weight: 6,  ms: 900,  parts: { eyes: "glance-r" } },
  glanceUp: { weight: 4,  ms: 800,  parts: { eyes: "glance-up" } },
  smile:    { weight: 7,  ms: 1500, parts: { eyes: "open", mouth: "smile" } },
  bigSmile: { weight: 3,  ms: 1400, parts: { eyes: "closed", mouth: "big-smile" } },
  smirk:    { weight: 5,  ms: 1300, parts: { eyes: "open", mouth: "smirk", brows: "smug" } },
  surprise: { weight: 4,  ms: 700,  parts: { eyes: "big",  mouth: "oh", brows: "up" } },
  ooh:      { weight: 3,  ms: 800,  parts: { eyes: "big",  mouth: "ooh", brows: "up" } },
  winkL:    { weight: 4,  ms: 500,  parts: { eyes: "wink-l", mouth: "smile" } },
  winkR:    { weight: 4,  ms: 500,  parts: { eyes: "wink-r", mouth: "smile" } },
  browUp:   { weight: 5,  ms: 900,  parts: { eyes: "open", brows: "up" } },
  sleepy:   { weight: 3,  ms: 1600, parts: { eyes: "sleepy", mouth: "flat" } },
  zzz:      { weight: 1,  ms: 1800, parts: { eyes: "closed", mouth: "flat", accent: "zzz" } },
  frown:    { weight: 2,  ms: 1100, parts: { eyes: "open", mouth: "frown", brows: "worried" } },
  blush:    { weight: 2,  ms: 1700, parts: { eyes: "open", mouth: "smile", blush: "on" } },
  hearts:   { weight: 1,  ms: 1500, parts: { eyes: "hearts", mouth: "smile", blush: "on" } },
  cross:    { weight: 1,  ms: 900,  parts: { eyes: "cross", mouth: "zigzag" } },
  tongue:   { weight: 2,  ms: 1100, parts: { eyes: "wink-l", mouth: "tongue" } },
  sweat:    { weight: 2,  ms: 1100, parts: { eyes: "open", mouth: "flat", brows: "worried", accent: "sweat" } },
};

function applyFace(name) {
  const expr = EXPRESSIONS[name] || EXPRESSIONS.resting;
  const groups = els.face.querySelectorAll("g[data-part]");
  groups.forEach((g) => {
    const part = g.dataset.part;
    const variant = g.dataset.variant;
    g.style.display = expr.parts[part] === variant ? "block" : "none";
  });
}

function startFaceLoop() {
  applyFace("resting");
  const accents = Object.entries(EXPRESSIONS).filter(([k]) => k !== "resting");
  const totalWeight = accents.reduce((s, [, e]) => s + e.weight, 0);
  let lastPick = null;

  function pickAccent() {
    let r = Math.random() * totalWeight;
    for (const [name, expr] of accents) {
      r -= expr.weight;
      if (r <= 0 && name !== lastPick) { lastPick = name; return [name, expr]; }
    }
    const [name, expr] = accents[accents.length - 1];
    lastPick = name;
    return [name, expr];
  }

  function schedule() {
    // Stay resting for a random idle stretch — feels alive, not metronomic.
    const idleMs = 2200 + Math.random() * 4200;
    setTimeout(() => {
      const [, expr] = pickAccent();
      applyFace(Object.keys(EXPRESSIONS).find((k) => EXPRESSIONS[k] === expr));
      setTimeout(() => { applyFace("resting"); schedule(); }, expr.ms);
    }, idleMs);
  }
  schedule();
}

const PAGE_INVITES = {
  "/":          "want to know more about michael? ask me a question.",
  "/baseball/": "curious how michael's been hitting this season? ask me.",
  "/golf/":     "want to know what michael's handicap is doing? go on, ask.",
  "/music/":    "want a peek at what michael's been spinning lately? ask me.",
  "/words/":    "looking for a specific post? i can point you at the right one.",
  "/projects/": "want context on what michael's built? ask away.",
  "/resume/":   "questions about michael's experience? ask me.",
  "/contact/":  "trying to reach michael? i can help with that — ask.",
  "/movies/":   "want to know what michael's been watching lately? ask me.",
};

function inviteForPath(pathname) {
  if (PAGE_INVITES[pathname]) return PAGE_INVITES[pathname];
  // Match by prefix (e.g. /words/some-post/) — fall back to homepage line.
  for (const key of Object.keys(PAGE_INVITES)) {
    if (key !== "/" && pathname.startsWith(key)) return PAGE_INVITES[key];
  }
  return PAGE_INVITES["/"];
}

if (!els.botty) {
  console.warn("botty: markup not found, skipping init");
} else {
  init();
}

async function init() {
  const params = new URLSearchParams(location.search);
  const isQr = params.get("via") === "card";
  const isMobile = isMobileLike();

  const cfg = {
    ...CONFIG,
    triggerTimeMs: isMobile ? CONFIG.triggerTimeMsMobile : CONFIG.triggerTimeMs,
    qrBypass: isQr,
  };

  const signals = collectSignals(isQr, isMobile, params);
  trackSessionPath();

  // If botty already showed up earlier in this session, reveal the sprite
  // right away on subsequent navigations — no second wait-for-engagement.
  let alreadyRevealed = false;
  try { alreadyRevealed = sessionStorage.getItem("dit.botty_revealed") === "1"; } catch (_) {}
  if (alreadyRevealed) revealSprite();

  // Mint a session via invisible Turnstile before any LLM call. If
  // Turnstile is unavailable (script blocked, key missing, solve fails),
  // turnstileReady never resolves with a token and we silently fall back
  // to the canned bank — chat sends will surface an error.
  turnstileReady = ensureTurnstileToken(els.botty.dataset.turnstileSiteKey);

  let quipPromise = null;
  if (CONFIG.prefetchQuip && !CONFIG.fallbackOnly) {
    quipPromise = fetchQuip(signals).catch(() => null);
  }

  const engagement = createEngagement(cfg, { now: 0 });
  const startedAt = performance.now();

  document.addEventListener("mousemove", (e) => {
    engagement.recordMouseMovement(Math.abs(e.movementX) + Math.abs(e.movementY));
  });
  ["scroll", "click", "keydown", "touchstart"].forEach((ev) =>
    document.addEventListener(ev, () => engagement.recordActivity(performance.now() - startedAt))
  );

  setInterval(async () => {
    engagement.tick(performance.now() - startedAt);
    if (engagement.shouldFire()) {
      engagement.markFired(performance.now() - startedAt);
      const quipText = await resolveQuip(quipPromise, signals);
      showBubble(quipText, isQr);
      quipPromise = CONFIG.fallbackOnly ? null : fetchQuip(signals).catch(() => null);
    }
  }, 750);

  startFaceLoop();

  // After a longer dwell, push a curated, page-specific invite — but only
  // once per session (don't badger across pageviews) and not if the user
  // has already opened the panel.
  let invited = false;
  try { invited = sessionStorage.getItem("dit.botty_invited") === "1"; } catch (_) {}
  if (!invited) {
    setTimeout(() => {
      if (panelEverOpened) return;
      const text = inviteForPath(location.pathname);
      showBubble(text, true);
      try { sessionStorage.setItem("dit.botty_invited", "1"); } catch (_) {}
    }, CONFIG.invitePromptDelayMs);
  }

  els.sprite.addEventListener("click", openPanel);
  els.panelClose.addEventListener("click", closePanel);
  els.panelForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const msg = els.panelInput.value.trim();
    if (!msg) return;
    els.panelInput.value = "";
    sendChat(msg);
  });
}

function isMobileLike() {
  if (navigator.userAgentData?.mobile) return true;
  return window.matchMedia("(max-width: 540px)").matches;
}

function trackSessionPath() {
  try {
    const key = "dit.session_paths";
    const list = JSON.parse(sessionStorage.getItem(key) || "[]");
    if (list[list.length - 1] !== location.pathname) {
      list.push(location.pathname);
      sessionStorage.setItem(key, JSON.stringify(list.slice(-10)));
    }
  } catch (_) {}
}

function collectSignals(isQr, isMobile, params) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  const tzHour = parseInt(
    new Date().toLocaleTimeString("en-US", { hour: "numeric", hour12: false, timeZone: tz }),
    10,
  );
  let visitCount = 0;
  let returning = false;
  try {
    const stored = parseInt(localStorage.getItem("dit.visit_count") || "0", 10);
    const sessionCounted = sessionStorage.getItem("dit.session_seen") === "1";
    if (sessionCounted) {
      visitCount = Number.isFinite(stored) && stored > 0 ? stored : 1;
    } else {
      visitCount = (Number.isFinite(stored) ? stored : 0) + 1;
      localStorage.setItem("dit.visit_count", String(visitCount));
      sessionStorage.setItem("dit.session_seen", "1");
    }
    returning = visitCount > 1;
    localStorage.setItem("dit.visited", "1");
  } catch (_) {}
  let sessionPaths = [];
  try {
    sessionPaths = JSON.parse(sessionStorage.getItem("dit.session_paths") || "[]");
  } catch (_) {}

  let refererHost = "";
  try {
    refererHost = document.referrer ? new URL(document.referrer).host : "";
  } catch (_) {}

  return {
    via: isQr ? "card" : null,
    path: location.pathname,
    referer: document.referrer || "",
    referer_host: refererHost,
    lang: navigator.language || "",
    tz,
    tz_hour: Number.isFinite(tzHour) ? tzHour : 0,
    ua_platform: navigator.userAgentData?.platform || navigator.platform || "",
    ua_browser: detectBrowser(),
    mobile: isMobile,
    returning,
    visit_count: visitCount,
    session_paths: sessionPaths,
  };
}

function detectBrowser() {
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return "Edge";
  if (/Firefox\//.test(ua)) return "Firefox";
  if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) return "Chrome";
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return "Safari";
  return "Other";
}

// Load Turnstile, render invisibly, return the solve token. Resolves null
// if the script can't load or the widget can't solve in time — callers
// must handle that as "skip the LLM, fall back to canned bank."
function ensureTurnstileToken(siteKey, timeoutMs = 8000) {
  if (!siteKey) return Promise.resolve(null);
  return new Promise((resolve) => {
    let resolved = false;
    const finish = (token) => {
      if (resolved) return;
      resolved = true;
      resolve(token);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);

    const render = () => {
      if (!window.turnstile) return finish(null);
      try {
        window.turnstile.render("#botty-turnstile", {
          sitekey: siteKey,
          appearance: "interaction-only",
          callback: (t) => { clearTimeout(timer); finish(t); },
          "error-callback": () => { clearTimeout(timer); finish(null); },
          "timeout-callback": () => { clearTimeout(timer); finish(null); },
        });
      } catch (_) { clearTimeout(timer); finish(null); }
    };

    if (window.turnstile) {
      render();
      return;
    }
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    s.async = true;
    s.defer = true;
    s.onload = render;
    s.onerror = () => { clearTimeout(timer); finish(null); };
    document.head.appendChild(s);
  });
}

async function authBody(extra) {
  const body = { ...extra };
  if (sessionToken) {
    body.sessionToken = sessionToken;
    return body;
  }
  const token = await turnstileReady;
  if (token) body.turnstileToken = token;
  return body;
}

async function fetchQuip(signals) {
  const body = await authBody({ mode: "quip", signals });
  if (!body.sessionToken && !body.turnstileToken) throw new Error("no auth");
  const resp = await fetch("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) throw new Error("quip http " + resp.status);
  const data = await resp.json();
  if (data.sessionToken) sessionToken = data.sessionToken;
  return data.reply || "";
}

async function resolveQuip(promise, signals) {
  if (!promise) return fallbackQuip(signals);
  try {
    const text = await Promise.race([
      promise,
      new Promise((_, rej) => setTimeout(() => rej(new Error("quip timeout")), 3000)),
    ]);
    if (typeof text === "string" && text.trim()) return text.trim();
  } catch (_) {}
  return fallbackQuip(signals);
}

let _fallbackBank = null;
async function fallbackQuip(signals) {
  if (!_fallbackBank) {
    try {
      const resp = await fetch("/botty-quips.json");
      _fallbackBank = await resp.json();
    } catch (_) {
      _fallbackBank = [{ trigger: "*", template: "hey." }];
    }
  }
  const picked = pickQuip(_fallbackBank, signals);
  return picked ? picked.text : "hey.";
}

function revealSprite() {
  els.botty.dataset.state = "shown";
  els.botty.setAttribute("aria-hidden", "false");
  try { sessionStorage.setItem("dit.botty_revealed", "1"); } catch (_) {}
}

function showBubble(text, sticky) {
  revealSprite();
  els.bubble.textContent = text;
  els.bubble.hidden = false;
  if (!sticky && CONFIG.bubbleAutoHideMs > 0) {
    setTimeout(() => { els.bubble.hidden = true; }, CONFIG.bubbleAutoHideMs);
  }
}

let panelEverOpened = false;
function openPanel() {
  panelEverOpened = true;
  els.panel.hidden = false;
  els.bubble.hidden = true;
  els.panelInput.focus();
  try { sessionStorage.setItem("dit.botty_invited", "1"); } catch (_) {}
}
function closePanel() {
  els.panel.hidden = true;
}

function appendInlineMarkdown(parent, text) {
  const re = /\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0, m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parent.appendChild(document.createTextNode(text.slice(last, m.index)));
    if (URL_OK.test(m[2])) {
      const a = document.createElement("a");
      a.href = m[2];
      a.textContent = m[1];
      if (/^https?:\/\//i.test(m[2])) { a.target = "_blank"; a.rel = "noopener noreferrer"; }
      parent.appendChild(a);
    } else {
      parent.appendChild(document.createTextNode(m[0]));
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) parent.appendChild(document.createTextNode(text.slice(last)));
}

function appendMsg(kind, text) {
  const p = document.createElement("p");
  p.className = "msg " + kind;
  const who = document.createElement("span");
  who.className = "who";
  who.textContent = kind === "you" ? "you>" : kind === "bot" ? "bot>" : "err>";
  p.appendChild(who);
  if (kind === "bot") appendInlineMarkdown(p, text);
  else p.appendChild(document.createTextNode(text));
  els.panelLog.appendChild(p);
  els.panelLog.scrollTop = els.panelLog.scrollHeight;
  return p;
}

async function sendChat(message) {
  appendMsg("you", message);
  const placeholder = appendMsg("bot", "thinking…");
  els.panelSend.disabled = true;
  els.panelInput.disabled = true;
  try {
    const body = await authBody({ mode: "chat", message });
    if (!body.sessionToken && !body.turnstileToken) {
      placeholder.remove();
      appendMsg("err", "couldn't verify the browser — refresh and try again");
      return;
    }
    const resp = await fetch("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      placeholder.remove();
      appendMsg("err", data.error || ("request failed (" + resp.status + ")"));
      return;
    }
    if (data.sessionToken) sessionToken = data.sessionToken;
    placeholder.remove();
    appendMsg("bot", (data.reply || "").trim() || "(no reply)");
  } catch (_) {
    placeholder.remove();
    appendMsg("err", "network error — try again in a sec");
  } finally {
    els.panelSend.disabled = false;
    els.panelInput.disabled = false;
    els.panelInput.focus();
  }
}
