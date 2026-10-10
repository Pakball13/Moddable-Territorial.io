/* ============================================================
 * account.js  —  stats tracker + My Account redirect
 * v1.2.0: reliable win/loss detection via aE.a2L
 * ============================================================ */
(function (global) {
  'use strict';

  const PREFIX = '%c[Account]';
  const STYLE  = 'color:#6cf;font-weight:bold';
  const log    = (...a) => console.log(PREFIX, STYLE, ...a);
  const warn   = (...a) => console.warn(PREFIX, STYLE, ...a);

  const KEY = 'tt-account-v1';

  /* ---------- state ---------- */
  const defaultState = () => ({
    gamesPlayed: 0, wins: 0, losses: 0, surrenders: 0,
    playtimeMs: 0, xp: 0, lastMods: [], usernames: [],
    history: [], firstSeen: Date.now(), lastSeen: Date.now()
  });
  let state = defaultState();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = Object.assign(defaultState(), JSON.parse(raw));
  } catch (e) { warn('Could not load state:', e); }

  function save() {
    state.lastSeen = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
  }

  /* ---------- XP curve ---------- */
  const xpForLevel = lvl => 50 * lvl * lvl + 50 * lvl;
  function levelFromXp(xp) { let l = 0; while (xp >= xpForLevel(l + 1)) l++; return l; }

  /* ---------- match tracking ---------- */
  let matchStart      = 0;
  let matchMods       = [];
  let recorded        = false;
  let cachedOutcome   = null;   // 'win' if aE.a2L became 1 at any point
  let cachedSnapshot  = null;   // last-known alive/territory state
  let wasInMatch      = false;

  function getTT() {
    return global.TerritorialMods && global.TerritorialMods.getGame
      ? global.TerritorialMods.getGame() : null;
  }
  function isInMatch() {
    const TT = getTT();
    return !!(TT && TT.aE && TT.aE.a2G === 1);
  }

  function snapshotMods() {
    const API = global.TerritorialMods;
    if (!API || !API.mods) return [];
    const out = [];
    for (const m of API.mods.values()) {
      if (m.status === 'loaded') out.push(m.name || m.id);
    }
    return out;
  }

  function beginMatch() {
    matchStart     = performance.now();
    matchMods      = snapshotMods();
    recorded       = false;
    cachedOutcome  = null;
    cachedSnapshot = null;
    log('Match started');
  }

  function endMatch(outcome) {
    if (recorded || !matchStart) return;
    recorded = true;

    const elapsed = performance.now() - matchStart;
    state.playtimeMs += elapsed;
    state.gamesPlayed++;

    if (outcome === 'win')            state.wins++;
    else if (outcome === 'loss')      state.losses++;
    else if (outcome === 'surrender') state.surrenders++;

    let xpGained = 10;
    if (outcome === 'win')       xpGained += 50;
    else if (outcome === 'loss') xpGained += 5;
    state.xp += xpGained;

    state.history.unshift({
      ts: Date.now(),
      outcome,
      durationMs: elapsed,
      mods: matchMods
    });
    if (state.history.length > 100) state.history.length = 100;
    state.lastMods = matchMods.slice();
    save();

    log(`Match recorded — ${outcome} · +${xpGained} XP · lasted ${Math.round(elapsed/1000)}s`);

    if (global.TerritorialMods && global.TerritorialMods.showToast) {
      const emoji = outcome === 'win' ? '🏆' : outcome === 'surrender' ? '🏳️' : '💀';
      const label = outcome === 'win' ? 'Victory' : outcome === 'surrender' ? 'Surrender' : 'Defeat';
      global.TerritorialMods.showToast(`${emoji} ${label} · +${xpGained} XP`, 2500);
    }

    matchStart = 0;
  }

  /* ---------- outcome detection ----------
   * The game sets aE.a2L when a match concludes:
   *   a2L === 1  → you are the winner
   *   a2L === 0  → you lost
   *   a2L === 2  → special end (stalemate / team loss)
   * We poll every 250 ms, cache the outcome as soon as we see it,
   * and confirm on the 1 → 0 transition of a2G.
   *
   * We also fall back to a snapshot if a2L never flipped (rare).
   */
  function pollMatch() {
    const TT = getTT();
    if (!TT || !TT.aE) { wasInMatch = false; return; }

    const inMatch = TT.aE.a2G === 1;

    /* ---- cache while in match ---- */
    if (inMatch) {
      /* primary signal */
      if (TT.aE.a2L === 1)      cachedOutcome = 'win';
      else if (TT.aE.a2L === 2) cachedOutcome = cachedOutcome || 'loss';

      /* secondary fallback snapshot */
      try {
        const me = TT.aE.fJ;
        if (TT.ah && TT.ah.nU && TT.ah.hN) {
          cachedSnapshot = {
            alive:     TT.ah.nU[me] !== 0,
            territory: TT.ah.hN[me] || 0,
            a2D:       TT.aE.a2D
          };
        }
      } catch {}
    }

    /* ---- state transitions ---- */
    if (inMatch && !wasInMatch) beginMatch();

    if (!inMatch && wasInMatch && matchStart) {
      /* Use cached outcome first */
      let outcome = cachedOutcome;

      /* Fallback: infer from snapshot */
      if (!outcome) {
        const s = cachedSnapshot;
        if (s && s.a2D === 2)                       outcome = 'surrender';
        else if (s && s.alive && s.territory > 0)   outcome = 'win';
        else                                        outcome = 'loss';
      }

      /* Final safety: if we ever cached 'win', trust it */
      if (cachedOutcome === 'win') outcome = 'win';

      endMatch(outcome);
    }

    wasInMatch = inMatch;
  }

  /* Fast poll (250 ms) for accuracy */
  setInterval(pollMatch, 250);

  /* ---------- username tracking ---------- */
  function trackUsername() {
    const inp = document.getElementById('input0');
    const name = inp && inp.value ? inp.value.trim() : null;
    if (!name) return;
    if (!state.usernames.includes(name)) {
      state.usernames.push(name);
      if (state.usernames.length > 20) state.usernames.shift();
      save();
    }
  }
  document.addEventListener('input', e => {
    if (e.target && e.target.id === 'input0') trackUsername();
  }, true);
  setTimeout(trackUsername, 2000);

  /* ---------- My Account redirect ---------- */
  function openAccount() {
    try { sessionStorage.setItem('tt-account-return', location.href); } catch {}
    log('Navigating to account.html');
    location.href = 'account.html';
  }
  function closeAccount() {
    let dest = 'game.html';
    try {
      const back = sessionStorage.getItem('tt-account-return');
      if (back) dest = back;
    } catch {}
    location.href = dest;
  }

  /* ---------- intercept the "My Account" button ---------- */
  function isAccountButton(el) {
    if (!el || el.tagName !== 'BUTTON') return false;
    if (el.parentElement !== document.body) return false;
    if (el.dataset && el.dataset.ttOur === '1') return false;

    const label =
      (el.dataset && el.dataset.ttLabel) ||
      (el.querySelector && el.querySelector('.tt-btn-label') &&
       el.querySelector('.tt-btn-label').textContent) ||
      el.textContent ||
      '';
    return /My Account/i.test(label);
  }

  document.addEventListener('click', e => {
    const btn = e.target.closest('button');
    if (isAccountButton(btn)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      e.stopPropagation();
      openAccount();
    }
  }, true);

  /* ---------- public ---------- */
  global.TerritorialAccount = {
    open:   openAccount,
    close:  closeAccount,
    stats:  () => Object.assign({}, state, { level: levelFromXp(state.xp) }),
    reset:  () => { state = defaultState(); save(); },
    /* dev tools */
    forceRecordWin:  () => endMatch('win'),
    forceRecordLoss: () => endMatch('loss'),
    /* debug info */
    _debug: () => ({
      inMatch:       isInMatch(),
      cachedOutcome,
      cachedSnapshot,
      wasInMatch
    })
  };

  /* ---------- init ---------- */
  function init() {
    log(`Account module ready — ${state.gamesPlayed} games, level ${levelFromXp(state.xp)}`);
    if (global.TerritorialMods && global.TerritorialMods.on) {
      global.TerritorialMods.on('ready', () => log('ModLoader ready — tracking active'));
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else init();

})(window);