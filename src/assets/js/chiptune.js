(function () {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  let playing = false;
  let timeout = null;

  const NOTE_MAP = {
    C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23,
    G4: 392.00, A4: 440.00, B4: 493.88,
    C5: 523.25, D5: 587.33, E5: 659.25, G5: 784.00,
  };

  function playNote(freq, start, duration, type = "square", gain = 0.08) {
    const osc = ctx.createOscillator();
    const vol = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    vol.gain.setValueAtTime(gain, start);
    vol.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(vol);
    vol.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration);
  }

  const themes = {
    baseball: {
      bpm: 140,
      melody: ["E4","E4","G4","E4","C5","B4","G4","E4","D4","E4","G4","A4","G4","E4","D4","C4"],
      bass:   ["C4","C4","G4","G4","A4","A4","E4","E4","F4","F4","C4","C4","G4","G4","C4","C4"],
    },
    golf: {
      bpm: 100,
      melody: ["E4","G4","A4","B4","A4","G4","E4","D4","E4","G4","B4","D5","B4","A4","G4","E4"],
      bass:   ["C4","C4","F4","F4","G4","G4","C4","C4","A4","A4","D4","D4","G4","G4","C4","C4"],
    },
  };

  function playTheme(name) {
    const theme = themes[name];
    if (!theme) return;

    const beatLen = 60 / theme.bpm;
    const now = ctx.currentTime + 0.1;

    theme.melody.forEach((note, i) => {
      playNote(NOTE_MAP[note], now + i * beatLen, beatLen * 0.8, "square", 0.06);
    });
    theme.bass.forEach((note, i) => {
      playNote(NOTE_MAP[note] / 2, now + i * beatLen, beatLen * 0.9, "triangle", 0.08);
    });

    const loopLen = theme.melody.length * beatLen * 1000;
    timeout = setTimeout(() => {
      if (playing) playTheme(name);
    }, loopLen);
  }

  function stop() {
    playing = false;
    if (timeout) clearTimeout(timeout);
  }

  const page = document.body.dataset.forceBuddy;
  if (!page || !themes[page === "golf-cart" ? "golf" : page]) return;
  const themeName = page === "golf-cart" ? "golf" : page;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "chiptune-btn";
  btn.textContent = "♪ chiptune";
  btn.setAttribute("aria-label", "Toggle chiptune music");
  document.body.appendChild(btn);

  btn.addEventListener("click", () => {
    if (playing) {
      stop();
      btn.textContent = "♪ chiptune";
      btn.classList.remove("chiptune-btn--playing");
    } else {
      ctx.resume();
      playing = true;
      playTheme(themeName);
      btn.textContent = "■ stop";
      btn.classList.add("chiptune-btn--playing");
    }
  });
})();
