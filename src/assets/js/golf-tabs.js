/* Tab switcher for the golf page. Shows one .golf-tab-panel at a time and syncs
 * the active .golf-tab button. Honors a #hash on load so tabs are linkable.
 * Tells the shot map to resize when its tab opens (Leaflet in a hidden panel
 * initializes at zero size). */
(function () {
  "use strict";
  var tabs = Array.prototype.slice.call(document.querySelectorAll(".golf-tab"));
  var panels = Array.prototype.slice.call(document.querySelectorAll(".golf-tab-panel"));
  if (!tabs.length) return;

  function activate(name) {
    var matched = false;
    tabs.forEach(function (t) {
      var on = t.dataset.tab === name;
      matched = matched || on;
      t.classList.toggle("active", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
    });
    if (!matched) return;
    panels.forEach(function (p) {
      p.hidden = p.dataset.tab !== name;
    });
    if (name === "map" && window.golfShotmap && window.golfShotmap.show) {
      window.golfShotmap.show();
    }
    try {
      history.replaceState(null, "", "#" + name);
    } catch (e) {
      /* ignore */
    }
  }

  tabs.forEach(function (t) {
    t.addEventListener("click", function () {
      activate(t.dataset.tab);
    });
  });

  var initial = (location.hash || "").replace("#", "");
  var valid = tabs.some(function (t) {
    return t.dataset.tab === initial;
  });
  activate(valid ? initial : tabs[0].dataset.tab);
})();
