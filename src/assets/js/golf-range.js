// Club tabs for the range deep dive on the golf page.
(function () {
  const tabs = document.querySelectorAll(".range-tab");
  const panels = document.querySelectorAll(".range-panel");
  if (!tabs.length || !panels.length) return;
  function show(id) {
    tabs.forEach((t) => {
      const active = t.dataset.target === id;
      t.classList.toggle("is-active", active);
      t.setAttribute("aria-selected", active ? "true" : "false");
    });
    panels.forEach((p) => {
      const active = p.dataset.club === id;
      p.classList.toggle("is-active", active);
      if (active) p.removeAttribute("hidden");
      else p.setAttribute("hidden", "");
    });
  }
  tabs.forEach((t) => t.addEventListener("click", () => show(t.dataset.target)));
})();

// Green-hitting odds: Monte Carlo over each club's (blended) spread.
(function () {
  const dataEl = document.getElementById("odds-data");
  const out = document.getElementById("odds-out");
  if (!dataEl || !out) return;
  const { clubs } = JSON.parse(dataEl.textContent);
  const dist = document.getElementById("odds-dist");
  const distOut = document.getElementById("odds-dist-out");
  const green = document.getElementById("odds-green");
  const bias = document.getElementById("odds-bias");

  // One fixed set of standard-normal pairs (seeded), reused for every club so
  // the numbers don't jitter as the slider moves.
  const N = 4000;
  let seed = 20261012;
  const rand = () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const zs = [];
  for (let i = 0; i < N; i++) {
    const u1 = rand() || 1e-12;
    const u2 = rand();
    const r = Math.sqrt(-2 * Math.log(u1));
    zs.push([r * Math.cos(2 * Math.PI * u2), r * Math.sin(2 * Math.PI * u2)]);
  }

  function odds(c, d, w, h, withBias) {
    const a = w / 2;
    const b = h / 2;
    const mx = withBias ? c.side : 0;
    let hits = 0;
    for (const [z1, z2] of zs) {
      const x = mx + z1 * c.sideSd;
      const y = c.carry + z2 * c.carrySd - d;
      if ((x * x) / (a * a) + (y * y) / (b * b) <= 1) hits++;
    }
    return (hits / N) * (1 - c.mishitRate);
  }

  function render() {
    const d = Number(dist.value);
    const [w, h] = green.value.split(",").map(Number);
    distOut.textContent = d;
    const rows = clubs
      .map((c) => ({ c, p: odds(c, d, w, h, bias.checked) }))
      .filter((r) => Math.abs(r.c.carry - d) <= 35 || r.p >= 0.05);
    if (!rows.length) {
      out.innerHTML = '<p class="range-note">No club in the bag carries close to that distance.</p>';
      return;
    }
    const best = Math.max(...rows.map((r) => r.p));
    out.innerHTML = rows
      .map(({ c, p }) => {
        const pct = Math.round(p * 100);
        const top = p === best && p > 0;
        return `<div class="odds-row${top ? " is-best" : ""}">
          <span class="odds-club"><span class="club-dot" style="background:${c.color}"></span>${c.code || c.club}</span>
          <span class="odds-track"><span class="odds-fill" style="width:${pct}%;background:${c.color}"></span></span>
          <span class="odds-pct">${pct}%${top ? " ★" : ""}</span>
          <span class="odds-meta">avg ${c.carry} ± ${c.carrySd}</span>
        </div>`;
      })
      .join("");
  }
  [dist, green, bias].forEach((el) => el.addEventListener("input", render));
  bias.addEventListener("change", render);
  render();
})();
