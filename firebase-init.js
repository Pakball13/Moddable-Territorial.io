/* ============================================================
 * firebase-init.js — Modatorial.io
 * MUST run after the Firebase SDKs and BEFORE auth.js / mod-store.js
 * ============================================================ */
(function () {
  'use strict';

  if (!window.firebase) {
    console.error('[Firebase] SDK not loaded. Check <script> order in game.html.');
    return;
  }
  if (firebase.apps && firebase.apps.length) {
    console.log('[Firebase] ✅ Already initialized');
    return;
  }

  /* ═════════════════════════════════════════════════════════
     ⚠️  REPLACE EVERY VALUE BELOW with the real ones from
         Firebase Console → Project Settings → General →
         Your apps → Web app → SDK setup and configuration
     ═════════════════════════════════════════════════════════ */
  const firebaseConfig = {
    apiKey:            "PASTE_YOUR_API_KEY_HERE",
    authDomain:        "modatorial-io.firebaseapp.com",
    projectId:         "modatorial-io",
    storageBucket:     "modatorial-io.appspot.com",
    messagingSenderId: "PASTE_YOUR_SENDER_ID",
    appId:             "PASTE_YOUR_APP_ID"
  };

  // Warn loudly if placeholders are still there
  if (firebaseConfig.apiKey.startsWith('PASTE_')) {
    console.error('[Firebase] ❌ Config still has placeholder values!');
    console.error('[Firebase]    Open firebase-init.js and paste real values');
    console.error('[Firebase]    from Firebase Console → Project Settings.');
    return;
  }

  try {
    firebase.initializeApp(firebaseConfig);
    console.log('[Firebase] ✅ Initialized');
    window.__firebaseReady = true;
    window.dispatchEvent(new Event('firebase-ready'));
  } catch (e) {
    console.error('[Firebase] ❌ Init failed:', e);
  }
})();