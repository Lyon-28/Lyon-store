/*
 KONTRAK API (backend kamu yang menyediakan):

 GET  /catalog
   -> { categories:[{ id, name, icon, input:"phone|game|meter|account", zone:false,
                      label:"Nomor HP", placeholder:"08xxxxxxxxxx", hint:"" }],
        products:[{ sku, name, brand, category, price, note, badge, active:true }] }

 GET  /payments
   -> [{ code, name, icon:"fa-qrcode", info:"Semua e-wallet", fee_flat:0, fee_pct:0.7 }]

 POST /orders   body: { sku, target, zone, payment, contact }
   -> { orderId, total, payUrl?, instruction? }

 GET  /orders/:id
   -> { orderId, status:"pending|paid|processing|success|failed|expired",
        product, target, total, createdAt, sn?, message? }
*/
window.API = (() => {
  async function req(path, opts = {}) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 20000);
    try {
      const res = await fetch(CFG.API_BASE + path, {
        headers: { "Content-Type": "application/json" },
        signal: ctrl.signal,
        ...opts
      });
      let data = null;
      try { data = await res.json(); } catch (_) {}
      if (!res.ok) throw new Error((data && (data.message || data.error)) || `Terjadi kesalahan (${res.status})`);
      return data;
    } catch (e) {
      if (e.name === "AbortError") throw new Error("Koneksi lambat, coba lagi.");
      if (e instanceof TypeError) throw new Error("Tidak dapat terhubung ke server.");
      throw e;
    } finally { clearTimeout(timer); }
  }
  return {
    catalog: () => req("/catalog"),
    payments: () => req("/payments"),
    createOrder: (body) => req("/orders", { method: "POST", body: JSON.stringify(body) }),
    getOrder: (id) => req("/orders/" + encodeURIComponent(id))
  };
})();