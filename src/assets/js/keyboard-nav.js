(function () {
  const map = {
    a: "/about/",
    r: "/resume/",
    p: "/projects/",
    w: "/words/",
    m: "/music/",
    c: "/contact/",
  };
  document.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const tag = e.target && e.target.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA" || e.target.isContentEditable) return;
    const dest = map[e.key.toLowerCase()];
    if (dest) {
      e.preventDefault();
      window.location.href = dest;
    }
  });
})();
