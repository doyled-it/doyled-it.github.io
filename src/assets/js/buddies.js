import { chooseDirection, stepToward, pickRandom } from "./buddies-core.mjs";

const BUDDIES = [
  "oneko", "ace", "baseball", "black", "bunny", "calico",
  "esmeralda", "fox", "ghost", "golf-cart", "gray", "jess", "kina",
  "lucy", "maia", "maria", "mike", "silver", "silversky", "snuupy",
  "spirit", "tora", "valentine",
];
const STORAGE_KEY = "doyled_it_buddy";
const SPEED = 10;
const FOLLOW_DISTANCE = 48;
const TICK_MS = 100;
const ALERT_TICKS = 4;
const WOBBLE = 8;
const THRESHOLD_JITTER = 24;

async function loadManifest(name) {
  const res = await fetch(`/assets/sprites/${name}/manifest.json`);
  if (!res.ok) throw new Error(`manifest ${name} failed`);
  return res.json();
}

function getOrInitBuddy() {
  let chosen = null;
  try { chosen = localStorage.getItem(STORAGE_KEY); } catch {}
  if (!chosen || !BUDDIES.includes(chosen)) {
    chosen = pickRandom(BUDDIES);
    try { localStorage.setItem(STORAGE_KEY, chosen); } catch {}
  }
  return chosen;
}

function createSpriteElement(name, manifest) {
  const el = document.createElement("div");
  el.className = "buddy-sprite";
  el.setAttribute("aria-hidden", "true");
  Object.assign(el.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: `${manifest.frameSize}px`,
    height: `${manifest.frameSize}px`,
    backgroundImage: `url(/assets/sprites/${name}/${manifest.file})`,
    backgroundRepeat: "no-repeat",
    imageRendering: "pixelated",
    zIndex: "9999",
    pointerEvents: "none",
    transform: "translate(0px, 0px)",
    willChange: "transform",
  });
  document.body.appendChild(el);
  return el;
}

function setFrame(state, manifest, el) {
  const step = manifest.frameStep || manifest.frameSize;
  const frames = state.frames;
  let frameIdx = 0;
  const apply = () => {
    const [fx, fy] = frames[frameIdx % frames.length];
    el.style.backgroundPosition = `${fx * step}px ${fy * step}px`;
    frameIdx++;
  };
  apply();
  return setInterval(apply, state.frameDuration || 200);
}

let activeTickTimer = null;
let activeFrameTimer = null;
let activeSprite = null;
let idleTicks = 0;
let alertCountdown = 0;

function switchState(name, manifest, el) {
  if (!manifest.states[name]) return;
  clearInterval(activeFrameTimer);
  activeFrameTimer = setFrame(manifest.states[name], manifest, el);
}

async function startBuddy(name, startPos) {
  const manifest = await loadManifest(name);
  const el = createSpriteElement(name, manifest);
  activeSprite = el;

  let savedPos = null;
  try {
    const raw = sessionStorage.getItem("buddy_pos");
    if (raw) savedPos = JSON.parse(raw);
  } catch {}
  let pos = startPos || savedPos || { x: 32, y: 32 };
  let target = { x: pos.x, y: pos.y };
  let currentState = (startPos || savedPos) ? "idle" : "sleeping";
  let activeThreshold = FOLLOW_DISTANCE + (Math.random() - 0.5) * THRESHOLD_JITTER;
  idleTicks = (startPos || savedPos) ? 0 : 51;
  alertCountdown = 0;
  el.style.transform = `translate(${Math.round(pos.x - manifest.frameSize / 2)}px, ${Math.round(pos.y - manifest.frameSize / 2)}px)`;
  activeFrameTimer = setFrame(manifest.states[currentState] || manifest.states.idle, manifest, el);

  const onMouse = (e) => { target = { x: e.clientX, y: e.clientY }; };
  const onTouch = (e) => {
    const t = e.touches[0];
    if (t) target = { x: t.clientX, y: t.clientY };
  };
  document.addEventListener("mousemove", onMouse);
  document.addEventListener("touchmove", onTouch, { passive: true });

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function tick() {
    const dist = Math.hypot(target.x - pos.x, target.y - pos.y);

    // Close enough — idle, then sleep
    if (dist < activeThreshold) {
      if (currentState !== "idle" && currentState !== "sleeping") {
        activeThreshold = FOLLOW_DISTANCE + (Math.random() - 0.5) * THRESHOLD_JITTER;
        switchState("idle", manifest, el);
        currentState = "idle";
      }
      idleTicks++;
      alertCountdown = 0;
      if (idleTicks > 50 && manifest.states.sleeping && currentState !== "sleeping") {
        switchState("sleeping", manifest, el);
        currentState = "sleeping";
      }
      return;
    }

    // Waking up — play alert for a few ticks before chasing
    const wasResting = currentState === "idle" || currentState === "sleeping";
    if (wasResting && alertCountdown === 0 && manifest.states.alert) {
      activeThreshold = FOLLOW_DISTANCE + (Math.random() - 0.5) * THRESHOLD_JITTER;
      alertCountdown = ALERT_TICKS;
      switchState("alert", manifest, el);
      currentState = "alert";
    }
    if (alertCountdown > 0) {
      alertCountdown--;
      return;
    }

    idleTicks = 0;

    // Add wobble for organic movement
    const wobbleX = (Math.random() - 0.5) * WOBBLE * 2;
    const wobbleY = (Math.random() - 0.5) * WOBBLE * 2;
    const wobblyTarget = { x: target.x + wobbleX, y: target.y + wobbleY };

    pos = stepToward(pos, wobblyTarget, SPEED);
    el.style.transform = `translate(${Math.round(pos.x - manifest.frameSize / 2)}px, ${Math.round(pos.y - manifest.frameSize / 2)}px)`;

    const dir = chooseDirection(pos.x, pos.y, target.x, target.y);
    if (dir !== currentState && manifest.states[dir]) {
      switchState(dir, manifest, el);
      currentState = dir;
    }
  }

  function savePos() {
    try { sessionStorage.setItem("buddy_pos", JSON.stringify(pos)); } catch {}
  }

  if (!reducedMotion) {
    activeTickTimer = setInterval(() => { tick(); savePos(); }, TICK_MS);
  }
  window.addEventListener("beforeunload", savePos);
}

async function switchBuddy(name) {
  let oldPos = null;
  if (activeSprite) {
    const t = activeSprite.style.transform;
    const m = t.match(/translate\((-?\d+(?:\.\d+)?)px,\s*(-?\d+(?:\.\d+)?)px\)/);
    if (m) {
      oldPos = { x: parseFloat(m[1]) + 16, y: parseFloat(m[2]) + 16 };
    }
  }
  try { localStorage.setItem(STORAGE_KEY, name); } catch {}
  if (activeTickTimer) { clearInterval(activeTickTimer); activeTickTimer = null; }
  if (activeFrameTimer) { clearInterval(activeFrameTimer); activeFrameTimer = null; }
  document.querySelectorAll(".buddy-sprite").forEach((n) => n.remove());
  activeSprite = null;
  idleTicks = 0;
  alertCountdown = 0;
  await startBuddy(name, oldPos);
}

function getIdleBackgroundPosition(manifest) {
  const step = manifest.frameStep || manifest.frameSize;
  const idleState = manifest.states.idle;
  if (!idleState || !idleState.frames.length) return "0px 0px";
  const [fx, fy] = idleState.frames[0];
  return `${fx * step}px ${fy * step}px`;
}

async function buildGrid() {
  const grid = document.getElementById("buddy-grid");
  const toggleSprite = document.getElementById("buddy-toggle-sprite");
  const toggleName = document.getElementById("buddy-toggle-name");
  const popup = document.getElementById("buddy-grid-popup");
  const toggle = document.getElementById("buddy-toggle");

  if (!grid || !toggle) return;

  const current = getOrInitBuddy();

  for (const name of BUDDIES) {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "buddy-cell" + (name === current ? " buddy-cell--active" : "");
    cell.dataset.buddy = name;

    const sprite = document.createElement("span");
    sprite.className = "buddy-cell-sprite";

    const label = document.createElement("span");
    label.className = "buddy-cell-name";
    label.textContent = name;

    cell.appendChild(sprite);
    cell.appendChild(label);
    grid.appendChild(cell);

    loadManifest(name).then((manifest) => {
      const sheet = `/assets/sprites/${name}/${manifest.file}`;
      sprite.style.backgroundImage = `url(${sheet})`;
      sprite.style.backgroundPosition = getIdleBackgroundPosition(manifest);

      if (name === current) {
        toggleSprite.style.backgroundImage = `url(${sheet})`;
        toggleSprite.style.backgroundPosition = getIdleBackgroundPosition(manifest);
        toggleName.textContent = name;
      }
    }).catch(() => {});
  }

  toggle.addEventListener("click", () => {
    const isOpen = !popup.hidden;
    popup.hidden = isOpen;
  });

  grid.addEventListener("click", (e) => {
    const cell = e.target.closest("[data-buddy]");
    if (!cell) return;
    const name = cell.dataset.buddy;

    grid.querySelectorAll(".buddy-cell--active").forEach((c) => c.classList.remove("buddy-cell--active"));
    cell.classList.add("buddy-cell--active");

    loadManifest(name).then((manifest) => {
      const sheet = `/assets/sprites/${name}/${manifest.file}`;
      toggleSprite.style.backgroundImage = `url(${sheet})`;
      toggleSprite.style.backgroundPosition = getIdleBackgroundPosition(manifest);
      toggleName.textContent = name;
    }).catch(() => {});

    switchBuddy(name);
    popup.hidden = true;
  });

  document.addEventListener("click", (e) => {
    if (!popup.hidden && !e.target.closest("#buddy-selector")) {
      popup.hidden = true;
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !popup.hidden) {
      popup.hidden = true;
    }
  });
}

window.addEventListener("DOMContentLoaded", () => {
  const forced = document.body.dataset.forceBuddy;
  const initial = forced || getOrInitBuddy();
  startBuddy(initial).catch((err) => console.warn("buddy init failed", err));
  if (!forced) buildGrid();
});
