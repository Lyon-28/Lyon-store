window.CFG = {
  APP_NAME: "TopupKu",
  API_BASE: "/api", // ganti ke URL backend kamu
  WA_NUMBER: "6283812310254", // nomor admin, format 62xxx
  POLL_MS: 8000, // interval cek status otomatis
  HISTORY_MAX: 30,
  // kata kunci nama brand untuk deteksi operator dari prefix nomor
  OPERATORS: [
    { key: "telkomsel", name: "Telkomsel", prefix: ["0811", "0812", "0813", "0821", "0822", "0823", "0851", "0852", "0853"] },
    { key: "indosat", name: "Indosat", prefix: ["0814", "0815", "0816", "0855", "0856", "0857", "0858"] },
    { key: "xl", name: "XL", prefix: ["0817", "0818", "0819", "0859", "0877", "0878"] },
    { key: "axis", name: "Axis", prefix: ["0831", "0832", "0833", "0838"] },
    { key: "tri", name: "Tri", prefix: ["0895", "0896", "0897", "0898", "0899"] },
    { key: "smartfren", name: "Smartfren", prefix: ["0881", "0882", "0883", "0884", "0885", "0886", "0887", "0888", "0889"] }
  ]
};