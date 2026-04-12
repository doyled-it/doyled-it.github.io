import { chooseDirection, stepToward, pickRandom } from "./buddies-core.mjs";

const BUDDIES = ["oneko", "ghost", "duck"];
const STORAGE_KEY = "doyled_it_buddy";
const SPEED = 10;

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

function animate(state, manifest, el) {
  const frames = state.frames;
  let frameIdx = 0;
  const apply = () => {
    const [fx, fy] = frames[frameIdx % frames.length];
    el.style.backgroundPosition = `${fx * manifest.frameSize}px ${fy * manifest.frameSize}px`;
    frameIdx++;
  };
  apply();
  return setInterval(apply, state.frameDuration || 200);
}

let activeTickTimer = null;
let activeFrameTimer = null;
let activeSprite = null;

async function startBuddy(name) {
  const manifest = await loadManifest(name);
  const el = createSpriteElement(name, manifest);
  activeSprite = el;

  let pos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  let target = { x: pos.x, y: pos.y };
  let currentState = "idle";
  activeFrameTimer = animate(manifest.states.idle, manifest, el);

  const onMouse = (e) => { target = { x: e.clientX, y: e.clientY }; };
  const onTouch = (e) => {
    const t = e.touches[0];
    if (t) target = { x: t.clientX, y: t.clientY };
  };
  document.addEventListener("mousemove", onMouse);
  document.addEventListener("touchmove", onTouch, { passive: true });

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function tick() {
    pos = stepToward(pos, target, SPEED);
    el.style.transform = `translate(${Math.round(pos.x - manifest.frameSize / 2)}px, ${Math.round(pos.y - manifest.frameSize / 2)}px)`;
    const dir = chooseDirection(pos.x, pos.y, target.x, target.y);
    if (dir !== currentState && manifest.states[dir]) {
      clearInterval(activeFrameTimer);
      activeFrameTimer = animate(manifest.states[dir], manifest, el);
      currentState = dir;
    }
  }

  if (!reducedMotion) {
    activeTickTimer = setInterval(tick, 60);
  }
}

async function switchBuddy(name) {
  try { localStorage.setItem(STORAGE_KEY, name); } catch {}
  if (activeTickTimer) { clearInterval(activeTickTimer); activeTickTimer = null; }
  if (activeFrameTimer) { clearInterval(activeFrameTimer); activeFrameTimer = null; }
  document.querySelectorAll(".buddy-sprite").forEach((n) => n.remove());
  activeSprite = null;
  await startBuddy(name);
}

function initPetsButton() {
  const btn = document.getElementById("pets-btn");
  if (!btn) return;
  btn.disabled = false;
  btn.removeAttribute("title");
  const current = localStorage.getItem(STORAGE_KEY) || BUDDIES[0];
  btn.textContent = `◆ pets — ${current}`;
  btn.addEventListener("click", () => {
    const cur = localStorage.getItem(STORAGE_KEY) || BUDDIES[0];
    const idx = BUDDIES.indexOf(cur);
    const next = BUDDIES[(idx + 1) % BUDDIES.length];
    switchBuddy(next);
    btn.textContent = `◆ pets — ${next}`;
  });
}

window.addEventListener("DOMContentLoaded", () => {
  const initial = getOrInitBuddy();
  startBuddy(initial).catch((err) => console.warn("buddy init failed", err));
  initPetsButton();
});
