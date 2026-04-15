(function () {
  const page = document.body.dataset.forceBuddy;
  if (!page) return;
  const themeName = page === "golf-cart" ? "golf" : page;
  if (themeName !== "baseball" && themeName !== "golf") return;

  const nsfFiles = {
    baseball: { src: "/assets/audio/bases-loaded-2.nsf", tracks: [0, 1] },
    golf: { src: "/assets/audio/golf-grand-slam.nsf", tracks: [0, 1, 2, 3] },
  };

  let playing = false;
  let nsfPlayer = null;
  let nsfCtx = null;
  let nsfLoaded = false;

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function loadNsfScripts(cb) {
    if (nsfLoaded) { cb(); return; }
    const s1 = document.createElement("script");
    s1.src = "/assets/js/nsf-player/libgme.js";
    document.head.appendChild(s1);
    s1.onload = () => {
      const s2 = document.createElement("script");
      s2.src = "/assets/js/nsf-player/index.js";
      document.head.appendChild(s2);
      s2.onload = () => {
        nsfLoaded = true;
        setTimeout(cb, 200);
      };
    };
  }

  function startMusic() {
    const nsf = nsfFiles[themeName];
    if (!nsf) return;
    loadNsfScripts(() => {
      if (!nsfCtx) nsfCtx = new (window.AudioContext || window.webkitAudioContext)();
      nsfCtx.resume();
      nsfPlayer = createNsfPlayer(nsfCtx);
      nsfPlayer.play(nsf.src, pickRandom(nsf.tracks));
    });
  }

  function stopMusic() {
    if (nsfPlayer) { try { nsfPlayer.stop(); } catch {} nsfPlayer = null; }
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
