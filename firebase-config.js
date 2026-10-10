/* ============================================================
 * firebase-config.js — Modatorial.io
 * ⚠️  DO NOT COMMIT THIS FILE TO A PUBLIC REPO  ⚠️
 * ============================================================ */

const firebaseConfig = {
  apiKey:            "AIzaSyChsQsAuk-fGuWHNLvEe2Zh1eOOrZ09LHY",                             // ← your real key
  authDomain:        "modatorial-io.firebaseapp.com",
  projectId:         "modatorial-io",
  storageBucket:     "modatorial-io.firebasestorage.app",
  messagingSenderId: "909121779443",
  appId:             "1:909121779443:web:YOUR_REAL_APP_ID",
  measurementId:     "G-ZLEXL6KDDN"
};

/* Expose globally so any script can read it */
window.MODATORIAL_FIREBASE = firebaseConfig;
window.firebaseConfig = firebaseConfig;

/* ── Auto-init (idempotent) ──────────────────────────────── */
(function () {
  if (typeof firebase === 'undefined') {
    console.warn('[Firebase] SDK not loaded yet — skipping init');
    return;
  }
  if (firebase.apps && firebase.apps.length) {
    console.log('[Firebase] Already initialized');
    return;
  }
  const cfg = window.MODATORIAL_FIREBASE;
  if (!cfg || !cfg.apiKey || String(cfg.apiKey).indexOf('PASTE_') === 0 ||
      String(cfg.apiKey).indexOf('AIzaSy...') === 0) {
    console.error('[Firebase] ⚠️ Config has placeholder values — edit firebase-config.js');
    return;
  }
  try {
    firebase.initializeApp(cfg);
    console.log('[Firebase] ✅ Initialized from firebase-config.js');
    console.log('[Firebase]    Project:', cfg.projectId);
    window.__firebaseReady = true;
    window.dispatchEvent(new Event('firebase-ready'));
  } catch (e) {
    console.error('[Firebase] ❌ Init failed:', e);
  }
})();