(function () {
  const tabs = document.querySelectorAll(".season-tab");
  const panels = document.querySelectorAll(".season-panel");
  if (tabs.length && panels.length) {
    function show(id) {
      tabs.forEach((t) => {
        const active = t.dataset.target === id;
        t.classList.toggle("is-active", active);
        t.setAttribute("aria-selected", active ? "true" : "false");
      });
      panels.forEach((p) => {
        const active = p.dataset.season === id;
        p.classList.toggle("is-active", active);
        if (active) p.removeAttribute("hidden");
        else p.setAttribute("hidden", "");
      });
    }
    tabs.forEach((t) => {
      t.addEventListener("click", () => {
        const id = t.dataset.target;
        show(id);
        history.replaceState(null, "", `#${id}`);
      });
    });
    const fromHash = location.hash.replace(/^#/, "");
    if (fromHash && document.querySelector(`.season-panel[data-season="${fromHash}"]`)) {
      show(fromHash);
    }
  }

  function toggleGame(row) {
    const detail = row.nextElementSibling;
    if (!detail || !detail.classList.contains("game-detail")) return;
    const open = detail.hasAttribute("hidden") === false;
    if (open) {
      detail.setAttribute("hidden", "");
      row.setAttribute("aria-expanded", "false");
      row.classList.remove("is-open");
    } else {
      detail.removeAttribute("hidden");
      row.setAttribute("aria-expanded", "true");
      row.classList.add("is-open");
    }
  }
  document.querySelectorAll("[data-toggle-game]").forEach((row) => {
    row.addEventListener("click", () => toggleGame(row));
    row.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        toggleGame(row);
      }
    });
  });

  // Playoff-history chart legend: click to toggle a team's line on/off.
  document.querySelectorAll("[data-chart-legend]").forEach((legend) => {
    const container = legend.closest(".league-block");
    if (!container) return;
    legend.addEventListener("click", (e) => {
      const btn = e.target.closest(".legend-item");
      if (!btn) return;
      const team = btn.dataset.team;
      const pressed = btn.getAttribute("aria-pressed") === "true";
      const next = !pressed;
      btn.setAttribute("aria-pressed", next ? "true" : "false");
      container
        .querySelectorAll(`.team-line[data-team="${CSS.escape(team)}"]`)
        .forEach((el) => el.classList.toggle("hidden", !next));
    });
  });
})();
