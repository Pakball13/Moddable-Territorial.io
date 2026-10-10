/* ============================================================
 * promo-codes.js  —  Modatorial.io promo code system
 * Codes grant upload slots, store credits, or badges.
 * ============================================================ */
(function (global) {
  'use strict';

  const PFX = '%c[Promo]';
  const STY = 'color:#fdb;font-weight:bold';
  const log  = (...a) => console.log(PFX, STY, ...a);

  const STORE_KEY = 'tt-promo-redeemed';

  /* ---------- code table ---------- */
  const CODES = {
    'HaapyG@mer': {
      name:        'HappyGamer Partner',
      badge:       '🎬',
      description: 'YouTube partner code — 5 upload slots + 50 store credits',
      grants:      { uploadSlots: 5, storeCredits: 50 },
      featuredMod: 'cannot-touch',
      featuredPano: 'happygamer-pano'
    }
  };

  /* ---------- state ---------- */
  let redeemed = [];
  try {
    const raw = localStorage.getItem(STORE_KEY);
    redeemed = raw ? JSON.parse(raw) : [];
  } catch { redeemed = []; }

  function persist() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(redeemed)); } catch {}
  }

  /* ---------- api ---------- */
  const Promo = {
    /* code → boolean */
    validate(code) {
      const key = String(code || '').trim();
      return Object.prototype.hasOwnProperty.call(CODES, key);
    },

    /* returns {ok, name, badge, grants, description} */
    redeem(code) {
      const key = String(code || '').trim();
      if (!CODES[key]) {
        return { ok: false, reason: 'Invalid code' };
      }
      if (redeemed.includes(key)) {
        return { ok: false, reason: 'Already redeemed' };
      }
      redeemed.push(key);
      persist();
      const c = CODES[key];
      log('Redeemed:', c.name);
      if (global.TerritorialMods && global.TerritorialMods.showToast) {
        global.TerritorialMods.showToast(`${c.badge} ${c.name} unlocked!`, 4000);
      }
      return Object.assign({ ok: true }, c);
    },

    /* How many upload slots do we have? */
    getUploadSlots() {
      let total = 0;
      for (const key of redeemed) {
        const c = CODES[key];
        if (c && c.grants && c.grants.uploadSlots) total += c.grants.uploadSlots;
      }
      return total;
    },

    getUploadsUsed() {
      try {
        return parseInt(localStorage.getItem('tt-uploads-used') || '0', 10);
      } catch { return 0; }
    },
    getUploadsRemaining() {
      return Math.max(0, this.getUploadSlots() - this.getUploadsUsed());
    },
    useUploadSlot() {
      const used = this.getUploadsUsed();
      const total = this.getUploadSlots();
      if (used >= total) return false;
      localStorage.setItem('tt-uploads-used', String(used + 1));
      return true;
    },

    getStoreCredits() {
      let total = 0;
      for (const key of redeemed) {
        const c = CODES[key];
        if (c && c.grants && c.grants.storeCredits) total += c.grants.storeCredits;
      }
      return total;
    },
    useStoreCredit() {
      let used = 0;
      try { used = parseInt(localStorage.getItem('tt-store-credits-used') || '0', 10); } catch {}
      if (used >= this.getStoreCredits()) return false;
      localStorage.setItem('tt-store-credits-used', String(used + 1));
      return true;
    },

    getRedeemed() {
      return redeemed.map(k => Object.assign({ code: k }, CODES[k]));
    },

    hasRedeemed(code) {
      return redeemed.includes(code);
    }
  };

  global.TerritorialPromo = Promo;
  log('Promo system ready — ' + Object.keys(CODES).length + ' code(s) loaded');
})(window);