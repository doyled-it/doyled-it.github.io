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
