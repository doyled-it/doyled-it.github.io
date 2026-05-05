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
  spontaneousMinMs: 70000,
  spontaneousMaxMs: 180000,
};

const URL_OK = /^(https?:\/\/|\/|mailto:|tel:)/i;

let sessionToken = "";
let turnstileReady = null;

const els = {
  botty: document.getElementById("botty"),
  bubble: document.getElementById("botty-bubble"),
  bubbleText: document.getElementById("botty-bubble-text"),
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
  blink:    { weight: 18, ms: 180,  parts: { eyes: "closed" } },
  glanceL:  { weight: 6,  ms: 2400, parts: { eyes: "glance-l" } },
  glanceR:  { weight: 6,  ms: 2400, parts: { eyes: "glance-r" } },
  glanceUp: { weight: 4,  ms: 2000, parts: { eyes: "glance-up" } },
  smile:    { weight: 7,  ms: 4200, parts: { eyes: "open", mouth: "smile" } },
  bigSmile: { weight: 3,  ms: 3600, parts: { eyes: "closed", mouth: "big-smile" } },
  smirk:    { weight: 5,  ms: 3600, parts: { eyes: "open", mouth: "smirk", brows: "smug" } },
  surprise: { weight: 4,  ms: 1800, parts: { eyes: "big",  mouth: "oh", brows: "up" } },
  ooh:      { weight: 3,  ms: 2200, parts: { eyes: "big",  mouth: "ooh", brows: "up" } },
  winkL:    { weight: 4,  ms: 1400, parts: { eyes: "wink-l", mouth: "smile" } },
  winkR:    { weight: 4,  ms: 1400, parts: { eyes: "wink-r", mouth: "smile" } },
  browUp:   { weight: 5,  ms: 2600, parts: { eyes: "open", brows: "up" } },
  sleepy:   { weight: 3,  ms: 4000, parts: { eyes: "sleepy", mouth: "flat" } },
  zzz:      { weight: 1,  ms: 4400, parts: { eyes: "closed", mouth: "flat", accent: "zzz" } },
  frown:    { weight: 2,  ms: 2800, parts: { eyes: "open", mouth: "frown", brows: "worried" } },
  blush:    { weight: 2,  ms: 4200, parts: { eyes: "open", mouth: "smile", blush: "on" } },
  hearts:   { weight: 1,  ms: 3800, parts: { eyes: "hearts", mouth: "smile", blush: "on" } },
  cross:    { weight: 1,  ms: 2400, parts: { eyes: "cross", mouth: "zigzag" } },
  tongue:   { weight: 2,  ms: 2800, parts: { eyes: "wink-l", mouth: "tongue" } },
  sweat:    { weight: 2,  ms: 2800, parts: { eyes: "open", mouth: "flat", brows: "worried", accent: "sweat" } },
};

// Anything an expression doesn't override falls back to these neutrals so
// botty never ends up mouthless / browless when we forget to name a part.
const FACE_DEFAULTS = { eyes: "open", mouth: "flat", brows: null, blush: null, accent: null };

function applyFace(name) {
  const expr = EXPRESSIONS[name] || EXPRESSIONS.resting;
  const parts = { ...FACE_DEFAULTS, ...expr.parts };
  els.face.querySelectorAll("g[data-part]").forEach((g) => {
    const part = g.dataset.part;
    const variant = g.dataset.variant;
    g.style.display = parts[part] === variant ? "block" : "none";
  });
}

// Slow random drift of the face inside the body. Picks a fresh random
// target every 4-9s and eases toward it — never repeating, never landing
// on the same spot, no perceptible periodicity.
function startFaceSwim() {
  const DRIFT_PX = 7;
  const STEP_MIN_MS = 4000;
  const STEP_MAX_MS = 9000;
  const EASE = 0.018; // small = slow approach
  let cx = 0, cy = 0, tx = 0, ty = 0;
  let nextChangeAt = 0;

  function frame(t) {
    if (t >= nextChangeAt) {
      tx = (Math.random() * 2 - 1) * DRIFT_PX;
      ty = (Math.random() * 2 - 1) * DRIFT_PX;
      nextChangeAt = t + STEP_MIN_MS + Math.random() * (STEP_MAX_MS - STEP_MIN_MS);
    }
    cx += (tx - cx) * EASE;
    cy += (ty - cy) * EASE;
    els.face.style.transform = `translate(${cx.toFixed(2)}px, ${cy.toFixed(2)}px)`;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
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
    const idleMs = 3500 + Math.random() * 5500;
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

// Periodic spontaneous quips from the local bank — bounded random window,
// suppressed while the panel is open or while a bubble is already up.
function startSpontaneousQuips(signals) {
  function schedule() {
    const span = CONFIG.spontaneousMaxMs - CONFIG.spontaneousMinMs;
    const wait = CONFIG.spontaneousMinMs + Math.random() * span;
    setTimeout(async () => {
      if (panelEverOpened && !els.panel.hidden) { schedule(); return; }
      if (!els.bubble.hidden) { schedule(); return; }
      const text = await fallbackQuip(signals);
      if (text) showBubble(text, false);
      schedule();
    }, wait);
  }
  schedule();
}

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
  enrichSignalsAsync(signals, isMobile);

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
  startFaceSwim();
  startSpontaneousQuips(signals);

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

  const uaPlatform = navigator.userAgentData?.platform || navigator.platform || "";
  const isMac = /Mac/i.test(uaPlatform);
  const conn = navigator.connection || {};
  const screenAspect = screen && screen.width && screen.height
    ? screen.width / screen.height
    : null;
  let reloadCount = 0;
  try {
    reloadCount = parseInt(sessionStorage.getItem("dit.reload_count") || "0", 10) || 0;
    const navType = performance.getEntriesByType?.("navigation")?.[0]?.type;
    if (navType === "reload") sessionStorage.setItem("dit.reload_count", String(reloadCount + 1));
  } catch (_) {}
  const tzLang = (navigator.language || "").slice(0, 2).toLowerCase();
  const tzCountryGuess = tz.split("/")[0]; // crude — "America", "Asia", "Europe"
  const tzMismatch = !!tzLang && !!tzCountryGuess && (
    (tzLang === "en" && /Asia|Africa/.test(tzCountryGuess)) ||
    (tzLang === "ja" && tzCountryGuess !== "Asia") ||
    (tzLang === "de" && tzCountryGuess !== "Europe") ||
    (tzLang === "fr" && tzCountryGuess !== "Europe" && tzCountryGuess !== "Africa")
  );

  return {
    via: isQr ? "card" : null,
    path: location.pathname,
    referer: document.referrer || "",
    referer_host: refererHost,
    lang: navigator.language || "",
    tz,
    tz_hour: Number.isFinite(tzHour) ? tzHour : 0,
    tz_lang_mismatch: tzMismatch,
    ua_platform: uaPlatform,
    ua_browser: detectBrowser(),
    mac_chip: isMac && !isMobile ? detectMacChip() : null,
    mobile: isMobile,
    returning,
    visit_count: visitCount,
    session_paths: sessionPaths,
    // New "cool" signals — battery resolves async and gets patched in later.
    cores: navigator.hardwareConcurrency || null,
    ram_gb: navigator.deviceMemory || null,
    conn_type: conn.effectiveType || null,
    save_data: !!conn.saveData,
    downlink_mbps: typeof conn.downlink === "number" ? conn.downlink : null,
    dpr: window.devicePixelRatio || 1,
    screen_w: screen?.width || null,
    screen_h: screen?.height || null,
    screen_aspect: screenAspect,
    ultrawide: screenAspect ? screenAspect >= 2.3 : false,
    vertical_monitor: screenAspect ? screenAspect < 0.85 : false,
    high_refresh: false, // patched after rAF probe
    dark_mode: window.matchMedia?.("(prefers-color-scheme: dark)").matches || false,
    reduced_motion: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || false,
    standalone_pwa: window.matchMedia?.("(display-mode: standalone)").matches
      || window.navigator.standalone === true,
    touch_capable: navigator.maxTouchPoints > 0,
    touch_on_desktop: !isMobile && navigator.maxTouchPoints > 0,
    webgpu: "gpu" in navigator,
    gpc: !!navigator.globalPrivacyControl,
    dnt: navigator.doNotTrack === "1" || window.doNotTrack === "1",
    nav_type: performance.getEntriesByType?.("navigation")?.[0]?.type || null,
    reload_count: reloadCount,
    storage_quota_gb: null, // patched after async storage estimate
    battery_level: null,    // 0..1, patched after navigator.getBattery()
    battery_charging: null, // patched
  };
}

// Mutate the signals object in place as async values resolve. Safe because
// fallbackQuip / pickQuip read it fresh on each fire — once a signal fills
// in, future quips can match on it.
function enrichSignalsAsync(signals, isMobile) {
  if (typeof navigator.getBattery === "function") {
    navigator.getBattery().then((b) => {
      signals.battery_level = b.level;
      signals.battery_charging = b.charging;
      b.addEventListener?.("levelchange", () => { signals.battery_level = b.level; });
      b.addEventListener?.("chargingchange", () => { signals.battery_charging = b.charging; });
    }).catch(() => {});
  }
  if (navigator.storage?.estimate) {
    navigator.storage.estimate().then((est) => {
      if (typeof est.quota === "number") signals.storage_quota_gb = Math.round(est.quota / 1e9);
    }).catch(() => {});
  }
  if (!isMobile) probeHighRefresh(signals);
}

// Sample a few requestAnimationFrame deltas; if median < ~12ms, the panel
// is rendering at >80Hz. Cheap, runs once.
function probeHighRefresh(signals) {
  const deltas = [];
  let last = 0, count = 0;
  function tick(t) {
    if (last) deltas.push(t - last);
    last = t;
    count++;
    if (count < 16) requestAnimationFrame(tick);
    else {
      const sorted = [...deltas].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      signals.high_refresh = median < 12;
    }
  }
  requestAnimationFrame(tick);
}

// Best-effort Apple Silicon vs Intel detection via the WebGL renderer
// string. Apple Silicon Macs report "Apple M1/M2/.." or "Apple GPU";
// Intel Macs report Intel/AMD/etc. Returns null if unknown — Firefox and
// some Safari versions strip the renderer for fingerprinting protection.
function detectMacChip() {
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (!gl) return null;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "";
    if (!renderer) return null;
    if (/Apple M\d|Apple GPU/i.test(renderer)) return "apple_silicon";
    if (/Intel|AMD|Radeon/i.test(renderer)) return "intel";
    return null;
  } catch (_) { return null; }
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
  els.bubbleText.textContent = text;
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
