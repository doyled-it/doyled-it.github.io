/* Tab switcher for the golf page. Shows one .golf-tab-panel at a time, keeps the
 * .golf-tab buttons in sync (WAI-ARIA tabs: roving tabindex, arrow-key nav), and
 * honors a #hash on load so tabs are linkable. Tells the shot map to resize when
 * its tab opens (Leaflet in a hidden panel initializes at zero size). */
(function () {
  "use strict";
  var tabs = Array.prototype.slice.call(document.querySelectorAll(".golf-tab"));
  var panels = Array.prototype.slice.call(document.querySelectorAll(".golf-tab-panel"));
  if (!tabs.length) return;

  function activate(name, focus) {
    var match = tabs.filter(function (t) {
      return t.dataset.tab === name;
    })[0];
    if (!match) return;
    tabs.forEach(function (t) {
      var on = t === match;
      t.classList.toggle("active", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
    });
    panels.forEach(function (p) {
      p.hidden = p.dataset.tab !== name;
    });
    if (name === "map" && window.golfShotmap && window.golfShotmap.show) {
      window.golfShotmap.show();
    }
    if (focus) match.focus();
  }

  function setHash(name) {
    try {
      history.replaceState(null, "", "#" + name);
    } catch (e) {
      /* ignore */
    }
  }

  tabs.forEach(function (t, i) {
    t.addEventListener("click", function () {
      activate(t.dataset.tab);
      setHash(t.dataset.tab);
    });
    t.addEventListener("keydown", function (e) {
      var dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!dir) return;
      e.preventDefault();
      var next = tabs[(i + dir + tabs.length) % tabs.length];
      activate(next.dataset.tab, true);
      setHash(next.dataset.tab);
    });
  });

  var initial = (location.hash || "").replace("#", "");
  var valid = tabs.some(function (t) {
    return t.dataset.tab === initial;
  });
  // Do not rewrite the URL when the visitor arrived without a hash.
  activate(valid ? initial : tabs[0].dataset.tab);
})();
