window.UI = (() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));
  const rupiah = (n) => "Rp" + Number(n || 0).toLocaleString("id-ID");
  const dateTime = (d) => new Date(d).toLocaleString("id-ID", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const ICONS = {
    success: "fa-circle-check", error: "fa-circle-xmark",
    warning: "fa-triangle-exclamation", info: "fa-circle-info"
  };

  /* ---------- Toast ---------- */
  function toast(type, msg, ms = 3000) {
    const el = document.createElement("div");
    el.className = `toast ${type}`;
    el.innerHTML = `<i class="fa-solid ${ICONS[type] || ICONS.info}"></i><span>${esc(msg)}</span>`;
    $("#toastRoot").appendChild(el);
    setTimeout(() => { el.classList.add("out"); setTimeout(() => el.remove(), 260); }, ms);
  }

  /* ---------- Custom alert / confirm (Promise) ---------- */
  function alert({ type = "info", title = "", text = "", confirmText = "OK", cancelText = null, html = false } = {}) {
    return new Promise((resolve) => {
      const root = $("#modalRoot");
      root.innerHTML = `
        <div class="modal m-${type}" role="alertdialog" aria-modal="true">
          <div class="m-ic"><i class="fa-solid ${ICONS[type] || ICONS.info}"></i></div>
          <h4>${esc(title)}</h4>
          <div class="m-text">${html ? text : esc(text)}</div>
          <div class="m-actions">
            ${cancelText ? `<button class="btn ghost" data-r="0">${esc(cancelText)}</button>` : ""}
            <button class="btn primary" data-r="1">${esc(confirmText)}</button>
          </div>
        </div>`;
      root.classList.add("show");
      const close = (v) => { root.classList.remove("show"); root.innerHTML = ""; document.removeEventListener("keydown", onKey); resolve(v); };
      const onKey = (e) => { if (e.key === "Escape") close(false); };
      document.addEventListener("keydown", onKey);
      root.onclick = (e) => {
        const b = e.target.closest("[data-r]");
        if (b) close(b.dataset.r === "1");
        else if (e.target === root) close(false);
      };
      const first = $("[data-r='1']", root); first && first.focus();
    });
  }
  const confirm = (opts) => alert({ type: "warning", cancelText: "Batal", confirmText: "Ya, Lanjut", ...opts });

  /* ---------- Loader ---------- */
  let loadCount = 0;
  function loading(on) {
    loadCount = Math.max(0, loadCount + (on ? 1 : -1));
    $("#loader").hidden = loadCount === 0;
  }

  const debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

  return { $, $$, esc, rupiah, dateTime, toast, alert, confirm, loading, debounce };
})();