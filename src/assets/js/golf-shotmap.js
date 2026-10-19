/* Satellite shot map for the golf page. Draws each round's shots as arrows on
 * an Esri World Imagery layer (keyless). Data comes from /assets/data/shotmap.json,
 * produced at build time from the 18Birdies export. Requires Leaflet (loaded
 * just before this script). No API keys; tiles are attributed to Esri. */
(function () {
  "use strict";

  var mapEl = document.getElementById("shotmap");
  if (!mapEl || typeof L === "undefined") return;

  // Lie colors are mirrored by the legend swatches in _includes/18birdies.njk;
  // keep the two in sync.
  var LIE_COLORS = {
    Tee: "#1d6fd0",
    Fairway: "#0f7a1e",
    Rough: "#a0661e",
    Sand: "#e8c84a",
    Recovery: "#c41e3a",
  };

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c];
    });
  }

  var map = L.map(mapEl, { scrollWheelZoom: false, attributionControl: true });
  L.tileLayer(
    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    { maxZoom: 21, maxNativeZoom: 19, attribution: "Imagery &copy; Esri, Maxar, Earthstar Geographics" }
  ).addTo(map);
  map.setView([39.5, -98.35], 4); // placeholder until a round loads

  var shotLayer = L.layerGroup().addTo(map);
  var select = document.getElementById("shotmap-round");
  var current = null;

  // Exposed so the tab switcher can resize the map when its (hidden) tab opens;
  // a Leaflet map created in a display:none panel starts at zero size.
  window.golfShotmap = {
    show: function () {
      map.invalidateSize();
      if (current) drawRound(current);
    },
  };

  function latlng(point) {
    // stored as [lng, lat]
    return [point[1], point[0]];
  }

  function drawRound(round) {
    current = round;
    shotLayer.clearLayers();
    var bounds = [];
    round.shots.forEach(function (s) {
      if (!s.start || !s.end) return;
      var a = latlng(s.start);
      var b = latlng(s.end);
      bounds.push(a, b);
      var color = LIE_COLORS[s.lie] || "#555";
      L.polyline([a, b], { color: color, weight: 3, opacity: 0.9 }).addTo(shotLayer);
      L.circleMarker(a, {
        radius: 4,
        color: "#000",
        weight: 1,
        fillColor: color,
        fillOpacity: 1,
      })
        .bindPopup(
          "Hole " + esc(s.h != null ? s.h : "?") + "<br>" + esc(s.club || "?") + (s.lie ? " from " + esc(s.lie) : "")
        )
        .addTo(shotLayer);
      L.circleMarker(b, { radius: 3, color: color, weight: 1, fillColor: "#fff", fillOpacity: 1 }).addTo(
        shotLayer
      );
    });
    if (bounds.length) map.fitBounds(bounds, { padding: [24, 24] });
  }

  fetch("/assets/data/shotmap.json")
    .then(function (r) {
      if (!r.ok) throw new Error("shotmap.json " + r.status);
      return r.json();
    })
    .then(function (rounds) {
      if (!rounds.length || !select) {
        mapEl.innerHTML = "<p class='golf-note'>No shot-mapped rounds yet.</p>";
        return;
      }
      rounds.forEach(function (round, i) {
        var opt = document.createElement("option");
        opt.value = String(i);
        var par = round.toPar != null ? " (" + (round.toPar > 0 ? "+" : "") + round.toPar + ")" : "";
        opt.textContent = round.date + " · " + round.course + par;
        select.appendChild(opt);
      });
      select.addEventListener("change", function () {
        drawRound(rounds[Number(select.value)]);
      });
      drawRound(rounds[0]);
    })
    .catch(function () {
      mapEl.innerHTML = "<p class='golf-note'>Could not load shot data.</p>";
    });
})();
