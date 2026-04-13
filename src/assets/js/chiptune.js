(function () {
  const page = document.body.dataset.forceBuddy;
  if (!page) return;
  const themeName = page === "golf-cart" ? "golf" : page;
  if (themeName !== "baseball" && themeName !== "golf") return;

  let playing = false;
  let stopFn = null;

  // --- NSF player for baseball ---
  function startBaseball() {
    const libScript = document.createElement("script");
    libScript.src = "/assets/js/nsf-player/libgme.js";
    libScript.onload = () => {
      const idxScript = document.createElement("script");
      idxScript.src = "/assets/js/nsf-player/index.js";
      idxScript.onload = () => {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        window.ctx = ctx;
        const player = createNsfPlayer(ctx);
        player.play("/assets/audio/bases-loaded-2.nsf", 0);
        stopFn = () => player.stop();
      };
      document.head.appendChild(idxScript);
    };
    document.head.appendChild(libScript);
  }

  function startBaseballCached() {
    if (window.createNsfPlayer) {
      window.ctx.resume();
      const player = createNsfPlayer(window.ctx);
      player.play("/assets/audio/bases-loaded-2.nsf", 0);
      stopFn = () => player.stop();
    } else {
      startBaseball();
    }
  }

  // --- Web Audio chiptune for golf ---
  let golfCtx = null;
  let golfNodes = [];
  let golfTimeout = null;

  const N = {
    C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23,
    G4: 392.00, A4: 440.00, B4: 493.88,
    C5: 523.25, D5: 587.33, R: 0,
  };

  function golfNote(freq, start, dur, type = "square", gain = 0.05) {
    if (freq === 0) return;
    const osc = golfCtx.createOscillator();
    const vol = golfCtx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    vol.gain.setValueAtTime(gain, start);
    vol.gain.exponentialRampToValueAtTime(0.001, start + dur);
    osc.connect(vol);
    vol.connect(golfCtx.destination);
    osc.start(start);
    osc.stop(start + dur + 0.05);
    golfNodes.push(osc, vol);
  }

  function playGolfLoop() {
    const melody = ["E4","G4","A4","B4","R","B4","A4","G4","E4","D4","E4","G4","R","A4","G4","E4","C5","B4","A4","G4","R","A4","B4","C5","D5","C5","B4","A4","R","G4","A4","R"];
    const bass = ["C4","C4","F4","F4","G4","G4","E4","E4","A4","A4","D4","D4","G4","G4","C4","C4","F4","F4","D4","D4","G4","G4","E4","E4","A4","A4","F4","F4","G4","G4","C4","C4"];
    const beatLen = 60 / 110;
    const now = golfCtx.currentTime + 0.05;
    melody.forEach((n, i) => golfNote(N[n], now + i * beatLen, beatLen * 0.75, "square", 0.05));
    bass.forEach((n, i) => golfNote(N[n] / 2, now + i * beatLen, beatLen * 0.85, "triangle", 0.07));
    golfTimeout = setTimeout(() => { if (playing) playGolfLoop(); }, melody.length * beatLen * 1000);
  }

  function startGolf() {
    if (!golfCtx) golfCtx = new (window.AudioContext || window.webkitAudioContext)();
    golfCtx.resume();
    playGolfLoop();
    stopFn = () => {
      if (golfTimeout) clearTimeout(golfTimeout);
      for (const node of golfNodes) {
        try { node.disconnect(); } catch {}
        try { if (node.stop) node.stop(0); } catch {}
      }
      golfNodes = [];
    };
  }

  // --- Button ---
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "chiptune-btn";
  btn.textContent = "♪ chiptune";
  btn.setAttribute("aria-label", "Toggle chiptune music");
  document.body.appendChild(btn);

  btn.addEventListener("click", () => {
    if (playing) {
      if (stopFn) stopFn();
      playing = false;
      btn.textContent = "♪ chiptune";
      btn.classList.remove("chiptune-btn--playing");
    } else {
      playing = true;
      if (themeName === "baseball") startBaseballCached();
      else startGolf();
      btn.textContent = "■ stop";
      btn.classList.add("chiptune-btn--playing");
    }
  });
})();
