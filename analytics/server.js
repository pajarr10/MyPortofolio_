/**
 * =====================================================================
 *  analytics/server.js
 * =====================================================================
 *  Backend Analytics Dashboard untuk Website Portfolio.
 *
 *  STRUKTUR PROJECT (lihat README.md untuk detail):
 *
 *    project-root/
 *    ├── index.html, style.css, script.js   <- FILE PORTFOLIO, tidak diubah
 *    ├── analytics-tracker.js               <- file tambahan, additive
 *    ├── vercel.json
 *    └── analytics/                         <- SEMUA backend ada di sini
 *        ├── server.js   (file ini)
 *        ├── admin.html
 *        ├── package.json
 *        ├── lib/storage.js
 *        └── data/visit.json (fallback lokal)
 *
 *  Server ini men-serve file index.html/style.css/script.js dari ROOT
 *  project (satu level di atas folder analytics/) tanpa mengubahnya
 *  sama sekali — hanya disajikan apa adanya lewat express.static().
 *
 *  ENV VARIABLES yang dipakai:
 *    - ADMIN_KEY                    -> wajib, untuk proteksi route admin
 *    - UPSTASH_REDIS_REST_URL       -> opsional, kalau diisi pakai Redis
 *    - UPSTASH_REDIS_REST_TOKEN     -> opsional, pasangan dari URL di atas
 *
 *  Kalau UPSTASH_REDIS_REST_URL & TOKEN tidak diisi, server otomatis
 *  fallback ke file JSON lokal (analytics/data/visit.json) — cocok untuk
 *  Termux/offline. Kalau diisi, server pakai Upstash Redis — cocok untuk
 *  Vercel karena datanya persist (filesystem Vercel tidak persist).
 *
 *  Cara jalan di Termux:
 *    cd analytics
 *    npm install
 *    ADMIN_KEY=rahasia123 node server.js
 * =====================================================================
 */

const express = require("express");
const path = require("path");
const storage = require("./lib/storage"); // readVisits() / writeVisits() abstraksi

const app = express();
const PORT = process.env.PORT || 3000;

// Key admin wajib diisi lewat environment variable.
// Fallback "admin123" HANYA untuk kemudahan testing - GANTI saat production!
const ADMIN_KEY = process.env.ADMIN_KEY || "admin123";

// Batas waktu (ms) untuk anggap visit sebagai duplikat
const DUPLICATE_WINDOW_MS = 10 * 1000; // 10 detik
// Batas waktu (ms) untuk anggap visitor masih "online"
const ONLINE_WINDOW_MS = 5 * 60 * 1000; // 5 menit

// Folder root project (satu level di atas folder analytics/) -> tempat
// index.html, style.css, script.js, analytics-tracker.js berada.
const PROJECT_ROOT = path.join(__dirname, "..");

// -----------------------------------------------------------------------
// Middleware global
// -----------------------------------------------------------------------
app.use(express.json({ limit: "50kb" }));

// Serve file statis portfolio (index.html, style.css, script.js, dll)
// dari ROOT project. File-file ini TIDAK disentuh sama sekali oleh
// server ini, hanya disajikan langsung apa adanya.
app.use(express.static(PROJECT_ROOT));

// admin.html ada di DALAM folder analytics/, jadi di-serve eksplisit
// lewat route ini supaya tetap bisa diakses di /admin.html
app.get("/admin.html", (req, res) => {
  res.sendFile(path.join(__dirname, "admin.html"));
});

// -----------------------------------------------------------------------
// Helper: ambil IP publik dari request
// -----------------------------------------------------------------------
function getClientIp(req) {
  const xff = req.headers["x-forwarded-for"];
  if (xff) return xff.split(",")[0].trim();
  const ip = req.socket?.remoteAddress || "0.0.0.0";
  return ip.replace("::ffff:", "");
}

function isLocalIp(ip) {
  if (!ip) return true;
  if (
    ip === "127.0.0.1" ||
    ip === "::1" ||
    ip === "0.0.0.0" ||
    ip.startsWith("192.168.") ||
    ip.startsWith("10.")
  ) return true;
  // RFC1918: 172.16.0.0 – 172.31.255.255
  const m = ip.match(/^172\.(\d+)\./);
  if (m) {
    const octet = parseInt(m[1], 10);
    if (octet >= 16 && octet <= 31) return true;
  }
  return false;
}

// -----------------------------------------------------------------------
// Helper: geolocation dari IP publik (ip-api.com, gratis tanpa API key)
// -----------------------------------------------------------------------
async function getGeoLocation(ip) {
  if (isLocalIp(ip)) {
    return {
      negara: "Local/Unknown",
      kota: "Local/Unknown",
      region: "Local/Unknown",
      timezone: "Unknown",
    };
  }
  try {
    const response = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,country,regionName,city,timezone`
    );
    const json = await response.json();
    if (json.status === "success") {
      return {
        negara: json.country || "Unknown",
        kota: json.city || "Unknown",
        region: json.regionName || "Unknown",
        timezone: json.timezone || "Unknown",
      };
    }
  } catch (err) {
    console.error("[ERROR] Gagal mengambil geolocation:", err.message);
  }
  return { negara: "Unknown", kota: "Unknown", region: "Unknown", timezone: "Unknown" };
}

// -----------------------------------------------------------------------
// Helper: parsing User-Agent manual (tanpa library eksternal)
// -----------------------------------------------------------------------
function parseUserAgent(ua = "") {
  ua = ua || "";
  let browser = "Unknown";
  let browserVersion = "";
  let os = "Unknown";
  let device = "Desktop";
  let isMobile = false;

  if (/iPad|Tablet/i.test(ua)) {
    device = "Tablet";
    isMobile = true;
  } else if (/Mobi|Android|iPhone|iPod/i.test(ua)) {
    device = "Mobile";
    isMobile = true;
  }

  if (/Windows NT 10\.0/i.test(ua)) os = "Windows 10/11";
  else if (/Windows NT/i.test(ua)) os = "Windows";
  else if (/Mac OS X/i.test(ua)) os = "macOS";
  else if (/Android/i.test(ua)) os = "Android";
  else if (/iPhone|iPad|iPod/i.test(ua)) os = "iOS";
  else if (/Linux/i.test(ua)) os = "Linux";

  let match;
  if ((match = ua.match(/Edg\/([\d.]+)/))) {
    browser = "Edge"; browserVersion = match[1];
  } else if ((match = ua.match(/OPR\/([\d.]+)/))) {
    browser = "Opera"; browserVersion = match[1];
  } else if ((match = ua.match(/SamsungBrowser\/([\d.]+)/))) {
    browser = "Samsung Internet"; browserVersion = match[1];
  } else if (/Chrome\/([\d.]+)/.test(ua) && !/Edg|OPR/.test(ua)) {
    match = ua.match(/Chrome\/([\d.]+)/);
    browser = "Chrome"; browserVersion = match[1];
  } else if (/Firefox\/([\d.]+)/.test(ua)) {
    match = ua.match(/Firefox\/([\d.]+)/);
    browser = "Firefox"; browserVersion = match[1];
  } else if (/Version\/([\d.]+).*Safari/.test(ua)) {
    match = ua.match(/Version\/([\d.]+)/);
    browser = "Safari"; browserVersion = match[1];
  } else if (/Safari\/([\d.]+)/.test(ua)) {
    match = ua.match(/Safari\/([\d.]+)/);
    browser = "Safari"; browserVersion = match[1];
  }

  return { browser, browserVersion, os, device, isMobile };
}

// -----------------------------------------------------------------------
// Middleware: proteksi route admin dengan header x-admin-key
// -----------------------------------------------------------------------
function requireAdminKey(req, res, next) {
  const key = req.headers["x-admin-key"];
  if (!key || key !== ADMIN_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// =========================================================================
//  POST /api/visit
// =========================================================================
app.post("/api/visit", async (req, res) => {
  try {
    const ip = getClientIp(req);
    const ua = req.headers["user-agent"] || "";
    const { browser, browserVersion, os, device, isMobile } = parseUserAgent(ua);

    const body = req.body || {};
    const page = (body.page || req.headers["referer"] || "/").slice(0, 300);
    const referrer = (body.referrer || "Direct").slice(0, 300);
    const language =
      (body.language || (req.headers["accept-language"] || "Unknown").split(",")[0]).slice(0, 50);
    const screenResolution = (body.screenResolution || "Unknown").slice(0, 30);

    const visits = await storage.readVisits();
    const now = Date.now();

    // ---- Cegah data duplikat: IP + halaman sama dalam window waktu tertentu ----
    const isDuplicate = visits.some((v) => {
      const sameVisitor = v.ip === ip && v.halaman === page;
      const withinWindow = now - new Date(v.timestamp).getTime() < DUPLICATE_WINDOW_MS;
      return sameVisitor && withinWindow;
    });

    if (isDuplicate) {
      return res.status(200).json({ message: "Duplicate visit, dilewati" });
    }

    const geo = await getGeoLocation(ip);

    const newVisit = {
      id: `${now}-${Math.random().toString(36).slice(2, 9)}`,
      timestamp: new Date().toISOString(),
      ip,
      negara: geo.negara,
      kota: geo.kota,
      region: geo.region,
      timezone: geo.timezone,
      browser,
      browserVersion,
      os,
      device,
      isMobile,
      language,
      screenResolution,
      halaman: page,
      referrer,
      userAgent: ua,
      online: true,
    };

    visits.push(newVisit);
    await storage.writeVisits(visits);

    res.status(201).json({ message: "Visit recorded", data: newVisit });
  } catch (err) {
    console.error("[ERROR] POST /api/visit:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// =========================================================================
//  GET /api/stats   (PROTECTED)
// =========================================================================
app.get("/api/stats", requireAdminKey, async (req, res) => {
  try {
    const visits = await storage.readVisits();
    const now = new Date();

    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfToday.getDate() - startOfToday.getDay());
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const onlineThreshold = new Date(now.getTime() - ONLINE_WINDOW_MS);

    const visitorHariIni = visits.filter((v) => new Date(v.timestamp) >= startOfToday).length;
    const visitorMingguIni = visits.filter((v) => new Date(v.timestamp) >= startOfWeek).length;
    const visitorBulanIni = visits.filter((v) => new Date(v.timestamp) >= startOfMonth).length;
    const onlineSekarang = visits.filter((v) => new Date(v.timestamp) >= onlineThreshold).length;
    const totalMobile = visits.filter((v) => v.isMobile).length;
    const totalDesktop = visits.filter((v) => !v.isMobile).length;

    function countBy(key) {
      const map = {};
      visits.forEach((v) => {
        const k = v[key] || "Unknown";
        map[k] = (map[k] || 0) + 1;
      });
      return map;
    }

    const visitorPerHari = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      visitorPerHari[key] = 0;
    }
    visits.forEach((v) => {
      const key = (v.timestamp || "").slice(0, 10);
      if (key in visitorPerHari) visitorPerHari[key]++;
    });

    res.json({
      totalVisitor: visits.length,
      visitorHariIni,
      visitorMingguIni,
      visitorBulanIni,
      onlineSekarang,
      totalMobile,
      totalDesktop,
      browserList: countBy("browser"),
      osList: countBy("os"),
      negaraList: countBy("negara"),
      halamanList: countBy("halaman"),
      visitorPerHari,
      visitors: visits.slice().reverse(),
    });
  } catch (err) {
    console.error("[ERROR] GET /api/stats:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// =========================================================================
//  DELETE /api/clear   (PROTECTED)
// =========================================================================
app.delete("/api/clear", requireAdminKey, async (req, res) => {
  try {
    await storage.writeVisits([]);
    res.json({ message: "Semua data visitor berhasil dihapus" });
  } catch (err) {
    console.error("[ERROR] DELETE /api/clear:", err.message);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// -----------------------------------------------------------------------
// Jalankan server secara lokal (Termux/VPS). Di Vercel, file ini
// dipanggil sebagai module oleh runtime serverless-nya sehingga
// app.listen() tidak otomatis jalan dua kali.
// -----------------------------------------------------------------------
if (require.main === module) {
  app.listen(PORT, () => {
    console.log("=================================================");
    console.log(`  Server analytics berjalan di http://localhost:${PORT}`);
    console.log(`  Dashboard admin: http://localhost:${PORT}/admin.html`);
    console.log(`  Storage aktif  : ${storage.getStorageInfo()}`);
    console.log("=================================================");
  });
}

module.exports = app;
