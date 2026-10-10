/* ============================================================
 * moddables.js  —  Modatorial.io currency system
 * Earn Moddables by playing, spend them on premium mods,
 * tip creators, or feature your own mods.
 * ============================================================ */
(function (global) {
  'use strict';

  const PFX = '%c[Moddables]';
  const STY = 'color:#c9f;font-weight:bold';
  const log   = (...a) => console.log(PFX, STY, ...a);
  const warn  = (...a) => console.warn(PFX, STY, ...a);

  const KEY_BALANCE = 'tt-moddables';
  const KEY_OWNED   = 'tt-owned-mods';
  const KEY_DAILY   = 'tt-moddables-daily';
  const KEY_HISTORY = 'tt-moddables-history';

  /* ---------- reward table ---------- */
  const REWARDS = {
    matchPlayed:   5,
    matchWon:      15,
    matchLost:     2,
    achievement:   25,
    dailyLogin:    10,
    modPublished:  50,
    firstPublishToday: 25
  };

  /* ---------- state ---------- */
  const Moddables = {
    /* ---- balance ---- */
    balance() {
      return parseInt(localStorage.getItem(KEY_BALANCE) || '0', 10) || 0;
    },
    setBalance(v) {
      v = Math.max(0, Math.floor(v));
      localStorage.setItem(KEY_BALANCE, String(v));
      this._updateChromeDisplay();
      this._emitChange(v);
    },

    /* ---- earn ---- */
    earn(amount, reason) {
      amount = Math.max(0, Math.floor(amount));
      if (amount === 0) return this.balance();
      const before = this.balance();
      this.setBalance(before + amount);
      this._addHistory(amount, reason || 'Earned');
      if (global.TerritorialMods?.showToast) {
        global.TerritorialMods.showToast(`💎 +${amount} Moddables · ${reason || ''}`, 3000);
      }
      log(`+${amount} (${reason}) → ${this.balance()}`);
      return this.balance();
    },

    /* ---- spend ---- */
    spend(amount, reason) {
      amount = Math.max(0, Math.floor(amount));
      if (this.balance() < amount) {
        return { ok: false, error: `Need 💎${amount}, have 💎${this.balance()}` };
      }
      this.setBalance(this.balance() - amount);
      this._addHistory(-amount, reason || 'Spent');
      log(`-${amount} (${reason}) → ${this.balance()}`);
      return { ok: true, balance: this.balance() };
    },

    /* ---- ownership ---- */
    owns(modId) {
      try {
        return JSON.parse(localStorage.getItem(KEY_OWNED) || '[]').includes(modId);
      } catch { return false; }
    },
    own(modId) {
      try {
        const owned = JSON.parse(localStorage.getItem(KEY_OWNED) || '[]');
        if (!owned.includes(modId)) {
          owned.push(modId);
          localStorage.setItem(KEY_OWNED, JSON.stringify(owned));
        }
      } catch {}
    },
    ownedList() {
      try { return JSON.parse(localStorage.getItem(KEY_OWNED) || '[]'); }
      catch { return []; }
    },

    /* ---- purchase flow ---- */
    purchase(modDoc) {
      if (!modDoc || !modDoc.id) return { ok: false, error: 'Invalid mod' };
      if (this.owns(modDoc.id)) return { ok: false, error: 'Already owned' };
      const price = Number(modDoc.price) || 0;
      if (price > 0) {
        const result = this.spend(price, `Bought "${modDoc.name}"`);
        if (!result.ok) return result;
      }
      this.own(modDoc.id);
      return { ok: true, spent: price };
    },

    /* ---- daily login ---- */
    claimDaily() {
      const today = new Date().toISOString().slice(0, 10);
      const last = localStorage.getItem(KEY_DAILY);
      if (last === today) return false;
      localStorage.setItem(KEY_DAILY, today);
      this.earn(REWARDS.dailyLogin, 'Daily login bonus');
      return true;
    },

    /* ---- history ---- */
    history() {
      try { return JSON.parse(localStorage.getItem(KEY_HISTORY) || '[]'); }
      catch { return []; }
    },
    _addHistory(delta, reason) {
      try {
        const h = JSON.parse(localStorage.getItem(KEY_HISTORY) || '[]');
        h.unshift({ ts: Date.now(), delta, reason });
        if (h.length > 100) h.length = 100;
        localStorage.setItem(KEY_HISTORY, JSON.stringify(h));
      } catch {}
    },

    /* ---- chrome bar display ---- */
    _updateChromeDisplay() {
      const el = document.getElementById('tt-moddables-balance');
      if (el) el.textContent = '💎 ' + this.balance();
    },

    /* ---- pub/sub ---- */
    _emitChange(balance) {
      try {
        global.dispatchEvent(new CustomEvent('tt-moddables-change', {
          detail: { balance }
        }));
      } catch {}
    }
  };

  /* ============================================================
   * EARNING HOOKS
   * ============================================================ */

  /* ---- 1. Match outcomes (from account.js) ---- */
  global.addEventListener('tt-account-outcome', e => {
    const outcome = e.detail && e.detail.outcome;
    if (outcome === 'win') {
      Moddables.earn(REWARDS.matchPlayed + REWARDS.matchWon, 'Match win');
    } else if (outcome === 'loss') {
      Moddables.earn(REWARDS.matchPlayed + REWARDS.matchLost, 'Match played');
    } else if (outcome === 'surrender') {
      Moddables.earn(REWARDS.matchPlayed, 'Match played');
    }
  });

  /* ---- 2. Achievements (from client-features.js) ---- */
  const toastObserver = new MutationObserver(muts => {
    for (const m of muts) {
      for (const n of m.addedNodes) {
        if (!(n instanceof HTMLElement)) continue;
        const t = n.textContent || '';
        if (t.includes('🏆 Achievement:')) {
          Moddables.earn(REWARDS.achievement, 'Achievement unlocked');
        }
      }
    }
  });
  toastObserver.observe(document.body, { childList: true });

  /* ---- 3. Mod publication (patch made by store below) ---- */
  /* Nothing to do — the store calls Moddables.rewardPublish() */

  Moddables.rewardPublish = function (modName) {
    this.earn(REWARDS.modPublished, `Published "${modName}"`);
  };

  /* ---- 4. Daily login on load ---- */
  setTimeout(() => Moddables.claimDaily(), 1500);

  /* ============================================================
   * HISTORY MODAL
   * ============================================================ */
  function openHistory() {
    const overlay = document.createElement('div');
    overlay.dataset.ttOur = '1';
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.85)',
      zIndex: 100007, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px', fontFamily: 'system-ui'
    });
    const panel = document.createElement('div');
    panel.style.cssText =
      'background:#161b22;border:1px solid #30363d;border-radius:12px;' +
      'padding:24px;max-width:520px;width:100%;max-height:80vh;overflow-y:auto;color:#fff;';

    const bal = Moddables.balance();
    panel.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <div style="font-size:20px;font-weight:700;">💎 Moddables</div>
        <button id="tt-md-close" style="background:none;border:0;color:#fff;font-size:18px;cursor:pointer;">✕</button>
      </div>
      <div style="text-align:center;padding:16px 0;font-size:36px;font-weight:900;color:#c9f;">
        ${bal.toLocaleString()}
      </div>
      <div style="text-align:center;font-size:12px;opacity:.6;margin-bottom:16px;">
        Earn by playing, spend on premium mods
      </div>
      <div style="font-size:12px;font-weight:700;opacity:.7;text-transform:uppercase;letter-spacing:.8px;margin-bottom:8px;">
        Recent activity
      </div>
      <div id="tt-md-history" style="display:flex;flex-direction:column;gap:6px;font-size:13px;"></div>
    `;
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    /* fill history */
    const hist = Moddables.history();
    const list = panel.querySelector('#tt-md-history');
    if (!hist.length) {
      list.innerHTML = '<div style="opacity:.5;font-style:italic;text-align:center;padding:20px;">No activity yet. Play a match!</div>';
    } else {
      hist.slice(0, 20).forEach(h => {
        const row = document.createElement('div');
        row.style.cssText =
          'display:flex;justify-content:space-between;padding:6px 10px;' +
          'background:#0d1117;border-radius:6px;';
        const color = h.delta > 0 ? '#3fb950' : '#f85149';
        const sign = h.delta > 0 ? '+' : '';
        row.innerHTML =
          `<div style="flex:1;opacity:.85;">${h.reason}</div>
           <div style="font-weight:700;color:${color};">${sign}${h.delta}</div>`;
        list.appendChild(row);
      });
    }

    panel.querySelector('#tt-md-close').addEventListener('click', () => overlay.remove());
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { overlay.remove(); document.removeEventListener('keydown', esc); }
    });
  }

  /* ============================================================
   * CHROME BAR WIDGET INJECTION
   * ============================================================ */
  function injectBalanceWidget() {
    const chrome = document.getElementById('tt-chrome');
    if (!chrome) return;
    if (chrome.querySelector('#tt-moddables-balance')) return;

    const btn = document.createElement('button');
    btn.id = 'tt-moddables-balance';
    btn.dataset.ttOur = '1';
    btn.textContent = '💎 ' + Moddables.balance();
    btn.title = 'Moddables — click for history';
    Object.assign(btn.style, {
      background: 'rgba(200,150,255,0.12)',
      color: '#e8eaf0',
      border: '1px solid rgba(200,150,255,0.35)',
      borderRadius: '6px',
      padding: '3px 10px',
      fontFamily: 'inherit',
      fontSize: '12px',
      fontWeight: '700',
      cursor: 'pointer',
      transition: 'background .12s'
    });
    btn.addEventListener('mouseenter', () => btn.style.background = 'rgba(200,150,255,0.22)');
    btn.addEventListener('mouseleave', () => btn.style.background = 'rgba(200,150,255,0.12)');
    btn.addEventListener('click', openHistory);

    /* Insert right before the mute button */
    const muteBtn = chrome.querySelector('button[title*="audio" i]')
                 || chrome.querySelector('button[title*="mute" i]');
    if (muteBtn) chrome.insertBefore(btn, muteBtn);
    else chrome.appendChild(btn);
  }
  setInterval(injectBalanceWidget, 500);

  /* ============================================================
   * PUBLIC
   * ============================================================ */
  global.Moddables = Moddables;
  global.TerritorialModdables = {
    balance: () => Moddables.balance(),
    earn:    (n, r) => Moddables.earn(n, r),
    spend:   (n, r) => Moddables.spend(n, r),
    history: () => Moddables.history(),
    owns:    id => Moddables.owns(id),
    reset:   () => { Moddables.setBalance(0); localStorage.removeItem(KEY_OWNED); localStorage.removeItem(KEY_HISTORY); }
  };

  log('💎 Moddables ready — balance:', Moddables.balance());

})(window);