/**
 * =====================================================================
 *  analytics-tracker.js
 * =====================================================================
 *  File TAMBAHAN (bukan bagian dari script.js Anda yang sudah ada).
 *  File ini HANYA mengirim data visit ke backend, dan TIDAK menyentuh
 *  / mengubah animasi, gallery, navbar, contact form, atau fitur lain
 *  di script.js milik Anda.
 *
 *  CARA PASANG (tanpa mengedit script.js):
 *  Tambahkan SATU baris ini di index.html, tepat SEBELUM tag
 *  <script src="script.js"></script> atau setelahnya — urutan tidak
 *  masalah karena file ini berdiri sendiri:
 *
 *      <script src="analytics-tracker.js"></script>
 *
 *  Itu satu-satunya perubahan yang diperlukan di index.html, dan
 *  sifatnya hanya MENAMBAHKAN, tidak mengubah elemen/desain yang ada.
 * =====================================================================
 */

(function () {
  // Kirim data visit ke backend setiap kali halaman dimuat
  function sendVisit() {
    const payload = {
      page: window.location.pathname || "/",
      referrer: document.referrer || "Direct",
      language: navigator.language || "Unknown",
      screenResolution: `${window.screen.width}x${window.screen.height}`,
    };

    fetch("/api/visit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true, // pastikan request terkirim walau user langsung pindah halaman
    }).catch((err) => {
      // Diam-diam gagal saja, jangan sampai mengganggu pengalaman user di portfolio
      console.warn("Analytics tracker gagal mengirim data:", err.message);
    });
  }

  // Kirim saat halaman selesai load
  if (document.readyState === "complete") {
    sendVisit();
  } else {
    window.addEventListener("load", sendVisit);
  }
})();
