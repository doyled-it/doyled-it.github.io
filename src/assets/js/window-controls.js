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
      crtOff(card);
    }
  });

  function crtOff(card) {
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      sessionStorage.setItem("crt_boot", "1");
      window.location.href = "/";
      return;
    }

    card.classList.add("crt-off");
    card.addEventListener("animationend", () => {
      const overlay = document.createElement("div");
      overlay.className = "crt-overlay";
      document.body.appendChild(overlay);

      sessionStorage.setItem("crt_boot", "1");
      setTimeout(() => {
        window.location.href = "/";
      }, 200);
    }, { once: true });
  }

  function crtOn() {
    if (sessionStorage.getItem("crt_boot") !== "1") return;
    sessionStorage.removeItem("crt_boot");

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) return;

    const overlay = document.createElement("div");
    overlay.className = "crt-overlay crt-on";
    const dot = document.createElement("div");
    dot.className = "crt-dot";
    overlay.appendChild(dot);
    document.body.appendChild(overlay);

    overlay.addEventListener("animationend", () => {
      overlay.remove();
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", crtOn);
  } else {
    crtOn();
  }
})();
