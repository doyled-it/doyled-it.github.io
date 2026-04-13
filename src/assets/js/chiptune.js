(function () {
  const page = document.body.dataset.forceBuddy;
  if (!page) return;
  const themeName = page === "golf-cart" ? "golf" : page;
  if (themeName !== "baseball" && themeName !== "golf") return;

  const nsfFiles = {
    baseball: { src: "/assets/audio/bases-loaded-2.nsf", track: 0 },
  };

  let playing = false;
  let nsfPlayer = null;
  let nsfCtx = null;
  let nsfLoaded = false;

  // Golf fallback: Web Audio generated
  let golfCtx = null;
  let golfNodes = [];
  let golfTimeout = null;
  const N = {
    C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23,
    G4: 392.00, A4: 440.00, B4: 493.88,
    C5: 523.25, D5: 587.33, R: 0,
  };

  function golfNote(freq, start, dur, type, gain) {
    if (!freq) return;
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
    const mel = ["E4","G4","A4","B4","R","B4","A4","G4","E4","D4","E4","G4","R","A4","G4","E4","C5","B4","A4","G4","R","A4","B4","C5","D5","C5","B4","A4","R","G4","A4","R"];
    const bas = ["C4","C4","F4","F4","G4","G4","E4","E4","A4","A4","D4","D4","G4","G4","C4","C4","F4","F4","D4","D4","G4","G4","E4","E4","A4","A4","F4","F4","G4","G4","C4","C4"];
    const b = 60 / 110;
    const t = golfCtx.currentTime + 0.05;
    mel.forEach((n, i) => golfNote(N[n], t + i * b, b * 0.75, "square", 0.05));
    bas.forEach((n, i) => golfNote(N[n] / 2, t + i * b, b * 0.85, "triangle", 0.07));
    golfTimeout = setTimeout(() => { if (playing) playGolfLoop(); }, mel.length * b * 1000);
  }

  function stopGolf() {
    if (golfTimeout) clearTimeout(golfTimeout);
    for (const n of golfNodes) {
      try { n.disconnect(); } catch {}
      try { if (n.stop) n.stop(0); } catch {}
    }
    golfNodes = [];
  }

  function loadNsfScripts(cb) {
    if (nsfLoaded) { cb(); return; }
    const s1 = document.createElement("script");
    s1.src = "/assets/js/nsf-player/libgme.js";
    s1.onload = () => {
      const s2 = document.createElement("script");
      s2.src = "/assets/js/nsf-player/index.js";
      s2.onload = () => { nsfLoaded = true; cb(); };
      document.head.appendChild(s2);
    };
    document.head.appendChild(s1);
  }

  function startMusic() {
    const nsf = nsfFiles[themeName];
    if (nsf) {
      loadNsfScripts(() => {
        if (!nsfCtx) nsfCtx = new (window.AudioContext || window.webkitAudioContext)();
        nsfCtx.resume();
        nsfPlayer = window.createNsfPlayer(nsfCtx);
        nsfPlayer.play(nsf.src, nsf.track);
      });
    } else {
      if (!golfCtx) golfCtx = new (window.AudioContext || window.webkitAudioContext)();
      golfCtx.resume();
      playGolfLoop();
    }
  }

  function stopMusic() {
    if (nsfPlayer) { try { nsfPlayer.stop(); } catch {} nsfPlayer = null; }
    stopGolf();
  }

  // Build button
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "chiptune-btn";
  btn.innerHTML = '<span class="chiptune-cd"></span> ▶';
  btn.setAttribute("aria-label", "Play music");
  document.body.appendChild(btn);

  btn.addEventListener("click", () => {
    if (playing) {
      stopMusic();
      playing = false;
      btn.innerHTML = '<span class="chiptune-cd"></span> ▶';
      btn.classList.remove("chiptune-btn--playing");
    } else {
      playing = true;
      startMusic();
      btn.innerHTML = '<span class="chiptune-cd chiptune-cd--spin"></span> ■';
      btn.classList.add("chiptune-btn--playing");
    }
  });
})();
