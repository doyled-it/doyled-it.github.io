(function () {
  const map = {
    h: "/",
    a: "/about/",
    r: "/resume/",
    p: "/projects/",
    w: "/words/",
    m: "/music/",
    c: "/contact/",
    b: "/baseball/",
    g: "/golf/",
  };
  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
    const tag = e.target && e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || e.target.isContentEditable) return;
    const dest = map[e.key.toLowerCase()];
    if (dest && dest !== window.location.pathname) {
      e.preventDefault();
      window.location.href = dest;
    }
  });
})();
