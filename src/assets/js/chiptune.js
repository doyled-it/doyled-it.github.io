(function () {
  let ctx = null;
  let playing = false;
  let timeout = null;
  let activeNodes = [];

  const N = {
    C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23,
    G4: 392.00, A4: 440.00, B4: 493.88,
    C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 784.00,
    A5: 880.00,
    R: 0,
  };

  function playNote(freq, start, duration, type = "square", gain = 0.06) {
    if (freq === 0) return;
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    vol.gain.setValueAtTime(gain, start);
    vol.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(vol);
    vol.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.05);
    activeNodes.push(osc, vol);
  }

  function stopAll() {
    playing = false;
    if (timeout) clearTimeout(timeout);
    for (const node of activeNodes) {
      try { node.disconnect(); } catch {}
      try { if (node.stop) node.stop(0); } catch {}
    }
    activeNodes = [];
  }

  // "Take Me Out to the Ball Game" melody (simplified, key of C)
  // "Take me out to the ball game, take me out with the crowd..."
  const baseball = {
    bpm: 160,
    melody: [
      // Take me out to the ball game
      "C5","C5","A4","G4","E4","G4","R","D4",
      // Take me out with the crowd
      "C5","C5","A4","G4","E4","G4","R","R",
      // Buy me some peanuts and Cracker Jack
      "A4","A4","B4","C5","A4","G4","E4","D4",
      // I don't care if I never get back
      "C4","D4","E4","F4","G4","A4","G4","R",
    ],
    bass: [
      "C4","C4","F4","F4","C4","C4","G4","G4",
      "C4","C4","F4","F4","C4","C4","G4","G4",
      "F4","F4","G4","G4","F4","F4","C4","C4",
      "C4","C4","F4","F4","G4","G4","C4","C4",
    ],
  };

  // Chill golf theme — relaxed major key
  const golf = {
    bpm: 110,
    melody: [
      "E4","G4","A4","B4","R","B4","A4","G4",
      "E4","D4","E4","G4","R","A4","G4","E4",
      "C5","B4","A4","G4","R","A4","B4","C5",
      "D5","C5","B4","A4","R","G4","A4","R",
    ],
    bass: [
      "C4","C4","F4","F4","G4","G4","E4","E4",
      "A4","A4","D4","D4","G4","G4","C4","C4",
      "F4","F4","D4","D4","G4","G4","E4","E4",
      "A4","A4","F4","F4","G4","G4","C4","C4",
    ],
  };

  const themes = { baseball, golf };

  function playTheme(name) {
    const theme = themes[name];
    if (!theme) return;

    const beatLen = 60 / theme.bpm;
    const now = ctx.currentTime + 0.05;

    theme.melody.forEach((note, i) => {
      playNote(N[note], now + i * beatLen, beatLen * 0.75, "square", 0.05);
    });
    theme.bass.forEach((note, i) => {
      playNote(N[note] / 2, now + i * beatLen, beatLen * 0.85, "triangle", 0.07);
    });

    const loopLen = theme.melody.length * beatLen * 1000;
    timeout = setTimeout(() => {
      if (playing) playTheme(name);
    }, loopLen);
  }

  const page = document.body.dataset.forceBuddy;
  if (!page) return;
  const themeName = page === "golf-cart" ? "golf" : page;
  if (!themes[themeName]) return;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "chiptune-btn";
  btn.textContent = "♪ chiptune";
  btn.setAttribute("aria-label", "Toggle chiptune music");
  document.body.appendChild(btn);

  btn.addEventListener("click", () => {
    if (playing) {
      stopAll();
      btn.textContent = "♪ chiptune";
      btn.classList.remove("chiptune-btn--playing");
    } else {
      if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)();
      ctx.resume();
      playing = true;
      playTheme(themeName);
      btn.textContent = "■ stop";
      btn.classList.add("chiptune-btn--playing");
    }
  });
})();
