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
};

const URL_OK = /^(https?:\/\/|\/|mailto:|tel:)/i;

const els = {
  botty: document.getElementById("botty"),
  bubble: document.getElementById("botty-bubble"),
  sprite: document.getElementById("botty-sprite"),
  panel: document.getElementById("botty-panel"),
  panelClose: document.getElementById("botty-panel-close"),
  panelLog: document.getElementById("botty-panel-log"),
  panelForm: document.getElementById("botty-panel-form"),
  panelInput: document.getElementById("botty-panel-input"),
  panelSend: document.getElementById("botty-panel-send"),
};

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
    const raw = parseInt(localStorage.getItem("dit.visit_count") || "0", 10);
    visitCount = Number.isFinite(raw) ? raw + 1 : 1;
    returning = visitCount > 1;
    localStorage.setItem("dit.visit_count", String(visitCount));
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

let sessionToken = "";
async function fetchQuip(signals) {
  const resp = await fetch("/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ mode: "quip", signals, sessionToken: sessionToken || undefined }),
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
      new Promise((_, rej) => setTimeout(() => rej(new Error("quip timeout")), 1500)),
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

function showBubble(text, sticky) {
  els.botty.dataset.state = "shown";
  els.botty.setAttribute("aria-hidden", "false");
  els.bubble.textContent = text;
  els.bubble.hidden = false;
  if (!sticky && CONFIG.bubbleAutoHideMs > 0) {
    setTimeout(() => { els.bubble.hidden = true; }, CONFIG.bubbleAutoHideMs);
  }
}

function openPanel() {
  els.panel.hidden = false;
  els.panelInput.focus();
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
    const body = { mode: "chat", message };
    if (sessionToken) body.sessionToken = sessionToken;
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
