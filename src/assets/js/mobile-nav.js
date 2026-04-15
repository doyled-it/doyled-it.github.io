(function () {
  const nav = document.getElementById("mobile-nav");
  if (!nav) return;

  function toggle(open) {
    nav.hidden = !open;
    document.body.classList.toggle("mobile-nav-open", open);
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
