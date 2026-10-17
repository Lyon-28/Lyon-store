(() => {
  const { $, $$, esc, rupiah, dateTime } = UI;

  const S = {
    categories: [], products: [], payments: [],
    cat: null, brand: "all", selected: null,
    payment: null, query: "", pollTimer: null
  };

  const STATUS = {
    pending: "Menunggu Pembayaran", paid: "Dibayar", processing: "Diproses",
    success: "Berhasil", failed: "Gagal", expired: "Kedaluwarsa"
  };
  const CAT_ICON_FALLBACK = "fa-mobile-screen-button";

  /* ================= Storage ================= */
  const store = {
    get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
  };
  const getHistory = () => store.get("tpk_history", []);
  function pushHistory(o) {
    const list = getHistory().filter(x => x.orderId !== o.orderId);
    list.unshift(o);
    store.set("tpk_history", list.slice(0, CFG.HISTORY_MAX));
  }
  function updateHistory(id, patch) {
    store.set("tpk_history", getHistory().map(x => x.orderId === id ? { ...x, ...patch } : x));
  }

  /* ================= Tema ================= */
  function applyTheme(t) {
    document.documentElement.dataset.theme = t;
    $("#btnTheme i").className = t === "dark" ? "fa-solid fa-sun" : "fa-solid fa-moon";
    $("meta[name=theme-color]").content = t === "dark" ? "#0e0f1a" : "#6d5dfc";
  }
  function initTheme() {
    const saved = store.get("tpk_theme", null);
    applyTheme(saved || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
    $("#btnTheme").onclick = () => {
      const t = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      store.set("tpk_theme", t); applyTheme(t);
    };
  }

  /* ================= Navigasi ================= */
  function showView(name) {
    $$(".view").forEach(v => v.classList.toggle("active", v.id === "view-" + name));
    $$(".nav-item").forEach(n => n.classList.toggle("active", n.dataset.view === name));
    $("#pickBar").hidden = !(name === "home" && S.selected);
    if (name === "history") renderHistory();
    if (name !== "track") stopPoll();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ================= Katalog ================= */
  function skeleton(el, n, cls = "skel") {
    el.innerHTML = Array.from({ length: n }, () => `<div class="${cls}"></div>`).join("");
  }

  async function loadCatalog() {
    skeleton($("#categories"), 6);
    try {
      const [cat, pay] = await Promise.all([API.catalog(), API.payments()]);
      S.categories = cat.categories || [];
      S.products = (cat.products || []).filter(p => p.active !== false);
      S.payments = pay || [];
      renderCategories();
    } catch (e) {
      $("#categories").innerHTML = `<div class="empty" style="grid-column:1/-1"><i class="fa-solid fa-plug-circle-xmark"></i>${esc(e.message)}<br><br><button class="btn primary" id="btnRetry"><i class="fa-solid fa-rotate-right"></i> Coba Lagi</button></div>`;
      $("#btnRetry").onclick = loadCatalog;
    }
  }

  function renderCategories() {
    const q = S.query.toLowerCase();
    const list = S.categories.filter(c => c.name.toLowerCase().includes(q));
    $("#categories").innerHTML = list.length
      ? list.map(c => `
        <button class="cat" data-id="${esc(c.id)}">
          <span class="ic"><i class="fa-solid ${esc(c.icon || CAT_ICON_FALLBACK)}"></i></span>${esc(c.name)}
        </button>`).join("")
      : `<div class="empty" style="grid-column:1/-1"><i class="fa-solid fa-folder-open"></i>Kategori tidak ditemukan</div>`;
  }

  function openCategory(id) {
    const c = S.categories.find(x => String(x.id) === String(id));
    if (!c) return;
    S.cat = c; S.brand = "all"; S.selected = null; S.query = "";
    $("#search").value = "";
    $("#catTitle").textContent = c.name;
    $("#target").value = ""; $("#zone").value = "";
    $("#target").placeholder = c.placeholder || "Masukkan nomor tujuan";
    $("#targetLabel").textContent = c.label || "Nomor Tujuan";
    $("#targetIcon").className = "fa-solid " + ({ phone: "fa-mobile-screen", game: "fa-gamepad", meter: "fa-bolt", account: "fa-wallet" }[c.input] || "fa-hashtag");
    $("#zoneWrap").hidden = !c.zone;
    setHint(c.hint || "", false);
    $("#opBadge").hidden = true; $("#btnClear").hidden = true;
    $("#categories").parentElement.querySelector(".section-title").hidden = true;
    $("#categories").hidden = true;
    $(".hero").hidden = true;
    $("#orderSection").hidden = false;
    renderBrands(); renderProducts(); updatePickBar();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function closeCategory() {
    S.cat = null; S.selected = null;
    $("#orderSection").hidden = true;
    $("#categories").hidden = false;
    $("#categories").parentElement.querySelector(".section-title").hidden = false;
    $(".hero").hidden = false;
    updatePickBar(); renderCategories();
  }

  function renderBrands() {
    const brands = [...new Set(S.products.filter(p => p.category === S.cat.id).map(p => p.brand).filter(Boolean))];
    const box = $("#brands");
    if (brands.length < 2) { box.innerHTML = ""; S.brand = "all"; return; }
    box.innerHTML = [`<button class="chip ${S.brand === "all" ? "active" : ""}" data-b="all">Semua</button>`]
      .concat(brands.map(b => `<button class="chip ${S.brand === b ? "active" : ""}" data-b="${esc(b)}">${esc(b)}</button>`)).join("");
  }

  function renderProducts() {
    const q = S.query.toLowerCase();
    const list = S.products
      .filter(p => p.category === S.cat.id)
      .filter(p => S.brand === "all" || p.brand === S.brand)
      .filter(p => !q || (p.name + " " + (p.note || "")).toLowerCase().includes(q))
      .sort((a, b) => a.price - b.price);
    $("#products").innerHTML = list.length
      ? list.map(p => `
        <button class="prod ${S.selected?.sku === p.sku ? "selected" : ""}" data-sku="${esc(p.sku)}">
          ${p.badge ? `<span class="badge">${esc(p.badge)}</span>` : ""}
          <span class="p-name">${esc(p.name)}</span>
          ${p.note ? `<span class="p-note">${esc(p.note)}</span>` : ""}
          <span class="p-price">${rupiah(p.price)}</span>
        </button>`).join("")
      : `<div class="empty"><i class="fa-solid fa-box-open"></i>Produk tidak tersedia</div>`;
  }

  function updatePickBar() {
    const on = !!S.selected && !$("#orderSection").hidden;
    $("#pickBar").hidden = !on;
    if (on) { $("#pickName").textContent = S.selected.name; $("#pickPrice").textContent = rupiah(S.selected.price); }
  }

  /* ================= Validasi & deteksi operator ================= */
  const normPhone = (v) => {
    v = String(v).replace(/[^\d+]/g, "");
    if (v.startsWith("+62")) v = "0" + v.slice(3);
    else if (v.startsWith("62")) v = "0" + v.slice(2);
    return v;
  };

  function setHint(msg, err) {
    const h = $("#targetHint"); h.textContent = msg; h.classList.toggle("err", !!err);
  }

  function validateTarget() {
    const c = S.cat; if (!c) return { ok: false };
    let v = $("#target").value.trim();
    if (!v) return { ok: false, msg: "Masukkan data tujuan terlebih dahulu." };
    if (c.input === "phone" || c.input === "account") {
      v = normPhone(v);
      if (!/^08\d{8,12}$/.test(v)) return { ok: false, msg: "Nomor HP tidak valid (contoh: 08123456789)." };
    } else if (c.input === "meter") {
      v = v.replace(/\D/g, "");
      if (!/^\d{11,12}$/.test(v)) return { ok: false, msg: "Nomor meter/ID pelanggan harus 11-12 digit." };
    } else {
      if (v.length < 4) return { ok: false, msg: "ID terlalu pendek." };
      if (c.zone && !$("#zone").value.trim()) return { ok: false, msg: "Zone / Server ID wajib diisi." };
    }
    return { ok: true, value: v };
  }

  function detectOperator(num) {
    if (num.length < 4) return null;
    return CFG.OPERATORS.find(o => o.prefix.includes(num.slice(0, 4))) || null;
  }

  function onTargetInput() {
    const el = $("#target");
    $("#btnClear").hidden = !el.value;
    el.classList.remove("invalid");
    if (S.cat && S.cat.input === "phone") {
      const n = normPhone(el.value);
      const op = detectOperator(n);
      const badge = $("#opBadge");
      if (op) {
        badge.textContent = op.name; badge.hidden = false;
        const match = [...new Set(S.products.filter(p => p.category === S.cat.id).map(p => p.brand))]
          .find(b => b && b.toLowerCase().includes(op.key));
        if (match && S.brand !== match) { S.brand = match; S.selected = null; renderBrands(); renderProducts(); updatePickBar(); }
      } else badge.hidden = true;
    }
  }

  /* ================= Checkout ================= */
  function calcFee(price, pay) {
    return Math.ceil((pay?.fee_flat || 0) + price * ((pay?.fee_pct || 0) / 100));
  }

  function openSheet() {
    if (!S.selected) return UI.toast("warning", "Pilih produk dulu.");
    const v = validateTarget();
    if (!v.ok) {
      $("#target").classList.add("invalid"); $("#target").focus();
      setHint(v.msg, true);
      return UI.alert({ type: "warning", title: "Data belum lengkap", text: v.msg });
    }
    const p = S.selected;
    const rows = [
      ["Kategori", S.cat.name], ["Produk", p.name], [S.cat.label || "Tujuan", v.value]
    ];
    if (S.cat.zone) rows.push(["Zone / Server", $("#zone").value.trim()]);
    $("#summary").innerHTML = rows.map(r => `<div><span>${esc(r[0])}</span><b>${esc(r[1])}</b></div>`).join("");

    if (!S.payment || !S.payments.find(x => x.code === S.payment)) S.payment = S.payments[0]?.code || null;
    $("#payList").innerHTML = S.payments.map(m => `
      <button class="pay ${S.payment === m.code ? "active" : ""}" data-code="${esc(m.code)}">
        <span class="pi"><i class="fa-solid ${esc(m.icon || "fa-wallet")}"></i></span>
        <span class="pt">${esc(m.name)}${m.info ? `<small>${esc(m.info)}</small>` : ""}</span>
        <span class="rd"></span>
      </button>`).join("") || `<div class="hint">Metode pembayaran belum tersedia.</div>`;
    $("#contact").value = store.get("tpk_contact", "");
    updateTotals();
    $("#overlay").hidden = false; $("#sheet").hidden = false;
    document.body.style.overflow = "hidden";
  }

  function closeSheet() {
    $("#overlay").hidden = true; $("#sheet").hidden = true;
    document.body.style.overflow = "";
  }

  function updateTotals() {
    const pay = S.payments.find(x => x.code === S.payment);
    const fee = calcFee(S.selected.price, pay);
    $("#tPrice").textContent = rupiah(S.selected.price);
    $("#tFee").textContent = rupiah(fee);
    $("#tTotal").textContent = rupiah(S.selected.price + fee);
  }

  const isContactValid = (c) => /^(\+?62|0)8\d{8,12}$/.test(c.replace(/[\s-]/g, "")) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c);

  async function pay() {
    const v = validateTarget();
    if (!v.ok) return UI.alert({ type: "warning", title: "Data belum lengkap", text: v.msg });
    if (!S.payment) return UI.toast("warning", "Pilih metode pembayaran.");
    const contact = $("#contact").value.trim();
    if (contact && !isContactValid(contact)) return UI.alert({ type: "warning", title: "Kontak tidak valid", text: "Isi nomor WhatsApp atau email yang benar, atau kosongkan." });

    const ok = await UI.confirm({
      title: "Periksa kembali pesananmu",
      text: `${S.selected.name}\nTujuan: ${v.value}${S.cat.zone ? " (" + $("#zone").value.trim() + ")" : ""}\n\nPesanan tidak dapat dibatalkan setelah diproses.`,
      confirmText: "Bayar Sekarang"
    });
    if (!ok) return;

    const btn = $("#btnPay"); btn.disabled = true; UI.loading(true);
    try {
      store.set("tpk_contact", contact);
      const res = await API.createOrder({
        sku: S.selected.sku, target: v.value, zone: $("#zone").value.trim() || null,
        payment: S.payment, contact: contact || null
      });
      pushHistory({
        orderId: res.orderId, product: S.selected.name, target: v.value,
        total: res.total, status: "pending", createdAt: new Date().toISOString()
      });
      closeSheet();
      UI.loading(false);
      if (res.payUrl) {
        await UI.alert({ type: "success", title: "Pesanan dibuat", text: `ID: ${res.orderId}\nKamu akan diarahkan ke halaman pembayaran.`, confirmText: "Lanjut Bayar" });
        location.href = res.payUrl;
      } else {
        await UI.alert({ type: "success", title: "Pesanan dibuat", text: `ID: ${res.orderId}\n${res.instruction || "Selesaikan pembayaran sesuai instruksi."}`, confirmText: "Lihat Status" });
        $("#trackId").value = res.orderId; showView("track"); doTrack();
      }
    } catch (e) {
      UI.loading(false);
      UI.alert({ type: "error", title: "Gagal membuat pesanan", text: e.message });
    } finally { btn.disabled = false; if (!$("#loader").hidden) UI.loading(false); }
  }

  /* ================= Cek pesanan ================= */
  function orderCard(o, clickable = false) {
    const st = o.status || "pending";
    const inner = `
      <div class="o-top"><span class="o-id">${esc(o.orderId)}</span><span class="status st-${esc(st)}">${esc(STATUS[st] || st)}</span></div>
      <div class="row"><span>Produk</span><b>${esc(o.product)}</b></div>
      <div class="row"><span>Tujuan</span><b>${esc(o.target)}</b></div>
      <div class="row"><span>Total</span><b>${rupiah(o.total)}</b></div>
      <div class="row"><span>Waktu</span><b>${o.createdAt ? dateTime(o.createdAt) : "-"}</b></div>
      ${o.sn ? `<div class="row"><span>SN / Token</span><b>${esc(o.sn)}</b></div>` : ""}
      ${o.message ? `<div class="row"><span>Keterangan</span><b>${esc(o.message)}</b></div>` : ""}`;
    return clickable
      ? `<button class="order" data-oid="${esc(o.orderId)}">${inner}</button>`
      : `<div class="order">${inner}</div>`;
  }

  function stopPoll() { clearInterval(S.pollTimer); S.pollTimer = null; }

  async function doTrack(silent = false) {
    const id = $("#trackId").value.trim();
    if (!id) return UI.toast("warning", "Masukkan ID pesanan.");
    if (!silent) UI.loading(true);
    try {
      const o = await API.getOrder(id);
      $("#trackResult").innerHTML = orderCard(o);
      updateHistory(o.orderId, { status: o.status, sn: o.sn });
      stopPoll();
      if (["pending", "paid", "processing"].includes(o.status)) {
        S.pollTimer = setInterval(() => doTrack(true), CFG.POLL_MS);
      } else if (!silent && o.status === "success") {
        UI.alert({ type: "success", title: "Top up berhasil", text: "Pesananmu sudah selesai diproses." });
      }
    } catch (e) {
      stopPoll();
      if (!silent) UI.alert({ type: "error", title: "Pesanan tidak ditemukan", text: e.message });
    } finally { if (!silent) UI.loading(false); }
  }

  function renderHistory() {
    const list = getHistory();
    $("#historyList").innerHTML = list.length
      ? list.map(o => orderCard(o, true)).join("")
      : `<div class="empty"><i class="fa-regular fa-clock"></i>Belum ada riwayat transaksi.</div>`;
  }

  /* ================= Legal ================= */
  const LEGAL = {
    tos: ["Syarat & Ketentuan", "1. Pesanan yang sudah dibayar dan diproses tidak dapat dibatalkan.\n2. Pastikan nomor/ID tujuan benar. Kesalahan input bukan tanggung jawab kami.\n3. Jika transaksi gagal, dana dikembalikan sesuai kebijakan yang berlaku.\n4. Harga dapat berubah sewaktu-waktu."],
    privacy: ["Kebijakan Privasi", "Kami hanya menyimpan data yang diperlukan untuk memproses pesanan (nomor tujuan dan kontak). Data tidak dijual ke pihak ketiga. Riwayat di perangkat ini disimpan lokal di browser kamu."]
  };

  /* ================= Events ================= */
  function bind() {
    $("#categories").addEventListener("click", e => { const b = e.target.closest(".cat"); if (b) openCategory(b.dataset.id); });
    $("#btnBack").onclick = closeCategory;
    $("#brands").addEventListener("click", e => {
      const b = e.target.closest(".chip"); if (!b) return;
      S.brand = b.dataset.b; S.selected = null; renderBrands(); renderProducts(); updatePickBar();
    });
    $("#products").addEventListener("click", e => {
      const b = e.target.closest(".prod"); if (!b) return;
      S.selected = S.products.find(p => p.sku === b.dataset.sku);
      renderProducts(); updatePickBar();
    });

    $("#target").addEventListener("input", onTargetInput);
    $("#btnClear").onclick = () => { $("#target").value = ""; onTargetInput(); $("#target").focus(); };
    $("#search").addEventListener("input", UI.debounce(e => {
      S.query = e.target.value.trim();
      S.cat ? renderProducts() : renderCategories();
    }, 200));

    $("#btnNext").onclick = openSheet;
    $("#btnCloseSheet").onclick = closeSheet;
    $("#overlay").onclick = closeSheet;
    $("#payList").addEventListener("click", e => {
      const b = e.target.closest(".pay"); if (!b) return;
      S.payment = b.dataset.code;
      $$(".pay").forEach(x => x.classList.toggle("active", x === b));
      updateTotals();
    });
    $("#btnPay").onclick = pay;

    $$(".nav-item").forEach(n => n.onclick = () => showView(n.dataset.view));
    $("#btnTrack").onclick = () => doTrack(false);
    $("#trackId").addEventListener("keydown", e => { if (e.key === "Enter") doTrack(false); });
    $("#historyList").addEventListener("click", e => {
      const b = e.target.closest("[data-oid]"); if (!b) return;
      $("#trackId").value = b.dataset.oid; showView("track"); doTrack();
    });
    $("#btnClearHistory").onclick = async () => {
      if (!getHistory().length) return;
      if (await UI.confirm({ title: "Hapus riwayat?", text: "Riwayat di perangkat ini akan dihapus.", confirmText: "Hapus" })) {
        store.set("tpk_history", []); renderHistory(); UI.toast("success", "Riwayat dihapus.");
      }
    };
    $("#btnWA").href = `https://wa.me/${CFG.WA_NUMBER}?text=${encodeURIComponent("Halo admin, saya butuh bantuan.")}`;
    $$("[data-legal]").forEach(a => a.onclick = (e) => {
      e.preventDefault(); const [t, x] = LEGAL[a.dataset.legal]; UI.alert({ type: "info", title: t, text: x });
    });

    window.addEventListener("online", () => UI.toast("success", "Kembali online."));
    window.addEventListener("offline", () => UI.toast("warning", "Kamu sedang offline."));
  }

  /* ================= Init ================= */
  function init() {
    initTheme(); bind(); loadCatalog();
    const id = new URLSearchParams(location.search).get("order");
    if (id) { $("#trackId").value = id; showView("track"); doTrack(); }
  }
  document.addEventListener("DOMContentLoaded", init);
})();