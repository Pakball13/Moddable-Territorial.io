/* ============================================================
 * client-features.js  —  Modatorial.io feature bundle v2.0
 *  1. Loadout Profiles
 *  2. Replay Theater
 *  3. Achievements & Badges
 *  4. Custom Sound Packs
 *  5. Live Stats Overlay
 *  6. Share Setup via URL
 *  7. Discord Rich Presence (web stub)
 *  8. Announcer Voice Packs
 *  9. Speedrun Mode
 * 10. Misc (screenshots, birthday mode, etc.)
 * ============================================================ */
(function (global) {
  'use strict';

  const PFX = '%c[Features]';
  const STY = 'color:#9cf;font-weight:bold';
  const log   = (...a) => console.log(PFX, STY, ...a);
  const warn  = (...a) => console.warn(PFX, STY, ...a);
  const error = (...a) => console.error(PFX, STY, ...a);

  const API = global.TerritorialMods;
  if (!API) { warn('ModLoader not found — client-features.js skipped'); return; }

  /* ============================================================
   * 1. LOADOUT PROFILES
   * ============================================================ */
  const PROFILES_KEY = 'tt-profiles';
  const ACTIVE_KEY   = 'tt-active-profile';

  function readProfiles() {
    try { return JSON.parse(localStorage.getItem(PROFILES_KEY) || '{}'); }
    catch { return {}; }
  }
  function saveProfiles(p) {
    localStorage.setItem(PROFILES_KEY, JSON.stringify(p));
  }

  const Profiles = {
    list() { return Object.keys(readProfiles()); },
    save(name) {
      if (!name) throw new Error('Profile name required');
      const rawDisabled = localStorage.getItem('tt-disabled-mods');
      let disabled = [];
      try { disabled = rawDisabled ? JSON.parse(rawDisabled) : []; } catch {}
      const snap = {
        disabled,
        theme:    localStorage.getItem('tt-theme') || 'midnight',
        layout:   localStorage.getItem('tt-layout') || 'sidebar',
        sidebar:  localStorage.getItem('tt-sidebar-collapsed') || '0',
        username: (document.getElementById('input0') || {}).value || '',
        hidden:   localStorage.getItem('tt-hidemenu') || '1',
        ts:       Date.now()
      };
      const p = readProfiles();
      p[name] = snap;
      saveProfiles(p);
      localStorage.setItem(ACTIVE_KEY, name);
      return true;
    },
    load(name) {
      const p = readProfiles();
      const s = p[name];
      if (!s) throw new Error('No such profile');
      localStorage.setItem('tt-disabled-mods', JSON.stringify(s.disabled || []));
      localStorage.setItem('tt-theme', s.theme || 'midnight');
      localStorage.setItem('tt-layout', s.layout || 'sidebar');
      localStorage.setItem('tt-sidebar-collapsed', s.sidebar || '0');
      localStorage.setItem('tt-hidemenu', s.hidden || '1');
      if (s.username && document.getElementById('input0')) {
        document.getElementById('input0').value = s.username;
      }
      localStorage.setItem(ACTIVE_KEY, name);
      location.reload();
    },
    remove(name) {
      const p = readProfiles();
      delete p[name];
      saveProfiles(p);
      if (localStorage.getItem(ACTIVE_KEY) === name) localStorage.removeItem(ACTIVE_KEY);
    },
    active() { return localStorage.getItem(ACTIVE_KEY); }
  };

  function injectProfilesButton() {
    const chrome = document.getElementById('tt-chrome');
    if (!chrome || chrome.querySelector('[data-tt-feature="profiles"]')) return;
    const btn = document.createElement('button');
    btn.dataset.ttOur = '1';
    btn.dataset.ttFeature = 'profiles';
    btn.textContent = '📁';
    btn.title = 'Manage loadout profiles';
    Object.assign(btn.style, {
      background: 'rgba(255,255,255,0.06)', color: '#e8eaf0',
      border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px',
      padding: '3px 10px', fontFamily: 'inherit', fontSize: '12px',
      cursor: 'pointer'
    });
    btn.addEventListener('click', openProfilesModal);
    const hideBtn = chrome.querySelector('button[title="Hide chrome"]');
    if (hideBtn) chrome.insertBefore(btn, hideBtn);
    else chrome.appendChild(btn);
  }

  function openProfilesModal() {
    const overlay = document.createElement('div');
    overlay.dataset.ttOur = '1';
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.85)',
      zIndex: 100006, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px'
    });
    const panel = document.createElement('div');
    panel.style.cssText =
      'background:#161b22;border:1px solid #30363d;border-radius:12px;' +
      'padding:24px;max-width:520px;width:100%;max-height:80vh;overflow-y:auto;' +
      'font-family:system-ui;color:#fff;';

    const head = document.createElement('div');
    head.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;';
    head.innerHTML = '<div style="font-size:18px;font-weight:700;">📁 Loadout Profiles</div>';

    const close = document.createElement('button');
    close.textContent = '✕';
    close.style.cssText = 'background:none;border:0;color:#fff;font-size:18px;cursor:pointer;';
    close.addEventListener('click', () => overlay.remove());
    head.appendChild(close);
    panel.appendChild(head);

    const saveRow = document.createElement('div');
    saveRow.style.cssText = 'display:flex;gap:8px;margin-bottom:16px;';
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Profile name (e.g. Competitive)';
    input.style.cssText = 'flex:1;padding:8px 12px;border-radius:6px;background:#0d1117;color:#fff;border:1px solid #30363d;font-family:inherit;';
    const saveBtn = document.createElement('button');
    saveBtn.textContent = '💾 Save';
    saveBtn.style.cssText = 'background:#238636;color:#fff;border:1px solid #2ea043;padding:8px 16px;border-radius:6px;cursor:pointer;font-weight:600;font-family:inherit;';
    saveBtn.addEventListener('click', () => {
      try {
        Profiles.save(input.value.trim());
        overlay.remove();
        API.showToast(`📁 Saved profile: ${input.value.trim()}`);
      } catch (e) { alert(e.message); }
    });
    saveRow.append(input, saveBtn);
    panel.appendChild(saveRow);

    const list = document.createElement('div');
    list.style.cssText = 'display:flex;flex-direction:column;gap:8px;';
    const names = Profiles.list();
    const active = Profiles.active();
    if (!names.length) {
      list.innerHTML = '<div style="opacity:.5;font-style:italic;padding:20px;text-align:center;">No profiles yet. Save your current setup above.</div>';
    } else {
      names.forEach(n => {
        const row = document.createElement('div');
        row.style.cssText =
          `display:flex;align-items:center;gap:10px;padding:10px 14px;` +
          `background:${n === active ? 'rgba(63,185,80,.15)' : '#0d1117'};` +
          `border:1px solid ${n === active ? '#3fb950' : '#21262d'};border-radius:8px;`;
        const label = document.createElement('div');
        label.textContent = (n === active ? '★ ' : '') + n;
        label.style.cssText = 'flex:1;font-weight:600;';
        const loadBtn = document.createElement('button');
        loadBtn.textContent = '▶ Load';
        loadBtn.style.cssText = 'background:#238636;color:#fff;border:1px solid #2ea043;padding:6px 12px;border-radius:6px;cursor:pointer;font-size:12px;font-weight:600;font-family:inherit;';
        loadBtn.addEventListener('click', () => Profiles.load(n));
        const delBtn = document.createElement('button');
        delBtn.textContent = '🗑';
        delBtn.style.cssText = 'background:#4a1616;color:#fff;border:1px solid #8b2d2d;padding:6px 10px;border-radius:6px;cursor:pointer;font-size:12px;font-family:inherit;';
        delBtn.addEventListener('click', () => {
          if (!confirm(`Delete profile "${n}"?`)) return;
          Profiles.remove(n);
          overlay.remove();
          openProfilesModal();
        });
        row.append(label, loadBtn, delBtn);
        list.appendChild(row);
      });
    }
    panel.appendChild(list);
    overlay.appendChild(panel);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  }

  /* ============================================================
   * 2. REPLAY THEATER
   * ============================================================ */
  let theaterBar = null;
  let theaterRAF = null;
  let playbackSpeed = 1;

  function buildTheaterBar() {
    if (theaterBar) return theaterBar;
    const bar = document.createElement('div');
    bar.dataset.ttOur = '1';
    Object.assign(bar.style, {
      position: 'fixed', bottom: '20px', left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(13,17,23,0.95)',
      border: '1px solid #30363d',
      borderRadius: '10px',
      padding: '10px 16px',
      display: 'none', gap: '10px', alignItems: 'center',
      zIndex: 99997, fontFamily: 'system-ui', color: '#fff',
      boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
    });

    const mkBtn = (label, title, onClick) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.title = title || '';
      b.style.cssText =
        'background:rgba(255,255,255,0.06);color:#e8eaf0;border:1px solid rgba(255,255,255,0.1);' +
        'border-radius:6px;padding:6px 12px;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600;';
      b.addEventListener('click', onClick);
      return b;
    };

    const slower  = mkBtn('◀◀', 'Slower', () => setSpeed(playbackSpeed / 2));
    const label   = document.createElement('div');
    label.textContent = '1.0×';
    label.style.cssText = 'min-width:60px;text-align:center;font-weight:700;';
    const faster  = mkBtn('▶▶', 'Faster', () => setSpeed(playbackSpeed * 2));
    const snap    = mkBtn('📸', 'Screenshot', takeScreenshot);
    const closeB  = mkBtn('✕', 'Close bar', () => { bar.style.display = 'none'; });

    bar.append(slower, label, faster, snap, closeB);

    function setSpeed(s) {
      playbackSpeed = Math.max(0.25, Math.min(16, s));
      label.textContent = playbackSpeed.toFixed(playbackSpeed < 1 ? 2 : 1) + '×';
    }

    document.body.appendChild(bar);
    theaterBar = bar;
    return bar;
  }

  function takeScreenshot() {
    const c = API.getGameCanvas();
    if (!c) return;
    c.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const TT = API.getGame();
      const name = (TT && TT.ah && TT.ah.a0j && TT.ah.a0j[TT.aE.fJ]) || 'player';
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      a.download = `Modatorial_${stamp}_${name}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      API.showToast('📸 Screenshot saved');
    });
  }

  function watchReplay() {
    if (theaterRAF) cancelAnimationFrame(theaterRAF);
    let wasReplay = false;
    const loop = () => {
      const TT = API.getGame();
      const isReplay = !!(TT && TT.aE && TT.aE.hi);
      if (isReplay && !wasReplay) {
        buildTheaterBar().style.display = 'flex';
      } else if (!isReplay && wasReplay) {
        if (theaterBar) theaterBar.style.display = 'none';
      }
      wasReplay = isReplay;
      theaterRAF = requestAnimationFrame(loop);
    };
    loop();
  }

  /* ============================================================
   * 3. ACHIEVEMENTS & BADGES
   * ============================================================ */
  const ACH_KEY = 'tt-achievements';
  const ACHIEVEMENTS = [
    { id: 'first_blood',    icon: '🩸', name: 'First Blood',     desc: 'Win your first game' },
    { id: 'blitz',          icon: '⚡', name: 'Blitz',           desc: 'Win a game in under 5 minutes' },
    { id: 'world_conq',     icon: '🌍', name: 'World Conqueror', desc: 'Capture 100% of the map' },
    { id: 'mod_enthusiast', icon: '🎭', name: 'Mod Enthusiast',  desc: 'Play with 10+ mods enabled' },
    { id: 'dedicated',      icon: '🕐', name: 'Dedicated',       desc: '100 hours of playtime' },
    { id: 'designer',       icon: '🎨', name: 'Designer',        desc: 'Import 5 custom .ttmod files' },
    { id: 'surrender_king', icon: '🏳️', name: 'Surrender King',  desc: 'Surrender 10 times' },
    { id: 'marathon',       icon: '🏃', name: 'Marathon',        desc: 'Play a match longer than 1 hour' },
    { id: 'veteran',        icon: '🎖️', name: 'Veteran',         desc: 'Play 100 matches' },
    { id: 'gladiator',      icon: '⚔️', name: 'Gladiator',       desc: 'Win 50 matches' }
  ];

  function readAchievements() {
    try { return JSON.parse(localStorage.getItem(ACH_KEY) || '{}'); }
    catch { return {}; }
  }
  function saveAchievements(a) {
    localStorage.setItem(ACH_KEY, JSON.stringify(a));
  }
  function unlock(id) {
    const a = readAchievements();
    if (a[id]) return;
    a[id] = Date.now();
    saveAchievements(a);
    const def = ACHIEVEMENTS.find(x => x.id === id);
    if (def) {
      API.showToast(`🏆 Achievement: ${def.icon} ${def.name}`, 4000);
      log('Achievement unlocked:', def.name);
    }
  }

  function checkAchievements() {
    const raw = localStorage.getItem('tt-account-v1');
    if (!raw) return;
    let state;
    try { state = JSON.parse(raw); } catch { return; }

    if (state.wins >= 1)                     unlock('first_blood');
    if (state.wins >= 50)                    unlock('gladiator');
    if (state.gamesPlayed >= 100)            unlock('veteran');
    if (state.surrenders >= 10)              unlock('surrender_king');
    if (state.playtimeMs >= 100 * 3600 * 1000) unlock('dedicated');

    const last = state.history && state.history[0];
    if (last && last.outcome === 'win' && last.durationMs < 5 * 60 * 1000) {
      unlock('blitz');
    }
    if (last && last.durationMs > 3600 * 1000) unlock('marathon');

    if (API.mods) {
      const loaded = [...API.mods.values()].filter(m => m.status === 'loaded').length;
      if (loaded >= 10) unlock('mod_enthusiast');
    }

    try {
      const imported = JSON.parse(localStorage.getItem('tt-imported-mods') || '[]');
      if (imported.length >= 5) unlock('designer');
    } catch {}
  }

  let conquestChecked = false;
  API.addHook('postUpdate', () => {
    const TT = API.getGame();
    if (!TT || !TT.aE || TT.aE.a2G !== 1) return;
    if (conquestChecked) return;
    if (!TT.ah || !TT.aE) return;
    const me = TT.aE.fJ;
    if (TT.ah.nU[me] === 0) return;
    if (TT.aE.ke > 0 && TT.ah.hN[me] >= TT.aE.ke * 0.98) {
      unlock('world_conq');
      conquestChecked = true;
    }
  });

  API.on('modLoaded', () => setTimeout(checkAchievements, 500));

  /* ============================================================
   * 4. CUSTOM SOUND PACKS
   * ============================================================ */
  const Sounds = {
    packs: {},
    current: 'default',
    sounds: {},
    register(name, url) {
      if (!Sounds.sounds[name]) Sounds.sounds[name] = {};
      Sounds.sounds[name].url = url;
    },
    play(name) {
      const pack = Sounds.packs[Sounds.current];
      if (pack && pack.sounds && pack.sounds[name]) {
        playUrl(pack.sounds[name]);
        return;
      }
      if (Sounds.sounds[name] && Sounds.sounds[name].url) {
        playUrl(Sounds.sounds[name].url);
      }
    },
    loadPack(pack) {
      Sounds.packs[pack.name] = pack;
    }
  };
  function playUrl(url) {
    try {
      const a = new Audio(url);
      a.volume = 0.4;
      a.play().catch(() => {});
    } catch {}
  }
  window.TerritorialSoundsPacks = Sounds;

  /* ============================================================
   * 5. LIVE STATS OVERLAY
   * ============================================================ */
  const OVERLAY_KEY = 'tt-overlay';
  let overlayEnabled = localStorage.getItem(OVERLAY_KEY) !== '0';
  let matchStartTime = 0;

  function getMyRank(TT) {
    if (!TT.ah) return null;
    const me = TT.aE.fJ;
    const myT = TT.ah.hN[me];
    let rank = 1;
    for (let i = 0; i < TT.aE.fW; i++) {
      if (TT.ah.nU[i] === 0) continue;
      if (TT.ah.hN[i] > myT) rank++;
    }
    return rank;
  }
  function formatMs(ms) {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${(s % 60).toString().padStart(2, '0')}`;
  }
  function drawOverlay() {
    if (!overlayEnabled) return;
    const TT = API.getGame();
    if (!TT || !TT.aE || TT.aE.a2G !== 1 || TT.aE.hx) return;
    if (!TT.ah) return;
    const c = API.getGameCanvas();
    if (!c) return;
    const g = c.getContext('2d');
    const W = c.width;

    g.save();
    g.font = 'bold 12px system-ui';
    g.textBaseline = 'top';
    g.textAlign = 'left';

    const line1 = `⚔ Rank: ${getMyRank(TT) || '?'} · Strength: ${TT.ah.hb[TT.aE.fJ] || 0}`;
    const line2 = `⏱ ${formatMs(performance.now() - (matchStartTime || performance.now()))}`;
    const lines = [line1, line2];
    const padding = 10;
    const lh = 16;
    const boxH = lines.length * lh + padding * 2;
    const boxW = 250;

    g.fillStyle = 'rgba(0,0,0,0.55)';
    g.fillRect(W - boxW - 10, 40, boxW, boxH);
    g.fillStyle = '#cff';
    lines.forEach((l, i) => g.fillText(l, W - boxW, 40 + padding + i * lh));
    g.restore();
  }

  API.addHook('postUpdate', () => {
    const TT = API.getGame();
    if (!TT || !TT.aE) return;
    if (TT.aE.a2G === 1 && !matchStartTime) matchStartTime = performance.now();
    if (TT.aE.a2G === 0) matchStartTime = 0;
    drawOverlay();
  });

  window.TerritorialOverlay = {
    toggle() {
      overlayEnabled = !overlayEnabled;
      localStorage.setItem(OVERLAY_KEY, overlayEnabled ? '1' : '0');
      API.showToast(`📊 Overlay ${overlayEnabled ? 'on' : 'off'}`);
    }
  };

  /* ============================================================
   * 6. SHARE SETUP VIA URL
   * ============================================================ */
  function encodeSetup() {
    let disabled = [];
    try { disabled = JSON.parse(localStorage.getItem('tt-disabled-mods') || '[]'); } catch {}
    const setup = {
      d: disabled,
      t: localStorage.getItem('tt-theme') || 'midnight',
      l: localStorage.getItem('tt-layout') || 'sidebar',
      u: (document.getElementById('input0') || {}).value || '',
      s: localStorage.getItem('tt-sidebar-collapsed') || '0'
    };
    return btoa(encodeURIComponent(JSON.stringify(setup)))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function decodeSetup(b64) {
    try {
      const padded = b64.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice(0, (4 - b64.length % 4) % 4);
      return JSON.parse(decodeURIComponent(atob(padded)));
    } catch { return null; }
  }
  function applySetupFromUrl() {
    const hash = location.hash.slice(1);
    if (!hash.startsWith('setup=')) return;
    const setup = decodeSetup(hash.slice(6));
    if (!setup) return;
    if (setup.d) localStorage.setItem('tt-disabled-mods', JSON.stringify(setup.d));
    if (setup.t) localStorage.setItem('tt-theme', setup.t);
    if (setup.l) localStorage.setItem('tt-layout', setup.l);
    if (setup.s) localStorage.setItem('tt-sidebar-collapsed', setup.s);
    if (setup.u && document.getElementById('input0')) {
      document.getElementById('input0').value = setup.u;
    }
    history.replaceState(null, '', location.pathname);
    API.showToast('🔗 Setup loaded from URL');
  }

  window.TerritorialShare = {
    generate() {
      const code = encodeSetup();
      const url = location.origin + location.pathname + '#setup=' + code;
      navigator.clipboard.writeText(url).then(
        () => API.showToast('🔗 Setup URL copied to clipboard'),
        () => prompt('Copy this URL:', url)
      );
    }
  };

  /* ============================================================
   * 7. DISCORD RICH PRESENCE (stub)
   * ============================================================ */
  window.TerritorialDiscord = {
    set(details, state) {
      try {
        fetch('http://localhost:6463/rpc', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ details, state, ts: Date.now() })
        }).catch(() => {});
      } catch {}
    }
  };

  API.on('screenChanged', screen => {
    if (screen === 'menu') window.TerritorialDiscord.set('In menu', 'Browsing mods');
    else                   window.TerritorialDiscord.set('In a match', 'Playing Territorial.io');
  });

  /* ============================================================
   * 8. ANNOUNCER VOICE PACKS
   * ============================================================ */
  const Announcer = {
    enabled: localStorage.getItem('tt-announcer') === '1',
    pack: null,
    setPack(pack) { Announcer.pack = pack; },
    say(clipId) {
      if (!Announcer.enabled || !Announcer.pack) return;
      const url = Announcer.pack.clips && Announcer.pack.clips[clipId];
      if (url) playUrl(url);
    }
  };
  window.TerritorialAnnouncer = Announcer;

  API.on('screenChanged', s => {
    if (s === 'menu') Announcer.say('menu');
  });

  /* ============================================================
   * 9. SPEEDRUN MODE
   * ============================================================ */
  const SR_KEY = 'tt-speedrun-pb';
  let srActive = false;
  let srStart  = 0;

  function srStartRun() {
    srActive = true;
    srStart = performance.now();
  }
  function srFinish() {
    if (!srActive) return;
    const total = performance.now() - srStart;
    const pbRaw = localStorage.getItem(SR_KEY);
    const pb = pbRaw ? parseFloat(pbRaw) : Infinity;
    if (!isFinite(pb) || total < pb) {
      localStorage.setItem(SR_KEY, String(total));
      API.showToast(`🏆 New PB: ${formatMs(total)}`, 5000);
    } else {
      API.showToast(`⏱ Finished: ${formatMs(total)} (PB: ${formatMs(pb)})`, 4000);
    }
    srActive = false;
  }
  function srDraw() {
    if (!srActive) return;
    const c = API.getGameCanvas();
    if (!c) return;
    const g = c.getContext('2d');
    const elapsed = performance.now() - srStart;
    const pbRaw = localStorage.getItem(SR_KEY);
    const pb = pbRaw ? parseFloat(pbRaw) : 0;
    g.save();
    g.font = 'bold 18px ui-monospace, monospace';
    g.textBaseline = 'top';
    g.fillStyle = (pb && elapsed > pb) ? '#f85149' : '#3fb950';
    g.fillText(formatMs(elapsed), 20, 50);
    if (pb) {
      g.font = 'bold 12px ui-monospace, monospace';
      g.fillStyle = elapsed > pb ? '#f85149' : '#3fb950';
      const delta = elapsed - pb;
      g.fillText(`${delta >= 0 ? '+' : ''}${(delta / 1000).toFixed(1)}s vs PB`, 20, 72);
    }
    g.restore();
  }
  API.addHook('postUpdate', () => {
    const TT = API.getGame();
    if (!TT || !TT.aE) return;
    if (TT.aE.a2G === 1 && !srActive) srStartRun();
    if (TT.aE.a2G === 0 && srActive) srFinish();
    srDraw();
  });

  /* ============================================================
   * 10. MISC
   * ============================================================ */
  document.addEventListener('keydown', e => {
    if (e.key === 'F2') {
      e.preventDefault();
      takeScreenshot();
    }
  });

  /* Birthday mode */
  try {
    const bd = localStorage.getItem('tt-birthday');
    if (bd) {
      const now = new Date();
      const today = (now.getMonth() + 1).toString().padStart(2, '0') + '-' +
                    now.getDate().toString().padStart(2, '0');
      if (bd === today) {
        setTimeout(() => API.showToast('🎂 Happy birthday! +500 XP bonus'), 3000);
        const raw = localStorage.getItem('tt-account-v1');
        if (raw) {
          try {
            const s = JSON.parse(raw);
            s.xp = (s.xp || 0) + 500;
            localStorage.setItem('tt-account-v1', JSON.stringify(s));
          } catch {}
        }
      }
    }
  } catch {}

  /* ============================================================
   * INJECT FEATURE BUTTONS
   * ============================================================ */
  function injectFeatureButtons() {
    const chrome = document.getElementById('tt-chrome');
    if (!chrome) return;

    injectProfilesButton();

    if (!chrome.querySelector('[data-tt-feature="share"]')) {
      const shareBtn = document.createElement('button');
      shareBtn.dataset.ttOur = '1';
      shareBtn.dataset.ttFeature = 'share';
      shareBtn.textContent = '🔗';
      shareBtn.title = 'Copy shareable setup URL';
      shareBtn.style.cssText =
        'background:rgba(255,255,255,0.06);color:#e8eaf0;border:1px solid rgba(255,255,255,0.1);' +
        'border-radius:6px;padding:3px 10px;font-family:inherit;font-size:12px;cursor:pointer;';
      shareBtn.addEventListener('click', () => window.TerritorialShare.generate());
      const hideBtn = chrome.querySelector('button[title="Hide chrome"]');
      if (hideBtn) chrome.insertBefore(shareBtn, hideBtn);
      else chrome.appendChild(shareBtn);
    }

    if (!chrome.querySelector('[data-tt-feature="overlay"]')) {
      const ovBtn = document.createElement('button');
      ovBtn.dataset.ttOur = '1';
      ovBtn.dataset.ttFeature = 'overlay';
      ovBtn.textContent = '📊';
      ovBtn.title = 'Toggle live stats overlay';
      ovBtn.style.cssText =
        'background:rgba(255,255,255,0.06);color:#e8eaf0;border:1px solid rgba(255,255,255,0.1);' +
        'border-radius:6px;padding:3px 10px;font-family:inherit;font-size:12px;cursor:pointer;';
      ovBtn.addEventListener('click', () => window.TerritorialOverlay.toggle());
      const hideBtn = chrome.querySelector('button[title="Hide chrome"]');
      if (hideBtn) chrome.insertBefore(ovBtn, hideBtn);
      else chrome.appendChild(ovBtn);
    }
  }

  /* ============================================================
   * BOOT
   * ============================================================ */
  function boot() {
    log('client-features.js v2.0 loaded');
    applySetupFromUrl();
    setInterval(injectFeatureButtons, 500);
    watchReplay();
    setInterval(checkAchievements, 5000);
    checkAchievements();
    API.on('ready', () => {
      window.TerritorialDiscord.set('In menu', 'Browsing mods');
    });
    log('All features active');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else boot();

})(window);