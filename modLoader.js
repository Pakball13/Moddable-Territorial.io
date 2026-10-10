/* ============================================================
 * Territorial.io Mod Loader  v1.3.1  (Client Edition)
 * ============================================================ */
(function (global) {
  'use strict';

  const MODS_DIR  = 'mods/';
  const MANIFEST  = MODS_DIR + 'manifest.json';
  const LOG_PFX   = '%c[ModLoader]';
  const LOG_STYLE = 'color:#7bd;font-weight:bold';

  const log  = (...a) => console.log  (LOG_PFX, LOG_STYLE, ...a);
  const warn = (...a) => console.warn (LOG_PFX, LOG_STYLE, ...a);
  const err  = (...a) => console.error(LOG_PFX, LOG_STYLE, ...a);

  /* ---------- hook system ---------- */
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
  const addHook  = (name, fn) => { if (hooks[name]) hooks[name].push(fn); };
  const runHooks = (name, ...args) => {
    const l = hooks[name]; if (!l) return;
    for (const fn of l) { try { fn(...args); } catch (e) { err(`hook ${name}`, e); } }
  };

  const mods = new Map();

  /* ---------- client state ---------- */
  const CLIENT = {
    layout:          localStorage.getItem('tt-layout') || 'grid',
    chrome:          localStorage.getItem('tt-chrome') !== '0',
    hideMenuButtons: localStorage.getItem('tt-hidemenu') !== '0',
    hideLogo:        localStorage.getItem('tt-hidelogo') !== '0',
    hideVersion:     localStorage.getItem('tt-hideversion') !== '0',
    hideMultiplayer: localStorage.getItem('tt-hidemulti') !== '0'
  };

  /* ---------- public API ---------- */
  const API = {
    version: '1.3.1',
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

    /* -------- layout / chrome -------- */
    setLayout(mode) {
      if (!['grid','list','circles'].includes(mode)) return false;
      CLIENT.layout = mode;
      localStorage.setItem('tt-layout', mode);
      applyLayout(true);
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

    /* panorama mod uses this */
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
      readyState: 0, CONNECTING:0, OPEN:1, CLOSING:2, CLOSED:3,
      onopen:null, onerror:null, onmessage:null, onclose:null,
      addEventListener(t, fn) { (L[t] || (L[t]=[])).push(fn); },
      removeEventListener(t, fn) {
        const l = L[t]; if (!l) return;
        const i = l.indexOf(fn); if (i>=0) l.splice(i,1);
      },
      dispatchEvent() { return true; },
      send() {},
      close() { this.readyState = 3; }
    };
  }

  function WSProxy(url, protocols) {
    if (isBlocked(url)) {
      try { log(`↳ blocked WS to ${url}`); } catch {}
      return makeFakeWS(url);
    }
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
  API.isBlockedHost = hostMatches;

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
   * PATCH #4 — Canvas2D  (drawImage hooks + fillText filter)
   * ============================================================ */
  const OrigCtx = CanvasRenderingContext2D.prototype;
  const origDrawImage = OrigCtx.drawImage;
  OrigCtx.drawImage = function (...args) {
    try { runHooks('preRender', this); } catch (e) { err(e); }
    const r = origDrawImage.apply(this, args);
    try { runHooks('postRender', this); } catch (e) { err(e); }
    return r;
  };

  /* Hide the in-game version string (e.g. "25 Sep 2026 [2.16.54]") */
  const origFillText = OrigCtx.fillText;
  const VERSION_RE = /^\d{1,2}\s+\w{3,}\s+\d{4}\s*\[/;
  OrigCtx.fillText = function (text, x, y, maxWidth) {
    if (CLIENT.hideVersion && typeof text === 'string' && VERSION_RE.test(text)) {
      return;
    }
    return maxWidth !== undefined
      ? origFillText.call(this, text, x, y, maxWidth)
      : origFillText.call(this, text, x, y);
  };

  /* ============================================================
   * MENU CLUTTER REMOVAL
   * ============================================================ */
  const HIDE_POPUP = [
    'Logs', 'Game Log', 'Clan Charts', 'Gold Transfer',
    'Join Lobby 2', 'Account Recovery', 'Delete Data',
    'Privacy Settings', 'Links', 'Replay', 'Force Restart Game'
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

  function filterMenuPopupButtons() {
    if (!CLIENT.hideMenuButtons) {
      document.querySelectorAll('button[data-tt-hid]').forEach(b => {
        b.style.removeProperty('display'); delete b.dataset.ttHid;
      });
      return;
    }
    document.querySelectorAll('button').forEach(btn => {
      if (isOurButton(btn)) return;
      const txt = stripEmoji(btn.textContent);
      if (!txt) return;
      if (HIDE_POPUP.some(h => txt === h || txt.includes(h))) {
        if (btn.style.display !== 'none') {
          btn.style.display = 'none';
          btn.dataset.ttHid = '1';
        }
      }
    });
  }

  function filterMultiplayer() {
    document.querySelectorAll('body > button').forEach(btn => {
      if (isOurButton(btn)) return;
      const txt = stripEmoji(btn.textContent);
      if (!txt) return;
      if (txt.includes('Multiplayer')) {
        if (CLIENT.hideMultiplayer) {
          if (btn.style.display !== 'none') {
            btn.style.display = 'none';
            btn.dataset.ttMulti = '1';
          }
        } else if (btn.dataset.ttMulti) {
          btn.style.removeProperty('display');
          delete btn.dataset.ttMulti;
        }
      }
    });
  }

  /* ============================================================
   * GAME-INTERNALS HOOKS
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
        } catch (e) { err('menu background hook', e); }
      }
    };
    ab.__ttBgPatched = true;
    log('🖼 Menu background hook installed');
    return true;
  }

  /* Return a blank canvas instead of the territorial.io logo */
  function patchLogo() {
    const TT = window.__TT__;
    if (!TT || !TT.ac || typeof TT.ac.aIh !== 'function') return false;
    const ac = TT.ac;
    if (ac.__ttLogoPatched) return true;
    const orig = ac.aIh.bind(ac);
    ac.aIh = function (name) {
      if (name === 'territorial.io' && CLIENT.hideLogo) {
        const c = document.createElement('canvas');
        c.width = 1; c.height = 1;
        return c;
      }
      return orig(name);
    };
    ac.__ttLogoPatched = true;
    log('🖼 Territorial.io logo blanked');
    return true;
  }

  function hideMenuClutter() {
    const TT = window.__TT__;
    if (!TT) return false;
    let done = true;
    if (TT.aU && typeof TT.aU.wr === 'function' && !TT.aU.__ttHidden) {
      TT.aU.wr = () => {}; TT.aU.__ttHidden = true;
      log('Hid bottom timeline bars');
    } else if (!TT.aU) done = false;
    if (TT.aP && typeof TT.aP.wr === 'function' && !TT.aP.__ttHidden) {
      TT.aP.wr = () => {}; TT.aP.__ttHidden = true;
      log('Hid right-side contest countdown');
    } else if (!TT.aP) done = false;
    return done;
  }

  /* ============================================================
   * LAYOUT ENGINE — caches grid positions
   * ============================================================ */
  const MAIN_MENU_KEYS = ['Multiplayer','Custom Scenario','My Account','Game Menu'];
  const gridCache = new Map();

  function isMainMenuButton(btn) {
    if (!btn || btn.tagName !== 'BUTTON') return false;
    if (isOurButton(btn)) return false;
    if (btn.parentElement !== document.body) return false;
    const html = btn.innerHTML || '';
    if (!html.includes('<br>')) return false;
    return MAIN_MENU_KEYS.some(k => html.includes(k));
  }
  function getMainMenuButtons() {
    return [...document.querySelectorAll('body > button')].filter(isMainMenuButton);
  }
  function btnKey(b) { return stripEmoji(b.textContent).slice(0, 40); }

  function cacheGridPositions() {
    const btns = getMainMenuButtons();
    if (btns.length < 2) return;
    btns.forEach(b => {
      if (gridCache.has(btnKey(b))) return;
      gridCache.set(btnKey(b), {
        left: b.style.left, top: b.style.top,
        width: b.style.width, height: b.style.height,
        borderRadius: b.style.borderRadius || '',
        boxShadow: b.style.boxShadow || '',
        fontSize: b.style.fontSize || ''
      });
    });
  }
  function restoreGrid(btns) {
    btns.forEach(b => {
      const p = gridCache.get(btnKey(b));
      if (!p) return;
      b.style.left = p.left;
      b.style.top = p.top;
      b.style.width = p.width;
      b.style.height = p.height;
      b.style.borderRadius = p.borderRadius;
      b.style.boxShadow = p.boxShadow;
      b.style.fontSize = p.fontSize;
    });
  }

  function applyLayout(force) {
    const btns = getMainMenuButtons();
    if (btns.length < 2) return;
    cacheGridPositions();

    if (CLIENT.layout === 'grid') {
      restoreGrid(btns);
      return;
    }

    if (CLIENT.layout === 'list') {
      // Bounding box of the natural grid
      let minL = Infinity, minT = Infinity, maxR = -Infinity, h0 = 79;
      btns.forEach(b => {
        const l = parseFloat(b.style.left) || 0;
        const t = parseFloat(b.style.top)  || 0;
        const w = parseFloat(b.style.width)|| 0;
        const hh= parseFloat(b.style.height)|| 79;
        minL = Math.min(minL, l); minT = Math.min(minT, t);
        maxR = Math.max(maxR, l + w); h0 = hh;
      });
      const gap = 8;
      btns.forEach((b, i) => {
        b.style.left = minL + 'px';
        b.style.top  = (minT + i * (h0 + gap)) + 'px';
        b.style.width  = (maxR - minL) + 'px';
        b.style.height = h0 + 'px';
        b.style.borderRadius = '6px';
        b.style.boxShadow = '0 0 0 1px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15)';
        b.style.fontSize = '';
      });
      return;
    }

    if (CLIENT.layout === 'circles') {
      // Sort visually: top row left→right, then bottom row
      const sorted = btns.slice().sort((a, b) => {
        const al = parseFloat(a.style.left) || 0, bl = parseFloat(b.style.left) || 0;
        const at = parseFloat(a.style.top)  || 0, bt = parseFloat(b.style.top)  || 0;
        if (Math.abs(at - bt) > 20) return at - bt;
        return al - bl;
      });
      // Find base anchor and size from grid cache
      let minL = Infinity, minT = Infinity, maxSize = 0;
      btns.forEach(b => {
        const p = gridCache.get(btnKey(b));
        if (!p) return;
        minL = Math.min(minL, parseFloat(p.left) || 0);
        minT = Math.min(minT, parseFloat(p.top)  || 0);
        maxSize = Math.max(maxSize,
          parseFloat(p.width) || 0, parseFloat(p.height) || 0);
      });
      const gap = 14;
      const size = Math.max(maxSize + 24, 120);
      // Figure out how many columns the original grid had
      const tops = new Set(btns.map(b => Math.round(parseFloat(b.style.top) || 0)));
      const cols = tops.size > 1 ? Math.max(1, Math.ceil(btns.length / tops.size)) : 1;
      sorted.forEach((b, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        b.style.left = (minL + col * (size + gap)) + 'px';
        b.style.top  = (minT + row * (size + gap)) + 'px';
        b.style.width  = size + 'px';
        b.style.height = size + 'px';
        b.style.borderRadius = '50%';
        b.style.boxShadow = '0 0 0 2px rgba(255,255,255,0.6), 0 4px 18px rgba(0,0,0,0.5)';
        b.style.fontSize = '13px';
      });
    }
  }

  /* ============================================================
   * CLIENT CHROME BAR
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
    const spacer = document.createElement('div');
    spacer.style.flex = '1';

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
      'Cycle layout: grid → list → circles',
      () => {
        const order = ['grid','list','circles'];
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
    head.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;gap:12px;';
    const h = document.createElement('h2');
    h.textContent = 'Mods';
    h.style.cssText = 'margin:0;font-size:22px;flex:1;';
    const layoutBtn = document.createElement('button');
    layoutBtn.dataset.ttOur = '1';
    layoutBtn.style.cssText = 'background:#333;color:#fff;border:1px solid #555;padding:8px 14px;border-radius:6px;cursor:pointer;font-size:13px;font-family:inherit;';
    const close = document.createElement('button');
    close.dataset.ttOur = '1';
    close.textContent = '✕ Close';
    close.style.cssText = 'background:#444;color:#fff;border:0;padding:8px 16px;border-radius:6px;cursor:pointer;font-family:inherit;';
    close.onclick = () => root.style.display = 'none';
    head.append(h, layoutBtn, close);

    const container = document.createElement('div');
    container.style.cssText = 'overflow-y:auto;flex:1;';
    root.append(head, container);
    document.body.appendChild(root);

    function render() {
      layoutBtn.textContent = menuLayout === 'list' ? '☷ List' : '▦ Grid';
      container.innerHTML = '';
      if (!mods.size) {
        container.innerHTML = '<div style="opacity:.6;font-style:italic">No mods found.</div>';
        return;
      }
      if (menuLayout === 'list') {
        container.style.cssText = 'overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:8px;';
        for (const m of mods.values()) {
          const row = document.createElement('div');
          row.dataset.ttOur = '1';
          row.style.cssText = 'display:flex;align-items:center;gap:14px;background:#1c1f24;border:1px solid #333;border-radius:8px;padding:12px 16px;';
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
          status.style.cssText = 'font-size:11px;opacity:.55;';
          status.textContent = m.status === 'error' ? ('Error: ' + (m.error?.message || '?')) : m.status;
          row.append(thumb, info, status);
          container.appendChild(row);
        }
      } else {
        container.style.cssText = 'overflow-y:auto;flex:1;display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:16px;';
        for (const m of mods.values()) {
          const card = document.createElement('div');
          card.dataset.ttOur = '1';
          card.style.cssText = 'background:#1c1f24;border:1px solid #333;border-radius:8px;overflow:hidden;display:flex;flex-direction:column;';
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
             <div style="font-size:11px;opacity:.55">${m.status === 'error' ? 'Error: '+(m.error?.message||'?') : m.status}</div>`;
          card.appendChild(body);
          container.appendChild(card);
        }
      }
    }
    layoutBtn.addEventListener('click', () => {
      menuLayout = menuLayout === 'list' ? 'grid' : 'list';
      localStorage.setItem('tt-modlayout', menuLayout);
      render();
    });
    return { root, render };
  }

  function showMenu() {
    if (!menuEl) menuEl = buildMenu();
    menuEl.render();
    menuEl.root.style.display = 'flex';
  }
  function hideMenu() { if (menuEl) menuEl.root.style.display = 'none'; }
  function toggleMenu2() {
    if (menuEl && menuEl.root.style.display === 'flex') hideMenu();
    else showMenu();
  }
  window.addEventListener('keydown', e => {
    if (e.key === 'F10') { e.preventDefault(); toggleMenu2(); }
  });

  /* ============================================================
   * STORE-ICON + CLAN-BAR KILLERS
   * ============================================================ */
  function killStoreIcons() {
    const TT = window.__TT__;
    if (!TT || !TT.bb) return false;
    const bb = TT.bb;
    if (bb.gM && !bb.__ttStoreHidden) {
      for (let i = 0; i < bb.gM.length; i++) bb.gM[i] = false;
      bb.__ttStoreHidden = true;
      log('Hid store/discord icons');
      return true;
    }
    return false;
  }
  function isClanBarNode(n) {
    if (!n || n.nodeType !== 1 || n.tagName !== 'DIV') return false;
    if (n.style.position !== 'absolute') return false;
    if (!n.style.border) return false;
    const kids = n.children;
    if (kids.length !== 2) return false;
    const a = kids[0], b = kids[1];
    if (!a.querySelector || !a.querySelector(':scope > canvas')) return false;
    if (!b.querySelectorAll) return false;
    if (b.querySelectorAll('button').length < 4) return false;
    return true;
  }
  function hideClanBarNode(n) {
    if (isClanBarNode(n) && !n.dataset.ttHidden) {
      n.style.display = 'none';
      n.dataset.ttHidden = 'clanbar';
      log('Hid clan bar');
      return true;
    }
    return false;
  }
  const origBodyAppend = document.body.appendChild.bind(document.body);
  document.body.appendChild = function (node) {
    try { if (isClanBarNode(node)) hideClanBarNode(node); } catch {}
    return origBodyAppend(node);
  };
  function sweepClanBar() {
    for (const n of document.body.children) hideClanBarNode(n);
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
      enabled:true, status:'loading', iconUrl:null, exports:{}
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
      if (meta.enabled !== false && meta.main !== false) {
        const sRes = await fetch(basePath + meta.main, { cache:'no-store' });
        if (!sRes.ok) throw new Error(`main script HTTP ${sRes.status}`);
        const code = await sRes.text();
        const factory = new Function('api', 'mod',
          `"use strict";\n${code}\n//# sourceURL=${basePath}${meta.main}`);
        meta.exports = factory(API, meta) || {};
      }
      meta.status = 'loaded';
      log(`Loaded: ${meta.name} (${id}) v${meta.version}`);
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
    const out = [];
    for (const id of ids) out.push(await loadMod(id));
    emit('modsLoaded', out);
    return out;
  }

  /* ============================================================
   * MODS BUTTON — positions relative to all main-menu buttons
   * ============================================================ */
  const MODS_BTN_ID = 'tt-mods-btn';
  const MODS_BG_BASE  = 'linear-gradient(180deg,rgba(0,110,0,0.92) 0%,rgba(0,70,0,0.92) 100%)';
  const MODS_BG_HOVER = 'linear-gradient(180deg,rgba(0,160,0,0.95) 0%,rgba(0,90,0,0.95) 100%)';

  function injectModsButton() {
    const btns = getMainMenuButtons();
    const existing = document.getElementById(MODS_BTN_ID);

    if (btns.length < 2) { if (existing) existing.remove(); return; }

    let minL = Infinity, minT = Infinity, maxR = -Infinity, maxB = -Infinity;
    btns.forEach(b => {
      const l = parseFloat(b.style.left) || 0;
      const t = parseFloat(b.style.top)  || 0;
      const w = parseFloat(b.style.width)|| 0;
      const hh= parseFloat(b.style.height)|| 79;
      minL = Math.min(minL, l); minT = Math.min(minT, t);
      maxR = Math.max(maxR, l + w); maxB = Math.max(maxB, t + hh);
    });
    const h0 = parseFloat(btns[0].style.height) || 79;

    if (existing) {
      existing.style.left   = minL + 'px';
      existing.style.top    = (maxB + 8) + 'px';
      existing.style.width  = (maxR - minL) + 'px';
      existing.style.height = h0 + 'px';
      return;
    }

    const btn = document.createElement('button');
    btn.id = MODS_BTN_ID;
    btn.dataset.ttOur = '1';
    btn.type = 'button';
    btn.innerHTML = '🔧<br>Mods';
    Object.assign(btn.style, {
      color:'#fff', userSelect:'none', outline:'none', overflowWrap:'break-word',
      background: MODS_BG_BASE, border:'2.2px solid #fff',
      font: btns[0].style.font || '17.55px system-ui', padding:'0em 0.3em',
      position:'absolute', cursor:'pointer', textAlign:'center',
      lineHeight:'1.2', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center',
      zIndex: 9999, transition:'background .15s, transform .08s',
      boxShadow:'0 0 0 1px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15)'
    });
    btn.addEventListener('mouseenter', () => { btn.style.background = MODS_BG_HOVER; });
    btn.addEventListener('mouseleave', () => { btn.style.background = MODS_BG_BASE; });
    btn.addEventListener('mousedown',  () => { btn.style.transform = 'scale(0.97)'; });
    btn.addEventListener('mouseup',    () => { btn.style.transform = 'scale(1)';   });
    btn.addEventListener('click',      () => showMenu());

    btn.style.left   = minL + 'px';
    btn.style.top    = (maxB + 8) + 'px';
    btn.style.width  = (maxR - minL) + 'px';
    btn.style.height = h0 + 'px';

    document.body.appendChild(btn);
  }

  /* ============================================================
   * BOOT
   * ============================================================ */
  function boot() {
    log(`Territorial.io Mod Loader v${API.version} (game r${API.gameVersion})`);

    setInterval(filterMenuPopupButtons, 300);
    setInterval(filterMultiplayer,      300);
    setInterval(injectModsButton,       500);
    setInterval(applyLayout,            400);
    setInterval(sweepClanBar,           500);

    window.addEventListener('resize', () => {
      injectModsButton(); applyLayout();
    });

    // wait for game internals, then patch (idempotent)
    const ivBg    = setInterval(() => { if (patchMenuBackground()) clearInterval(ivBg); }, 200);
    const ivLogo  = setInterval(() => { if (patchLogo())          clearInterval(ivLogo); }, 200);
    const ivStore = setInterval(() => { if (killStoreIcons())     clearInterval(ivStore); }, 200);
    const ivClut  = setInterval(() => { if (hideMenuClutter())    clearInterval(ivClut); }, 200);

    updateChrome();

    loadAll().then(list => {
      log(`Done. ${list.length} mod(s). Click "Mods" or press F10.`);
      log(`📐 Layout = ${CLIENT.layout}  ·  try TerritorialMods.setLayout('grid'|'list'|'circles')`);
      emit('ready', list);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else boot();

})(window);