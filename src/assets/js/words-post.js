/* ============================================================
   words-post.js — hydrates decision tree + checklist widgets
   for the grapheneos-degoogle post (and any future long-form)
   ============================================================ */
(function () {
  'use strict';

  // ----- Decision tree -----
  const TREE = [
    {
      q: "Do you have a Pixel?",
      options: [
        { label: "Yes", value: "pixel" },
        { label: "No", value: "non-pixel" }
      ]
    },
    {
      q: "Are you ready to replace Gmail, Calendar, and Drive too?",
      options: [
        { label: "Yes, go full", value: "full" },
        { label: "No, stay partial", value: "partial" }
      ]
    },
    {
      q: "Do you depend on tap-to-pay or RCS messaging today?",
      options: [
        { label: "Yes", value: "wallet-rcs" },
        { label: "No", value: "no-wallet-rcs" }
      ]
    }
  ];

  function renderTree(root) {
    root.innerHTML = "";
    const title = document.createElement("p");
    title.className = "dgw-decision-tree-title";
    title.textContent = "◆ Partial vs Full picker ◆";
    root.appendChild(title);

    const answers = [];

    TREE.forEach((step, idx) => {
      const qWrap = document.createElement("div");
      qWrap.className = "dgw-decision-tree-step";
      qWrap.dataset.idx = String(idx);
      qWrap.hidden = idx !== 0;

      const qEl = document.createElement("div");
      qEl.className = "dgw-decision-tree-question";
      qEl.textContent = `(${idx + 1}) ${step.q}`;
      qWrap.appendChild(qEl);

      const opts = document.createElement("div");
      opts.className = "dgw-decision-tree-options";
      step.options.forEach((opt) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.textContent = opt.label;
        btn.addEventListener("click", () => {
          answers[idx] = opt.value;
          // Drop any answers past this step. The path is being re-walked.
          answers.length = idx + 1;

          Array.from(opts.querySelectorAll("button")).forEach((b) =>
            b.setAttribute("aria-pressed", b === btn ? "true" : "false")
          );

          // Hide all later steps and clear their button highlights so the user
          // does not see stale selections from a previous walk.
          TREE.forEach((_, jdx) => {
            if (jdx > idx) {
              const laterStep = root.querySelector(`.dgw-decision-tree-step[data-idx="${jdx}"]`);
              if (!laterStep) return;
              laterStep.hidden = true;
              Array.from(laterStep.querySelectorAll("button")).forEach((b) =>
                b.setAttribute("aria-pressed", "false")
              );
            }
          });

          // Remove any existing result panel. The conclusion needs to be
          // rebuilt or hidden based on the new answer.
          const stale = root.querySelector(".dgw-decision-tree-result");
          if (stale) stale.remove();

          // Q1 hard stop if non-Pixel.
          if (idx === 0 && opt.value === "non-pixel") {
            showResult(root, buildResult(answers, "stop-non-pixel"));
            return;
          }

          const next = root.querySelector(`.dgw-decision-tree-step[data-idx="${idx + 1}"]`);
          if (next) next.hidden = false;
          if (idx === TREE.length - 1) {
            showResult(root, buildResult(answers, null));
          }
        });
        opts.appendChild(btn);
      });
      qWrap.appendChild(opts);
      root.appendChild(qWrap);
    });

    const reset = document.createElement("p");
    reset.className = "dgw-decision-tree-reset";
    const a = document.createElement("a");
    a.href = "#";
    a.textContent = "↻ start over";
    a.addEventListener("click", (e) => {
      e.preventDefault();
      renderTree(root);
    });
    reset.appendChild(a);
    root.appendChild(reset);
  }

  function buildResult(answers, mode) {
    if (mode === "stop-non-pixel") {
      return `<strong>GrapheneOS only supports Pixel devices.</strong> Without a Pixel, this guide does not apply. Closest alternatives: get a supported Pixel (currently 6th generation or newer), or harden stock Android and adopt the app and service swaps from the Alternatives section.`;
    }
    const [, scope, walletRcs] = answers;
    const lines = [];
    if (scope === "full") {
      lines.push(`<strong>Full de-Google path.</strong> Focus on: Back Up The Old Phone, Flash GrapheneOS, Harden, App Install Sources, Restore Data, Fix Sync With DAVx5, Browsers, Google Service Alternatives, and the [Full De-Google] Replacing Gmail, Calendar, and Drive section. Plan a 6 to 12 month timeline.`);
    } else {
      lines.push(`<strong>Partial de-Google path.</strong> Focus on: Back Up The Old Phone, Flash GrapheneOS, Harden, App Install Sources, Restore Data, Fix Sync With DAVx5, Browsers, and Google Service Alternatives. Skip the [Full De-Google] section on a first pass.`);
    }
    if (walletRcs === "wallet-rcs") {
      lines.push(`<strong>Heads up on Wallet and RCS.</strong> Google Wallet tap-to-pay is broken on GrapheneOS by design (Play Integrity fails). Plan to carry physical cards and use Privacy.com virtual numbers online. No FOSS RCS client exists; messaging to RCS contacts will silently downgrade to SMS on the device. Push high-value conversations to Signal.`);
    }
    return lines.join("<br><br>");
  }

  function showResult(root, html) {
    let r = root.querySelector(".dgw-decision-tree-result");
    if (!r) {
      r = document.createElement("div");
      r.className = "dgw-decision-tree-result";
      const reset = root.querySelector(".dgw-decision-tree-reset");
      root.insertBefore(r, reset);
    }
    r.innerHTML = html;
  }

  // ----- Checklist -----
  const CHECKLIST_KEY = "dgw-checklist-v2";
  const ITEMS = [
    { id: "paper-2fa", text: "Print 2FA recovery codes on paper (Bitwarden, Proton, email)" },
    { id: "backup", text: "Back Up The Old Phone (adb pull, WhatsApp DB, Signal key)" },
    { id: "dereg-cashapp", text: "Pre-deregister Cash App and Venmo on web" },
    { id: "flash", text: "Flash GrapheneOS (verify Pixel 9 Pro boot key hash)" },
    { id: "harden", text: "Harden (lockdown tile, auto reboot, sensors, LTE-only)" },
    { id: "play", text: "Install Sandboxed Google Play services" },
    { id: "fdroid", text: "Install F-Droid and cold-store APKs" },
    { id: "obtainium", text: "Install Obtainium for GitHub-released apps" },
    { id: "restore-signal", text: "Restore Signal (recovery key)" },
    { id: "restore-whatsapp", text: "Restore WhatsApp (adb push before first launch)" },
    { id: "restore-obsidian", text: "Restore Obsidian vaults" },
    { id: "davx5", text: "Fix sync with DAVx5 (Contacts and Calendar)" },
    { id: "ironfox", text: "Install IronFox and set DuckDuckGo as default" },
    { id: "search-default", text: "Set DuckDuckGo or Kagi as default search in Vanadium" },
    { id: "alts", text: "Install NewPipe, Organic Maps, Fossify Messages" },
    { id: "full-mail", text: "[Full path] Migrate mail to Proton + SimpleLogin or Addy.io" },
    { id: "full-cal", text: "[Full path] Migrate calendar to Proton Calendar" },
    { id: "full-contacts", text: "[Full path] Migrate contacts to Proton Contacts" },
    { id: "full-drive", text: "[Full path] Migrate files to Proton Drive" }
  ];

  function loadState() {
    try { return JSON.parse(localStorage.getItem(CHECKLIST_KEY) || "{}"); }
    catch (_) { return {}; }
  }
  function saveState(s) {
    try { localStorage.setItem(CHECKLIST_KEY, JSON.stringify(s)); } catch (_) { /* noop */ }
  }

  function renderChecklist(root) {
    root.innerHTML = "";
    root.setAttribute("data-open", "false");
    const state = loadState();

    // Toggle (visible when collapsed)
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "dgw-checklist-toggle";
    toggle.setAttribute("aria-label", "Open migration checklist");
    const toggleLabel = document.createElement("span");
    toggleLabel.textContent = "◆ Checklist";
    const toggleCount = document.createElement("span");
    toggleCount.className = "dgw-checklist-count";
    toggle.appendChild(toggleLabel);
    toggle.appendChild(toggleCount);
    toggle.addEventListener("click", () => {
      if (root.getAttribute("data-open") === "true") {
        closePanel(root);
      } else {
        openPanel(root);
      }
    });
    root.appendChild(toggle);

    // Panel
    const panel = document.createElement("div");
    panel.className = "dgw-checklist-panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", "Migration checklist");

    const header = document.createElement("div");
    header.className = "dgw-checklist-header";
    const title = document.createElement("p");
    title.className = "dgw-checklist-title";
    title.textContent = "◆ Migration checklist ◆";
    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "dgw-checklist-close";
    closeBtn.textContent = "✕ close";
    closeBtn.setAttribute("aria-label", "Close migration checklist");
    closeBtn.addEventListener("click", () => closePanel(root));
    header.appendChild(title);
    header.appendChild(closeBtn);
    panel.appendChild(header);

    const sub = document.createElement("p");
    sub.className = "dgw-checklist-sub";
    sub.textContent = "Progress saves locally. Tick items off as you go.";
    panel.appendChild(sub);

    const ul = document.createElement("ul");
    ITEMS.forEach((item) => {
      const li = document.createElement("li");
      const label = document.createElement("label");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = !!state[item.id];
      cb.addEventListener("change", () => {
        const s = loadState();
        s[item.id] = cb.checked;
        saveState(s);
        updateProgress(root);
      });
      const span = document.createElement("span");
      span.className = "dgw-checklist-text";
      span.textContent = item.text;
      label.appendChild(cb);
      label.appendChild(span);
      li.appendChild(label);
      ul.appendChild(li);
    });
    panel.appendChild(ul);

    const prog = document.createElement("div");
    prog.className = "dgw-checklist-progress";
    const progressText = document.createElement("span");
    prog.appendChild(progressText);
    const reset = document.createElement("button");
    reset.type = "button";
    reset.className = "dgw-checklist-reset";
    reset.textContent = "reset";
    reset.addEventListener("click", () => {
      saveState({});
      renderChecklist(root);
    });
    prog.appendChild(reset);
    panel.appendChild(prog);

    root.appendChild(panel);

    // Backdrop (sibling). One per checklist on the page.
    let backdrop = root.nextElementSibling;
    if (!backdrop || !backdrop.classList || !backdrop.classList.contains("dgw-checklist-backdrop")) {
      backdrop = document.createElement("div");
      backdrop.className = "dgw-checklist-backdrop";
      backdrop.addEventListener("click", () => closePanel(root));
      root.parentNode.insertBefore(backdrop, root.nextSibling);
    }

    updateProgress(root);
  }

  function openPanel(root) {
    root.setAttribute("data-open", "true");
    // Allow Esc to close
    const handler = (e) => {
      if (e.key === "Escape") {
        closePanel(root);
        document.removeEventListener("keydown", handler);
      }
    };
    document.addEventListener("keydown", handler);
    root._dgwEscHandler = handler;
  }

  function closePanel(root) {
    root.setAttribute("data-open", "false");
    if (root._dgwEscHandler) {
      document.removeEventListener("keydown", root._dgwEscHandler);
      root._dgwEscHandler = null;
    }
  }

  function updateProgress(root) {
    const total = ITEMS.length;
    const done = Array.from(root.querySelectorAll("input[type=checkbox]"))
      .filter((c) => c.checked).length;
    const span = root.querySelector(".dgw-checklist-progress span");
    if (span) span.textContent = `${done} / ${total} done`;
    const countBadge = root.querySelector(".dgw-checklist-count");
    if (countBadge) countBadge.textContent = `${done}/${total}`;
  }

  // ----- Wrap tables for safe horizontal scroll on narrow viewports -----
  // markdown-it emits bare <table> elements with no wrapper, which means on
  // narrow viewports a wide table forces the whole page to scroll. Wrap each
  // table in a .table-wrap so the scroll lives inside the wrapper.
  function wrapTables() {
    document.querySelectorAll('.card-body table').forEach((table) => {
      if (table.parentElement && table.parentElement.classList.contains('table-wrap')) {
        return;
      }
      const wrap = document.createElement('div');
      wrap.className = 'table-wrap';
      table.parentNode.insertBefore(wrap, table);
      wrap.appendChild(table);
    });
  }

  // ----- Boot -----
  function boot() {
    wrapTables();
    document.querySelectorAll('[data-widget="decision-tree"]').forEach(renderTree);
    document.querySelectorAll('[data-widget="checklist"]').forEach(renderChecklist);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
