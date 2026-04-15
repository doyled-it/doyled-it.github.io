(function () {
  const nav = document.getElementById("mobile-nav");
  if (!nav) return;

  const toolsSlot = document.getElementById("mobile-nav-tools");

  function isMobile() {
    return window.matchMedia("(max-width: 720px)").matches;
  }

  function toggle(open) {
    nav.hidden = !open;
    document.body.classList.toggle("mobile-nav-open", open);

    if (!toolsSlot) return;
    const chiptune = document.querySelector(".chiptune-btn");
    const buddy = document.getElementById("buddy-selector");

    if (open && isMobile()) {
      if (chiptune) toolsSlot.appendChild(chiptune);
      if (buddy) toolsSlot.appendChild(buddy);
    } else {
      // Move back to body
      if (chiptune && chiptune.parentNode !== document.body) {
        document.body.appendChild(chiptune);
      }
      if (buddy && buddy.parentNode !== document.body) {
        document.body.appendChild(buddy);
      }
    }
  }

  document.addEventListener("click", (e) => {
    if (e.target.closest("#mobile-menu-btn")) {
      toggle(nav.hidden);
    } else if (e.target.closest("#mobile-nav-close")) {
      toggle(false);
    } else if (e.target.closest(".mobile-nav-list a")) {
      toggle(false);
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !nav.hidden) toggle(false);
  });
})();
