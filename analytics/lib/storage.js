/**
 * =====================================================================
 *  lib/storage.js
 * =====================================================================
 *  Abstraksi penyimpanan data visitor. Mendukung 2 mode otomatis:
 *
 *  1. UPSTASH REDIS (direkomendasikan untuk Vercel)
 *     Aktif kalau env UPSTASH_REDIS_REST_URL & UPSTASH_REDIS_REST_TOKEN
 *     di-set. Data disimpan permanen di Redis, jadi AMAN dipakai di
 *     Vercel serverless (filesystem Vercel read-only & tidak persist,
 *     tapi Redis di luar itu jadi datanya tetap nyimpen).
 *
 *  2. FILE JSON LOKAL (fallback untuk Termux / VPS / dev lokal)
 *     Aktif otomatis kalau env Redis di atas TIDAK di-set.
 *     Data disimpan di analytics/data/visit.json seperti biasa.
 *
 *  Route di server.js tidak perlu tahu backend mana yang dipakai -
 *  tinggal panggil readVisits() / writeVisits() seperti biasa.
 * =====================================================================
 */

const fs = require("fs");
const path = require("path");

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL || "";
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || "";
const USE_REDIS = Boolean(UPSTASH_URL && UPSTASH_TOKEN);

const REDIS_KEY = "portfolio:visits"; // key tunggal tempat seluruh array visitor disimpan

// -----------------------------------------------------------------------
// Mode FILE JSON (fallback lokal / Termux)
// -----------------------------------------------------------------------
const DATA_DIR = path.join(__dirname, "..", "data");
const VISIT_FILE = path.join(DATA_DIR, "visit.json");

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(VISIT_FILE)) fs.writeFileSync(VISIT_FILE, "[]", "utf-8");
}

function readVisitsFromFile() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(VISIT_FILE, "utf-8");
    return JSON.parse(raw || "[]");
  } catch (err) {
    console.error("[STORAGE] Gagal membaca visit.json:", err.message);
    return [];
  }
}

function writeVisitsToFile(visits) {
  ensureDataFile();
  fs.writeFileSync(VISIT_FILE, JSON.stringify(visits, null, 2), "utf-8");
}

// -----------------------------------------------------------------------
// Mode UPSTASH REDIS (REST API, tanpa perlu install package redis client)
// Dokumentasi: https://upstash.com/docs/redis/features/restapi
// -----------------------------------------------------------------------

/**
 * Mengirim satu command Redis lewat REST API Upstash.
 * Contoh: redisCommand(["GET", "key"]) atau redisCommand(["SET", "key", "value"])
 */
async function redisCommand(command) {
  const res = await fetch(UPSTASH_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Upstash REST error (${res.status}): ${text}`);
  }

  const json = await res.json();
  return json.result;
}

async function readVisitsFromRedis() {
  try {
    const raw = await redisCommand(["GET", REDIS_KEY]);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error("[STORAGE] Gagal membaca dari Redis:", err.message);
    return [];
  }
}

async function writeVisitsToRedis(visits) {
  try {
    await redisCommand(["SET", REDIS_KEY, JSON.stringify(visits)]);
  } catch (err) {
    console.error("[STORAGE] Gagal menulis ke Redis:", err.message);
  }
}

// -----------------------------------------------------------------------
// Public API - dipakai oleh server.js, otomatis pilih backend yang aktif
// -----------------------------------------------------------------------

/** Membaca seluruh data visitor (array) */
async function readVisits() {
  return USE_REDIS ? readVisitsFromRedis() : readVisitsFromFile();
}

/** Menulis ulang seluruh data visitor (array) */
async function writeVisits(visits) {
  return USE_REDIS ? writeVisitsToRedis(visits) : writeVisitsToFile(visits);
}

/** Info backend mana yang sedang aktif (ditampilkan di log saat start) */
function getStorageInfo() {
  return USE_REDIS
    ? "Upstash Redis (persist di Vercel & lokal)"
    : `File JSON lokal (${VISIT_FILE})`;
}

module.exports = { readVisits, writeVisits, getStorageInfo, USE_REDIS };
