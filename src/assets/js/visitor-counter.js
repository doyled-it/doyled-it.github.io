(function () {
  const code = document.documentElement.dataset.goatcounter;
  if (!code) return;

  const targets = document.querySelectorAll("[data-visitor-counter]");
  if (!targets.length) return;

  function pad(n) {
    const s = String(n);
    return s.length < 5 ? s.padStart(5, "0") : s;
  }

  fetch(`https://${code}.goatcounter.com/counter//TOTAL.json`, { mode: "cors" })
    .then((r) => r.json())
    .then((data) => {
      const raw = (data.count || "").replace(/[^\d]/g, "");
      if (raw === "") return;
      const display = pad(parseInt(raw, 10));
      targets.forEach((el) => { el.textContent = display; });
    })
    .catch(() => {});
})();
