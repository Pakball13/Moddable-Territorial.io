/* ============================================================
 * Territorial.io Mod Loader  v1.9.1  (Patch 1 — Icon fix)
 * ============================================================ */
(function (global) {
  'use strict';

  const MODS_DIR  = 'mods/';
  const MANIFEST  = MODS_DIR + 'manifest.json';
  const LOG_PFX   = '%c[ModLoader]';
  const LOG_STYLE = 'color:#7bd;font-weight:bold';
  const DISABLED_KEY = 'tt-disabled-mods';
  const LAYOUT_KEY   = 'tt-layout';
  const ICON_DIR     = 'assets/icons/';

  const log  = (...a) => console.log  (LOG_PFX, LOG_STYLE, ...a);
  const warn = (...a) => console.warn (LOG_PFX, LOG_STYLE, ...a);
  const err  = (...a) => console.error(LOG_PFX, LOG_STYLE, ...a);

  const ICONS = {
    'Custom Scenario': ICON_DIR + 'swords.svg',
    'My Account':      ICON_DIR + 'key.svg',
    'Game Menu':       ICON_DIR + 'menu.svg',
    'Multiplayer':     ICON_DIR + 'swords.svg',
    'Mods':            ICON_DIR + 'mods.svg'
  };

  /* ---------- hooks ---------- */
  const listeners = new Map();
  const hooks = {
    preUpdate:[], postUpdate:[], preRender:[], postRender:[],
    netSend:[], netRecv:[],
    keyDown:[], keyUp:[], mouseDown:[], mouseUp:[], mouseMove:[]
  };
  const on  = (evt, fn) => {
    if (!listeners.has(evt)) listeners.set(evt, new Set());
    listeners.get(evt).add(fn);
    return () => listeners.get(evt).delete(fn);
  };
  const off = (evt, fn) => listeners.get(evt)?.delete(fn);
  const emit = (evt, ...args) => {
    const s = listeners.get(evt); if (!s) return;
    for (const fn of s) { try { fn(...args); } catch (e) { err(`listener ${evt}`, e); } }
  };
  const addHook = (name, fn) => { if (hooks[name]) hooks[name].push(fn); };
  const runHooks = (name, ...args) => {
    const l = hooks[name]; if (!l) return;
    for (const fn of l) { try { fn(...args); } catch (e) { err(`hook ${name}`, e); } }
  };

  const mods = new Map();

  let disabledMods;
  try {
    const raw = localStorage.getItem(DISABLED_KEY);
    disabledMods = new Set(raw ? JSON.parse(raw) : []);
    log(`Disabled set at boot: [${[...disabledMods].join(', ') || 'empty'}]`);
  } catch { disabledMods = new Set(); }

  function persistDisabled() {
    localStorage.setItem(DISABLED_KEY, JSON.stringify([...disabledMods]));
    log(`Persisted: [${[...disabledMods].join(', ') || 'empty'}]`);
  }

  const CLIENT = {
    layout:          localStorage.getItem(LAYOUT_KEY) || 'sidebar',
    chrome:          localStorage.getItem('tt-chrome') !== '0',
    hideMenuButtons: localStorage.getItem('tt-hidemenu') !== '0',
    hideLogo:        localStorage.getItem('tt-hidelogo') !== '0',
    hideVersion:     localStorage.getItem('tt-hideversion') !== '0',
    hideMultiplayer: localStorage.getItem('tt-hidemulti') !== '0'
  };

  /* ============================================================
   * PUBLIC API
   * ============================================================ */
  const API = {
    version: '1.9.1',
    gameVersion: 25,
    getGame() { return window.__TT__ || null; },
    on, off, emit, addHook, mods,
    log, warn, error: err,

    getGameCanvas  : () => document.getElementById('canvasA'),
    getGameContext : () => document.getElementById('canvasA')?.getContext('2d'),
    getGameSize    : () => {
      const c = document.getElementById('canvasA');
      return c ? { width: c.width, height: c.height } : null;
    },
    isInLobby : () => !!document.querySelector('input#input0'),

    showToast(msg, ms = 3000) {
      const el = document.createElement('div');
      el.textContent = msg;
      Object.assign(el.style, {
        position:'fixed', left:'50%', bottom:'20px', transform:'translateX(-50%)',
        background:'rgba(0,0,0,.85)', color:'#fff', padding:'10px 20px',
        borderRadius:'8px', fontFamily:'system-ui', zIndex: 99999,
        pointerEvents:'none', transition:'opacity .3s'
      });
      document.body.appendChild(el);
      setTimeout(() => { el.style.opacity = '0';
                         setTimeout(() => el.remove(), 300); }, ms);
    },

    addButton(text, onClick, style = {}) {
      const b = document.createElement('button');
      b.textContent = text;
      Object.assign(b.style, {
        position:'fixed', top:'10px', right:'10px', zIndex: 99998,
        padding:'6px 12px', background:'#222', color:'#fff',
        border:'1px solid #555', borderRadius:'6px', cursor:'pointer',
        fontFamily:'system-ui', fontSize:'12px', ...style
      });
      b.addEventListener('click', onClick);
      document.body.appendChild(b);
      return b;
    },

    readModFile(mod, relPath, as = 'text') {
      const url = mod.basePath + relPath;
      return fetch(url, { cache: 'no-store' }).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status} – ${url}`);
        if (as === 'json')  return r.json();
        if (as === 'blob')  return r.blob();
        if (as === 'image') return new Promise((res, rej) => {
          const i = new Image();
          i.onload = () => res(i);
          i.onerror = rej;
          i.src = url;
        });
        return r.text();
      });
    },

    isModDisabled(id) { return disabledMods.has(id); },
    setModDisabled(id, disabled) {
      if (disabled) disabledMods.add(id); else disabledMods.delete(id);
      persistDisabled();
      const meta = mods.get(id);
      if (meta) meta.status = disabled ? 'disabled' : 'loaded';
      emit('modToggled', id, disabled);
      if (menuEl) menuEl.render();
      API.showToast(`🔧 ${id} ${disabled ? 'disabled' : 'enabled'} — click Reload`);
      return true;
    },
    toggleMod(id) { return this.setModDisabled(id, !disabledMods.has(id)); },
    disableAllMods() {
      for (const m of mods.values()) disabledMods.add(m.id);
      persistDisabled();
      if (menuEl) menuEl.render();
      API.showToast('🔧 All mods disabled — click Reload');
    },
    enableAllMods() {
      disabledMods.clear(); persistDisabled();
      if (menuEl) menuEl.render();
      API.showToast('🔧 All mods enabled — click Reload');
    },
    resetModState() {
      localStorage.removeItem(DISABLED_KEY);
      log('Cleared disabled set');
      location.reload();
    },
    reloadPage() { location.reload(); },

    setLayout(mode) {
      if (!['sidebar','grid','circles'].includes(mode)) return false;
      CLIENT.layout = mode;
      localStorage.setItem(LAYOUT_KEY, mode);
      applyLayout();
      API.showToast(`📐 Layout: ${mode}`);
      return true;
    },
    getLayout() { return CLIENT.layout; },
    setChrome(on) {
      CLIENT.chrome = !!on;
      localStorage.setItem('tt-chrome', on ? '1' : '0');
      updateChrome();
      return CLIENT.chrome;
    },
    setHideMenuButtons(on) {
      CLIENT.hideMenuButtons = !!on;
      localStorage.setItem('tt-hidemenu', on ? '1' : '0');
      filterMenuPopupButtons();
      return CLIENT.hideMenuButtons;
    },
    setHideLogo(on) {
      CLIENT.hideLogo = !!on;
      localStorage.setItem('tt-hidelogo', on ? '1' : '0');
      return CLIENT.hideLogo;
    },
    setHideVersion(on) {
      CLIENT.hideVersion = !!on;
      localStorage.setItem('tt-hideversion', on ? '1' : '0');
      return CLIENT.hideVersion;
    },
    setHideMultiplayer(on) {
      CLIENT.hideMultiplayer = !!on;
      localStorage.setItem('tt-hidemulti', on ? '1' : '0');
      filterMultiplayer();
      return CLIENT.hideMultiplayer;
    },
    getClient() { return { ...CLIENT }; },
    setMenuBackground(fn) { API._menuBackground = fn; }
  };
  global.TerritorialMods = API;

  /* ============================================================
   * PATCH #1 — WebSocket
   * ============================================================ */
  const OrigWS = global.WebSocket;
  const BLOCKED_HOSTS = ['territorial.io','1.territorial.io','2.territorial.io'];
  function hostMatches(url) {
    try {
      const u = new URL(url, location.href);
      const h = u.hostname.toLowerCase();
      return BLOCKED_HOSTS.some(b => h === b || h.endsWith('.' + b));
    } catch { return false; }
  }
  const isBlocked = url => API.offlineMode && hostMatches(url);
  function makeFakeWS(url) {
    const L = Object.create(null);
    return {
      url: String(url), protocol:'', extensions:'',
      bufferedAmount: 0, binaryType:'arraybuffer',
      readyState:0, CONNECTING:0, OPEN:1, CLOSING:2, CLOSED:3,
      onopen:null, onerror:null, onmessage:null, onclose:null,
      addEventListener(t, fn) { (L[t] || (L[t]=[])).push(fn); },
      removeEventListener(t, fn) {
        const l = L[t]; if (!l) return;
        const i = l.indexOf(fn); if (i>=0) l.splice(i,1);
      },
      dispatchEvent() { return true; }, send() {}, close() { this.readyState = 3; }
    };
  }
  function WSProxy(url, protocols) {
    if (isBlocked(url)) { try { log(`↳ blocked WS`); } catch {} return makeFakeWS(url); }
    const ws = protocols !== undefined ? new OrigWS(url, protocols) : new OrigWS(url);
    const origSend = ws.send.bind(ws);
    ws.send = function (data) {
      try { runHooks('netSend', data, ws, url); } catch (e) { err(e); }
      return origSend(data);
    };
    ws.addEventListener('message', e => {
      try { runHooks('netRecv', e.data, ws, url); } catch (er) { err(er); }
    });
    return ws;
  }
  WSProxy.prototype = OrigWS.prototype;
  WSProxy.CONNECTING = OrigWS.CONNECTING;
  WSProxy.OPEN = OrigWS.OPEN;
  WSProxy.CLOSING = OrigWS.CLOSING;
  WSProxy.CLOSED = OrigWS.CLOSED;
  global.WebSocket = WSProxy;
  API.offlineMode = true;
  API.blockedHosts = BLOCKED_HOSTS;

  /* ============================================================
   * PATCH #2 — rAF
   * ============================================================ */
  const origRAF = global.requestAnimationFrame.bind(global);
  global.requestAnimationFrame = cb => origRAF(t => {
    runHooks('preUpdate', t);
    let out; try { out = cb(t); }
    catch (e) { runHooks('postUpdate', t); throw e; }
    runHooks('postUpdate', t);
    return out;
  });

  /* ============================================================
   * PATCH #3 — input
   * ============================================================ */
  const inputMap = {
    keydown:'keyDown', keyup:'keyUp',
    mousedown:'mouseDown', mouseup:'mouseUp', mousemove:'mouseMove'
  };
  for (const evt in inputMap) {
    window.addEventListener(evt, e => {
      emit(evt, e); runHooks(inputMap[evt], e);
    }, false);
  }

  /* ============================================================
   * PATCH #4 — Canvas2D
   * ============================================================ */
  const OrigCtx = CanvasRenderingContext2D.prototype;
  const origDrawImage = OrigCtx.drawImage;
  OrigCtx.drawImage = function (...args) {
    try { runHooks('preRender', this); } catch (e) { err(e); }
    const r = origDrawImage.apply(this, args);
    try { runHooks('postRender', this); } catch (e) { err(e); }
    return r;
  };
  const origFillText = OrigCtx.fillText;
  const VERSION_RE = /^\d{1,2}\s+\w{3,}\s+\d{4}\s*\[/;
  OrigCtx.fillText = function (text, x, y, maxWidth) {
    if (CLIENT.hideVersion && typeof text === 'string' && VERSION_RE.test(text)) return;
    return maxWidth !== undefined
      ? origFillText.call(this, text, x, y, maxWidth)
      : origFillText.call(this, text, x, y);
  };

  /* ============================================================
   * MENU CLUTTER
   * ============================================================ */
  const HIDE_POPUP = [
    'Logs','Game Log','Clan Charts','Gold Transfer',
    'Join Lobby 2','Account Recovery','Delete Data',
    'Privacy Settings','Links','Replay','Force Restart Game'
  ];
  function isOurButton(btn) {
    if (!btn) return false;
    if (btn.id && btn.id.startsWith('tt-')) return true;
    if (btn.dataset && btn.dataset.ttOur === '1') return true;
    return false;
  }
  function stripEmoji(s) {
    return (s || '')
      .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu,'')
      .trim();
  }
  function hideByTag(btn, tag) {
    btn.dataset[tag] = '1';
    btn.style.setProperty('display', 'none', 'important');
    btn.style.setProperty('visibility', 'hidden', 'important');
    btn.style.setProperty('width', '0', 'important');
    btn.style.setProperty('height', '0', 'important');
    btn.style.setProperty('opacity', '0', 'important');
    btn.setAttribute('hidden', '');
  }
  function showByTag(btn, tag) {
    delete btn.dataset[tag];
    btn.style.removeProperty('display');
    btn.style.removeProperty('visibility');
    btn.style.removeProperty('width');
    btn.style.removeProperty('height');
    btn.style.removeProperty('opacity');
    btn.removeAttribute('hidden');
  }
  function filterMenuPopupButtons() {
    if (!CLIENT.hideMenuButtons) {
      document.querySelectorAll('button[data-tt-hid]').forEach(b => showByTag(b, 'ttHid'));
      return;
    }
    document.querySelectorAll('button').forEach(btn => {
      if (isOurButton(btn)) return;
      const txt = stripEmoji(btn.textContent);
      if (!txt) return;
      if (HIDE_POPUP.some(h => txt === h || txt.includes(h))) hideByTag(btn, 'ttHid');
    });
  }
  function filterMultiplayer() {
    document.querySelectorAll('body > button').forEach(btn => {
      if (isOurButton(btn)) return;
      const txt = stripEmoji(btn.textContent);
      if (!txt) return;
      if (txt.includes('Multiplayer')) {
        if (CLIENT.hideMultiplayer) hideByTag(btn, 'ttMulti');
        else showByTag(btn, 'ttMulti');
      }
    });
  }

  /* ============================================================
   * GAME-INTERNALS PATCHERS
   * ============================================================ */
  function patchMenuBackground() {
    const TT = window.__TT__;
    if (!TT || !TT.ab) return false;
    const ab = TT.ab;
    if (ab.__ttBgPatched) return true;
    if (typeof ab.a0K !== 'function') return false;
    const orig = ab.a0K;
    ab.a0K = function () {
      orig.call(this);
      if (typeof API._menuBackground === 'function') {
        try {
          const c = API.getGameCanvas();
          if (c) API._menuBackground(c.getContext('2d'), c.width, c.height);
        } catch (e) { err('menu bg', e); }
      }
    };
    ab.__ttBgPatched = true;
    log('🖼 Menu background hook installed');
    return true;
  }
  function patchLogo() {
    const TT = window.__TT__;
    if (!TT || !TT.ac || typeof TT.ac.aIh !== 'function') return false;
    const ac = TT.ac;
    if (ac.__ttLogoPatched) return true;
    const orig = ac.aIh.bind(ac);
    const BLOCKED = new Set(['territorial.io', 'logo']);
    ac.aIh = function (name) {
      if (CLIENT.hideLogo && BLOCKED.has(name)) {
        const c = document.createElement('canvas');
        c.width = 1; c.height = 1;
        return c;
      }
      return orig(name);
    };
    ac.__ttLogoPatched = true;
    log('🖼 Logo assets blanked');
    return true;
  }
  function patchMenuDraw() {
    const TT = window.__TT__;
    if (!TT || !TT.ab) return false;
    const ab = TT.ab;
    if (ab.__ttDrawPatched) return true;
    if (typeof ab.aIe !== 'function') return false;
    const orig = ab.aIe.bind(ab);
    ab.aIe = function () {
      if (CLIENT.hideLogo) return;
      return orig();
    };
    ab.__ttDrawPatched = true;
    log('🖼 Menu logo draw suppressed');
    return true;
  }
  function hideMenuClutter() {
    const TT = window.__TT__;
    if (!TT) return false;
    let done = true;
    if (TT.aU && typeof TT.aU.wr === 'function' && !TT.aU.__ttHidden) {
      TT.aU.wr = () => {}; TT.aU.__ttHidden = true; log('Hid timeline bars');
    } else if (!TT.aU) done = false;
    if (TT.aP && typeof TT.aP.wr === 'function' && !TT.aP.__ttHidden) {
      TT.aP.wr = () => {}; TT.aP.__ttHidden = true; log('Hid contest countdown');
    } else if (!TT.aP) done = false;
    return done;
  }

  /* ============================================================
   * DOM HELPERS
   * ============================================================ */
  const MAIN_KEYS = ['Multiplayer','Custom Scenario','My Account','Game Menu'];
  const MODS_BTN_ID = 'tt-mods-btn';

  /* Any button we've touched (game menu or Mods) is "ours" for layout */
  function isOurMenuButton(btn) {
    if (!btn || btn.tagName !== 'BUTTON') return false;
    if (btn.parentElement !== document.body) return false;
    if (btn.dataset.ttMenuBtn === '1') return true;
    if (btn.dataset.ttIconApplied === '1') return true;
    if (btn.id === MODS_BTN_ID) return true;
    return false;
  }

  /* Fresh game buttons we haven't touched yet */
  function isUntouchedGameButton(btn) {
    if (!btn || btn.tagName !== 'BUTTON') return false;
    if (btn.parentElement !== document.body) return false;
    if (isOurButton(btn)) return false;
    if (btn.id === MODS_BTN_ID) return false;
    if (btn.hasAttribute('hidden')) return false;
    if (btn.dataset.ttIconApplied === '1') return false;
    if (btn.dataset.ttMenuBtn === '1') return false;
    const html = btn.innerHTML || '';
    if (!html.includes('<br>')) return false;
    return MAIN_KEYS.some(k => html.includes(k));
  }

  function getMainMenuButtons() {
    const out = [];
    for (const b of document.querySelectorAll('body > button')) {
      if (isOurMenuButton(b) || isUntouchedGameButton(b)) out.push(b);
    }
    return out;
  }

  function getPlayerInput() { return document.getElementById('input0'); }

  function getColorButton() {
    for (const b of document.querySelectorAll('body > button')) {
      if (b.parentElement !== document.body) continue;
      if (isOurButton(b)) continue;
      if (b.id === MODS_BTN_ID) continue;
      if (b.hasAttribute('hidden')) continue;
      if (isOurMenuButton(b) || isUntouchedGameButton(b)) continue;
      const html = b.innerHTML || '';
      if (html.includes('<br>')) continue;
      if ((b.textContent || '').trim().length > 0) continue;
      const bg = b.style.backgroundColor || '';
      if (!bg || bg === 'transparent' || bg === 'rgba(0, 0, 0, 0)') continue;
      return b;
    }
    return null;
  }

  function hardPos(el, left, top, width, height) {
    el.dataset.ttMenuBtn = '1';
    el.style.setProperty('position', 'fixed', 'important');
    el.style.setProperty('left',    left + 'px', 'important');
    el.style.setProperty('top',     top + 'px', 'important');
    el.style.setProperty('right',   'auto', 'important');
    el.style.setProperty('bottom',  'auto', 'important');
    el.style.setProperty('width',   width + 'px', 'important');
    el.style.setProperty('height',  height + 'px', 'important');
    el.style.setProperty('margin',  '0', 'important');
    el.style.setProperty('z-index', '20', 'important');
    el.style.setProperty('box-sizing', 'border-box', 'important');
    el.style.setProperty('display', 'flex', 'important');
    el.style.setProperty('align-items', 'center', 'important');
    el.style.setProperty('justify-content', 'flex-start', 'important');
    el.style.setProperty('gap', '14px', 'important');
  }

  /* ============================================================
   * ICON REPLACEMENT — patch 1.9.1 rewrite
   *  - marks button as ours BEFORE stripping content
   *  - applies inline styles to icon + label (no external CSS needed)
   * ============================================================ */
  function applyIcons() {
    const candidates = [...document.querySelectorAll('body > button')];
    candidates.forEach(btn => {
      // Skip real "our" chrome/menu buttons (Mods is handled separately)
      if (isOurButton(btn) && btn.id !== MODS_BTN_ID) return;
      // Skip if already iconified and icon is still in the DOM
      if (btn.dataset.ttIconApplied === '1' && btn.querySelector('.tt-btn-icon')) return;

      // Figure out the label (persist once)
      let label = btn.dataset.ttLabel;
      if (!label) {
        const raw = stripEmoji(btn.textContent);
        const parts = raw.split(/\s{2,}|\n/).map(s => s.trim()).filter(Boolean);
        label = parts[parts.length - 1] || raw;
        if (!label) return;
        btn.dataset.ttLabel = label;
      }

      // Pick icon by label match
      let iconPath = null;
      for (const [key, path] of Object.entries(ICONS)) {
        if (label.toLowerCase().includes(key.toLowerCase())) { iconPath = path; break; }
      }
      if (!iconPath && btn.id === MODS_BTN_ID) iconPath = ICONS['Mods'];
      if (!iconPath) return;

      // ✅ Mark as ours BEFORE touching content
      btn.dataset.ttMenuBtn  = '1';
      btn.dataset.ttIconApplied = '1';

      // Replace content
      btn.innerHTML = '';
      const icon = document.createElement('img');
      icon.className = 'tt-btn-icon';
      icon.src = iconPath;
      icon.alt = '';
      icon.setAttribute('aria-hidden', 'true');
      // Inline styles — no dependency on css/client.css
      icon.style.cssText =
        'width:24px;height:24px;min-width:24px;max-width:24px;' +
        'flex:0 0 24px;display:block;object-fit:contain;' +
        'filter:brightness(0) invert(1);opacity:0.92;pointer-events:none;';

      const span = document.createElement('span');
      span.className = 'tt-btn-label';
      span.textContent = label;
      span.style.cssText =
        'flex:1;pointer-events:none;overflow:hidden;' +
        'text-overflow:ellipsis;white-space:nowrap;';

      btn.append(icon, span);
    });
  }

  /* ============================================================
   * LAYOUT ENGINE
   * ============================================================ */
  function applyLayout() {
    const mainBtns = getMainMenuButtons();
    if (mainBtns.length < 1) return;

    // Sort by original position (before layout overrides)
    const sorted = mainBtns.slice().sort((a, b) => {
      const at = parseFloat(a.style.top) || 0;
      const bt = parseFloat(b.style.top) || 0;
      if (Math.abs(at - bt) > 20) return at - bt;
      return (parseFloat(a.style.left) || 0) - (parseFloat(b.style.left) || 0);
    });

    const modsBtn = document.getElementById(MODS_BTN_ID);
    // Ensure Mods is last
    const filtered = sorted.filter(b => b.id !== MODS_BTN_ID);
    const all = modsBtn ? [...filtered, modsBtn] : filtered;

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const inputEl  = getPlayerInput();
    const colorBtn = getColorButton();
    const inputVisible = inputEl && inputEl.offsetParent !== null;
    const colorVisible = colorBtn && colorBtn.offsetParent !== null;
    const hasTopRow = inputVisible || colorVisible;

    /* ---------- SIDEBAR ---------- */
    if (CLIENT.layout === 'sidebar') {
      const rowH     = 60;
      const gap      = 10;
      const panelW   = 320;
      const leftPad  = 32;

      const rows   = all.length + (hasTopRow ? 1 : 0);
      const totalH = rows * rowH + (rows - 1) * gap;
      const startX = leftPad;
      const startY = Math.max(60, (vh - totalH) / 2);

      let y = startY;

      if (hasTopRow) {
        const swatchW = rowH;
        const inputW  = panelW - swatchW - gap;
        if (inputEl) {
          hardPos(inputEl, startX, y, inputW, rowH);
          inputEl.style.setProperty('padding', '0 16px', 'important');
          inputEl.style.setProperty('font-size', '16px', 'important');
          inputEl.style.setProperty('text-align', 'left', 'important');
          inputEl.style.setProperty('border-radius', '8px', 'important');
          inputEl.style.setProperty('display', 'block', 'important');
        }
        if (colorBtn) {
          hardPos(colorBtn, startX + panelW - swatchW, y, swatchW, rowH);
          colorBtn.style.setProperty('border-radius', '8px', 'important');
          colorBtn.style.setProperty('padding', '0', 'important');
        }
        y += rowH + gap;
      }

      all.forEach(b => {
        hardPos(b, startX, y, panelW, rowH);
        b.dataset.ttLayout = 'sidebar';
        b.style.setProperty('border-radius', '8px', 'important');
        b.style.setProperty('font-size', '15px', 'important');
        b.style.setProperty('padding', '0 18px', 'important');
        b.style.setProperty('flex-direction', 'row', 'important');
        y += rowH + gap;
      });
      return;
    }

    /* ---------- GRID ---------- */
    if (CLIENT.layout === 'grid') {
      const rowH = 66, gap = 12, colW = 220;
      const cols = 2;
      const rows = Math.ceil(all.length / cols);
      const btnBlockH = rows * rowH + (rows - 1) * gap;
      const clusterW = cols * colW + (cols - 1) * gap;
      const totalH = hasTopRow ? btnBlockH + rowH + gap : btnBlockH;
      const startX = (vw - clusterW) / 2;
      const startY = (vh - totalH) / 2;

      let y = startY;
      if (hasTopRow) {
        const swatchW = rowH;
        const inputW  = clusterW - swatchW - gap;
        if (inputEl)  hardPos(inputEl, startX, y, inputW, rowH);
        if (colorBtn) hardPos(colorBtn, startX + clusterW - swatchW, y, swatchW, rowH);
        y += rowH + gap;
      }
      all.forEach((b, i) => {
        const c = i % cols;
        const r = Math.floor(i / cols);
        hardPos(b, startX + c * (colW + gap), y + r * (rowH + gap), colW, rowH);
        b.dataset.ttLayout = 'grid';
        b.style.setProperty('border-radius', '8px', 'important');
        b.style.setProperty('padding', '0 18px', 'important');
        b.style.setProperty('flex-direction', 'row', 'important');
      });
      return;
    }

    /* ---------- CIRCLES ---------- */
    if (CLIENT.layout === 'circles') {
      const size = 130, gap = 14;
      const cols = 2;
      const rows = Math.ceil(all.length / cols);
      const btnBlockH = rows * size + (rows - 1) * gap;
      const clusterW = cols * size + (cols - 1) * gap;
      const totalH = hasTopRow ? btnBlockH + 66 + gap : btnBlockH;
      const startX = (vw - clusterW) / 2;
      const startY = (vh - totalH) / 2;

      let y = startY;
      if (hasTopRow) {
        const swatchW = 66;
        const inputW  = clusterW - swatchW - gap;
        if (inputEl)  hardPos(inputEl, startX, y, inputW, 66);
        if (colorBtn) hardPos(colorBtn, startX + clusterW - swatchW, y, swatchW, 66);
        y += 66 + gap;
      }
      all.forEach((b, i) => {
        const c = i % cols;
        const r = Math.floor(i / cols);
        hardPos(b, startX + c * (size + gap), y + r * (size + gap), size, size);
        b.dataset.ttLayout = 'circles';
        b.style.setProperty('border-radius', '50%', 'important');
        b.style.setProperty('font-size', '13px', 'important');
        b.style.setProperty('flex-direction', 'column', 'important');
        b.style.setProperty('justify-content', 'center', 'important');
        b.style.setProperty('gap', '6px', 'important');
      });
    }
  }

  /* ============================================================
   * CLIENT CHROME
   * ============================================================ */
  let chromeEl = null;
  function buildChrome() {
    const el = document.createElement('div');
    el.id = 'tt-chrome';
    el.dataset.ttOur = '1';
    Object.assign(el.style, {
      position:'fixed', top:'0', left:'0', right:'0', height:'34px',
      background:'linear-gradient(180deg, rgba(18,20,24,0.94), rgba(10,11,14,0.94))',
      borderBottom:'1px solid rgba(255,255,255,0.08)',
      color:'#e8eaf0', fontFamily:'system-ui,sans-serif',
      display:'flex', alignItems:'center', padding:'0 12px', gap:'10px',
      zIndex: 99990, userSelect:'none',
      backdropFilter:'blur(6px)', WebkitBackdropFilter:'blur(6px)'
    });
    const brand = document.createElement('div');
    brand.textContent = '⬢ Modatorial';
    brand.style.cssText = 'font-weight:700;letter-spacing:.4px;font-size:14px;';
    const badge = document.createElement('span');
    badge.textContent = 'v' + API.version;
    badge.style.cssText = 'font-size:10px;padding:2px 6px;border-radius:10px;background:#2b6a2b;color:#dfe;margin-left:6px;font-weight:600;';
    brand.appendChild(badge);
    const spacer = document.createElement('div'); spacer.style.flex = '1';

    const mkBtn = (label, title, fn) => {
      const b = document.createElement('button');
      b.textContent = label; b.title = title; b.dataset.ttOur = '1';
      Object.assign(b.style, {
        background:'rgba(255,255,255,0.06)', color:'#e8eaf0',
        border:'1px solid rgba(255,255,255,0.1)', borderRadius:'6px',
        padding:'3px 10px', fontFamily:'inherit', fontSize:'12px',
        cursor:'pointer', transition:'background .12s'
      });
      b.addEventListener('mouseenter', () => b.style.background = 'rgba(255,255,255,0.14)');
      b.addEventListener('mouseleave', () => b.style.background = 'rgba(255,255,255,0.06)');
      b.addEventListener('click', fn);
      return b;
    };
    const layoutBtn = mkBtn(
      '☷ ' + CLIENT.layout.charAt(0).toUpperCase() + CLIENT.layout.slice(1),
      'Cycle layout',
      () => {
        const order = ['sidebar','grid','circles'];
        const next = order[(order.indexOf(CLIENT.layout) + 1) % order.length];
        API.setLayout(next);
        layoutBtn.textContent = '☷ ' + next.charAt(0).toUpperCase() + next.slice(1);
      }
    );
    const modsBtn = mkBtn('🔧 Mods', 'Open mod menu', () => showMenu());
    const hideBtn = mkBtn('✕', 'Hide chrome', () => API.setChrome(false));

    el.append(brand, spacer, layoutBtn, modsBtn, hideBtn);
    return el;
  }
  function updateChrome() {
    if (chromeEl) { chromeEl.remove(); chromeEl = null; }
    if (CLIENT.chrome) {
      chromeEl = buildChrome();
      document.body.appendChild(chromeEl);
    }
  }

  /* ============================================================
   * MOD MENU
   * ============================================================ */
  let menuEl = null;
  let menuLayout = localStorage.getItem('tt-modlayout') || 'list';

  function makeToggle(disabled, onToggle) {
    const t = document.createElement('button');
    t.dataset.ttOur = '1';
    t.type = 'button';
    t.textContent = disabled ? 'Off' : 'On';
    Object.assign(t.style, {
      minWidth: '54px', padding: '6px 10px', borderRadius: '999px',
      border: '1px solid ' + (disabled ? 'rgba(255,80,80,0.4)' : 'rgba(80,220,120,0.5)'),
      background: disabled
        ? 'linear-gradient(180deg, rgba(80,20,20,0.85), rgba(50,10,10,0.85))'
        : 'linear-gradient(180deg, rgba(20,80,30,0.85), rgba(10,50,15,0.85))',
      color: disabled ? '#fbb' : '#cff', cursor: 'pointer',
      fontFamily: 'inherit', fontSize: '12px', fontWeight: 600
    });
    t.addEventListener('click', e => { e.stopPropagation(); onToggle(); });
    return t;
  }

  function buildMenu() {
    const root = document.createElement('div');
    root.dataset.ttOur = '1';
    Object.assign(root.style, {
      position:'fixed', inset:'0', background:'rgba(0,0,0,.88)',
      zIndex:100000, display:'none', flexDirection:'column',
      fontFamily:'system-ui,sans-serif', color:'#fff',
      padding:'24px', boxSizing:'border-box', overflow:'hidden'
    });
    const head = document.createElement('div');
    head.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;gap:8px;flex-wrap:wrap;';
    const h = document.createElement('h2');
    h.textContent = 'Mods';
    h.style.cssText = 'margin:0;font-size:22px;flex:1;min-width:80px;';
    const anyDisabled = () => [...mods.values()].some(m => disabledMods.has(m.id));
    const mkHead = (label, title, fn, danger) => {
      const b = document.createElement('button');
      b.dataset.ttOur = '1';
      b.textContent = label; b.title = title;
      b.style.cssText = `background:${danger ? '#6a2020' : '#333'};color:#fff;border:1px solid #555;padding:8px 12px;border-radius:6px;cursor:pointer;font-size:13px;font-family:inherit;`;
      b.addEventListener('click', fn); return b;
    };
    const toggleAllBtn = mkHead('⏻ Toggle All', 'Enable/disable all', () => {
      if (anyDisabled()) API.enableAllMods(); else API.disableAllMods();
    });
    const reloadBtn = mkHead('🔄 Reload', 'Apply changes', () => location.reload());
    const resetBtn  = mkHead('⟲ Reset', 'Clear disabled state', () => API.resetModState(), true);
    const layoutBtn = mkHead('☷', 'Toggle list/grid', () => {
      menuLayout = menuLayout === 'list' ? 'grid' : 'list';
      localStorage.setItem('tt-modlayout', menuLayout);
      render();
    });
    const close = mkHead('✕ Close', '', () => { root.style.display = 'none'; });
    head.append(h, toggleAllBtn, reloadBtn, resetBtn, layoutBtn, close);
    const container = document.createElement('div');
    container.style.cssText = 'overflow-y:auto;flex:1;';
    root.append(head, container);
    document.body.appendChild(root);

    function render() {
      layoutBtn.textContent = menuLayout === 'list' ? '☷' : '▦';
      container.innerHTML = '';
      if (!mods.size) {
        container.innerHTML = '<div style="opacity:.6;font-style:italic">No mods found.</div>';
        return;
      }
      if (menuLayout === 'list') {
        container.style.cssText = 'overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:8px;';
        for (const m of mods.values()) {
          const isOff = disabledMods.has(m.id);
          const row = document.createElement('div');
          row.dataset.ttOur = '1';
          row.style.cssText =
            `display:flex;align-items:center;gap:14px;background:${isOff ? '#15171c' : '#1c1f24'};` +
            `border:1px solid ${isOff ? '#2a2d33' : '#333'};border-radius:8px;padding:12px 16px;` +
            `opacity:${isOff ? 0.55 : 1};`;
          const thumb = document.createElement('div');
          thumb.style.cssText = 'width:56px;height:56px;flex:0 0 56px;border-radius:6px;overflow:hidden;background:#000;display:flex;align-items:center;justify-content:center;font-size:24px;';
          if (m.iconUrl) {
            const i = document.createElement('img'); i.src = m.iconUrl;
            i.style.cssText = 'width:100%;height:100%;object-fit:cover;';
            thumb.appendChild(i);
          } else thumb.textContent = '🔧';
          const info = document.createElement('div');
          info.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:2px;min-width:0;';
          info.innerHTML =
            `<div style="font-weight:bold;font-size:15px">${m.name}</div>
             <div style="font-size:12px;opacity:.7">v${m.version} · ${m.author}</div>
             <div style="font-size:12px;opacity:.85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${m.description||''}</div>`;
          const status = document.createElement('div');
          status.style.cssText = 'font-size:11px;opacity:.55;text-align:right;min-width:80px;';
          status.textContent = isOff ? 'disabled' :
            (m.status === 'error' ? ('Error: ' + (m.error?.message || '?')) : m.status);
          row.append(thumb, info, status, makeToggle(isOff, () => API.toggleMod(m.id)));
          container.appendChild(row);
        }
      } else {
        container.style.cssText = 'overflow-y:auto;flex:1;display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:16px;';
        for (const m of mods.values()) {
          const isOff = disabledMods.has(m.id);
          const card = document.createElement('div');
          card.dataset.ttOur = '1';
          card.style.cssText =
            `background:${isOff ? '#15171c' : '#1c1f24'};border:1px solid ${isOff ? '#2a2d33' : '#333'};` +
            `border-radius:8px;overflow:hidden;display:flex;flex-direction:column;opacity:${isOff ? 0.6 : 1};`;
          if (m.iconUrl) {
            const i = document.createElement('img'); i.src = m.iconUrl;
            i.style.cssText = 'width:100%;height:130px;object-fit:cover;background:#000;';
            card.appendChild(i);
          }
          const body = document.createElement('div');
          body.style.cssText = 'padding:12px;display:flex;flex-direction:column;gap:6px;flex:1;';
          body.innerHTML =
            `<div style="font-weight:bold;font-size:15px">${m.name}</div>
             <div style="font-size:12px;opacity:.7">v${m.version} · ${m.author}</div>
             <div style="font-size:12px;opacity:.85;flex:1">${m.description||''}</div>
             <div style="font-size:11px;opacity:.55">${isOff ? 'disabled' : (m.status === 'error' ? 'Error: '+(m.error?.message||'?') : m.status)}</div>`;
          const tw = document.createElement('div');
          tw.style.cssText = 'padding:0 12px 12px 12px;display:flex;justify-content:flex-end;';
          tw.appendChild(makeToggle(isOff, () => API.toggleMod(m.id)));
          card.append(body, tw);
          container.appendChild(card);
        }
      }
    }
    return { root, render };
  }
  function showMenu() {
    if (!menuEl) menuEl = buildMenu();
    menuEl.render();
    menuEl.root.style.display = 'flex';
  }
  function hideMenu() { if (menuEl) menuEl.root.style.display = 'none'; }
  function toggleMenu2() {
    if (menuEl && menuEl.root.style.display === 'flex') hideMenu(); else showMenu();
  }
  window.addEventListener('keydown', e => {
    if (e.key === 'F10') { e.preventDefault(); toggleMenu2(); }
  });

  /* ============================================================
   * STORE + CLAN BAR KILLERS
   * ============================================================ */
  function killStoreIcons() {
    const TT = window.__TT__;
    if (!TT || !TT.bb) return false;
    const bb = TT.bb;
    if (bb.gM && !bb.__ttStoreHidden) {
      for (let i = 0; i < bb.gM.length; i++) bb.gM[i] = false;
      bb.__ttStoreHidden = true;
      log('Hid store icons');
      return true;
    }
    return false;
  }
  function isClanBarNode(n) {
    if (!n || n.nodeType !== 1 || n.tagName !== 'DIV') return false;
    if (n.style.position !== 'absolute' || !n.style.border) return false;
    const k = n.children;
    if (k.length !== 2) return false;
    if (!k[0].querySelector || !k[0].querySelector(':scope > canvas')) return false;
    if (!k[1].querySelectorAll || k[1].querySelectorAll('button').length < 4) return false;
    return true;
  }
  const origBodyAppend = document.body.appendChild.bind(document.body);
  document.body.appendChild = function (node) {
    try { if (isClanBarNode(node)) { node.style.display = 'none'; log('Hid clan bar'); } } catch {}
    return origBodyAppend(node);
  };
  function sweepClanBar() {
    for (const n of document.body.children) {
      if (isClanBarNode(n) && !n.dataset.ttHidden) {
        n.style.display = 'none';
        n.dataset.ttHidden = 'clanbar';
        log('Hid clan bar');
      }
    }
  }

  /* ============================================================
   * MOD LOADER
   * ============================================================ */
  async function loadManifest() {
    try {
      const res = await fetch(MANIFEST, { cache:'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      return Array.isArray(d.mods) ? d.mods : [];
    } catch (e) { warn(`No ${MANIFEST} (${e.message})`); return []; }
  }
  async function loadMod(id) {
    const basePath = MODS_DIR + id + '/';
    const meta = {
      id, basePath, name: id, version:'0.0.0', author:'Unknown',
      description:'', icon:null, main:'main.js',
      enabled: !disabledMods.has(id),
      status:'loading', iconUrl:null, exports:{}
    };
    try {
      const mRes = await fetch(basePath + 'mod.json', { cache:'no-store' });
      if (mRes.ok) Object.assign(meta, await mRes.json());
      meta.id = id; meta.basePath = basePath;
      if (meta.icon) {
        try {
          const h = await fetch(basePath + meta.icon, { method:'HEAD', cache:'no-store' });
          meta.iconUrl = h.ok ? basePath + meta.icon : null;
        } catch { meta.iconUrl = null; }
      }
      if (disabledMods.has(id)) {
        meta.status = 'disabled';
        log(`⏸ Skipped (disabled): ${meta.name}`);
        mods.set(id, meta); emit('modLoaded', meta); return meta;
      }
      if (meta.enabled === false) {
        meta.status = 'disabled';
        log(`⏸ Skipped (mod.json): ${meta.name}`);
        mods.set(id, meta); emit('modLoaded', meta); return meta;
      }
      if (meta.main !== false) {
        const sRes = await fetch(basePath + meta.main, { cache:'no-store' });
        if (!sRes.ok) throw new Error(`main script HTTP ${sRes.status}`);
        const code = await sRes.text();
        const factory = new Function('api', 'mod',
          `"use strict";\n${code}\n//# sourceURL=${basePath}${meta.main}`);
        meta.exports = factory(API, meta) || {};
      }
      meta.status = 'loaded';
      log(`✅ Loaded: ${meta.name} (${id}) v${meta.version}`);
    } catch (e) {
      meta.status = 'error'; meta.error = e;
      err(`Failed to load ${id}:`, e);
    }
    mods.set(id, meta);
    emit('modLoaded', meta);
    return meta;
  }
  async function loadAll() {
    const ids = await loadManifest();
    log(`Manifest: ${ids.join(', ')}`);
    const out = [];
    for (const id of ids) out.push(await loadMod(id));
    emit('modsLoaded', out);
    return out;
  }

  /* ============================================================
   * MODS BUTTON
   * ============================================================ */
  const MODS_BG_BASE  = 'linear-gradient(180deg,rgba(0,110,0,0.92) 0%,rgba(0,70,0,0.92) 100%)';
  const MODS_BG_HOVER = 'linear-gradient(180deg,rgba(0,160,0,0.95) 0%,rgba(0,90,0,0.95) 100%)';
  function injectModsButton() {
    if (document.getElementById(MODS_BTN_ID)) return;
    const btns = getMainMenuButtons();
    if (btns.length < 1) return;
    const btn = document.createElement('button');
    btn.id = MODS_BTN_ID;
    btn.dataset.ttOur = '1';
    btn.dataset.ttLabel = 'Mods';
    btn.type = 'button';
    Object.assign(btn.style, {
      color:'#fff', userSelect:'none', outline:'none', overflowWrap:'break-word',
      background: MODS_BG_BASE, border:'2.2px solid #fff',
      font: btns[0].style.font || '17.55px system-ui', padding:'0em 0.3em',
      cursor:'pointer', textAlign:'center', lineHeight:'1.2'
    });
    btn.addEventListener('mouseenter', () => { btn.style.background = MODS_BG_HOVER; });
    btn.addEventListener('mouseleave', () => { btn.style.background = MODS_BG_BASE; });
    btn.addEventListener('click', () => showMenu());
    document.body.appendChild(btn);
  }

  /* ============================================================
   * BOOT
   * ============================================================ */
  function boot() {
    log(`Territorial.io Mod Loader v${API.version} (game r${API.gameVersion}) — patch 1`);
    log(`Disabled at boot: [${[...disabledMods].join(', ') || 'empty'}]`);
    log(`Layout: ${CLIENT.layout}`);

    if (!document.getElementById('tt-client-css')) {
      const link = document.createElement('link');
      link.id = 'tt-client-css';
      link.rel = 'stylesheet';
      link.href = 'css/client.css';
      document.head.appendChild(link);
    }

    // Run icons BEFORE layout so buttons are marked early
    const refresh = () => {
      injectModsButton();
      applyIcons();
      applyLayout();
    };

    setInterval(filterMenuPopupButtons, 100);
    setInterval(filterMultiplayer,      100);
    setInterval(refresh,                300);
    setInterval(sweepClanBar,           500);

    window.addEventListener('resize', refresh);

    // Immediate first pass
    setTimeout(refresh, 0);

    const ivBg    = setInterval(() => { if (patchMenuBackground()) clearInterval(ivBg); }, 200);
    const ivLogo  = setInterval(() => { if (patchLogo())          clearInterval(ivLogo); }, 200);
    const ivDraw  = setInterval(() => { if (patchMenuDraw())      clearInterval(ivDraw); }, 200);
    const ivStore = setInterval(() => { if (killStoreIcons())     clearInterval(ivStore); }, 200);
    const ivClut  = setInterval(() => { if (hideMenuClutter())    clearInterval(ivClut); }, 200);

    updateChrome();

    loadAll().then(list => {
      const active = list.filter(m => m.status === 'loaded').length;
      const off    = list.filter(m => m.status === 'disabled').length;
      log(`Done. Active: ${active}, Disabled: ${off}. Press F10 to toggle.`);
      emit('ready', list);
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else boot();

})(window);