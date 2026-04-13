(function () {
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const card = btn.closest(".card");
    if (!card) return;

    const action = btn.dataset.action;

    if (action === "minimize") {
      card.classList.add("minimized");
      setTimeout(() => {
        card.classList.remove("minimized");
      }, 1500);
    }

    if (action === "maximize") {
      card.classList.toggle("maximized");
    }

    if (action === "close") {
      // CRT close — implemented in Task 3
    }
  });
})();
