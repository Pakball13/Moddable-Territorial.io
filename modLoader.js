/* ============================================================
 * Territorial.io Mod Loader  v1.2.0
 * Drop this file next to index.html and include it BEFORE the
 * inline game script.  Mods live in ./mods/<id>/.
 *
 * Secrets:
 *   TerritorialMods.names()  →  rebrand title to modatorial.io
 *   TerritorialMods.offlineMode = false  →  re-enable WS
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

  /* ---------- event + hook system ---------- */
  const listeners = new Map();
  const hooks = {
    preUpdate: [], postUpdate: [],
    preRender: [], postRender: [],
    netSend:   [], netRecv:   [],
    keyDown:   [], keyUp:     [],
    mouseDown: [], mouseUp:   [], mouseMove: []
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

  /* ---------- mod registry ---------- */
  const mods = new Map();

  /* ============================================================
   * PUBLIC API
   * ============================================================ */
  const API = {
    version:     '1.2.0',
    gameVersion: 25,
    getGame() { return window.__TT__ || null; },
    on, off, emit, addHook,
    mods,
    log: (...a) => log(...a),
    warn:(...a) => warn(...a),
    error:(...a)=> err(...a),

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
    }
  };
  global.TerritorialMods = API;

  /* ============================================================
   * PATCH #1 — WebSocket (with offline block)
   * ============================================================ */
  const OrigWS = global.WebSocket;
  const BLOCKED_HOSTS = ['territorial.io', '1.territorial.io', '2.territorial.io'];

  function hostMatches(url) {
    try {
      const u = new URL(url, location.href);
      const host = u.hostname.toLowerCase();
      return BLOCKED_HOSTS.some(h => host === h || host.endsWith('.' + h));
    } catch { return false; }
  }
  function isBlocked(url) { return API.offlineMode && hostMatches(url); }

  function makeFakeWS(url) {
    const listeners = Object.create(null);
    return {
      url: String(url), protocol: '', extensions: '',
      bufferedAmount: 0, binaryType: 'arraybuffer',
      readyState: 0,
      CONNECTING: 0, OPEN: 1, CLOSING: 2, CLOSED: 3,
      onopen: null, onerror: null, onmessage: null, onclose: null,
      addEventListener(t, fn) { (listeners[t] || (listeners[t] = [])).push(fn); },
      removeEventListener(t, fn) {
        const l = listeners[t]; if (!l) return;
        const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1);
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
  WSProxy.prototype   = OrigWS.prototype;
  WSProxy.CONNECTING  = OrigWS.CONNECTING;
  WSProxy.OPEN        = OrigWS.OPEN;
  WSProxy.CLOSING     = OrigWS.CLOSING;
  WSProxy.CLOSED      = OrigWS.CLOSED;
  global.WebSocket    = WSProxy;

  API.offlineMode   = true;
  API.blockedHosts  = BLOCKED_HOSTS;
  API.isBlockedHost = hostMatches;

  /* ============================================================
   * PATCH #2 — requestAnimationFrame
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
   * PATCH #3 — global input events
   * ============================================================ */
  const inputMap = {
    keydown:'keyDown', keyup:'keyUp',
    mousedown:'mouseDown', mouseup:'mouseUp', mousemove:'mouseMove'
  };
  for (const evt in inputMap) {
    window.addEventListener(evt, e => {
      emit(evt, e);
      runHooks(inputMap[evt], e);
    }, false);
  }

  /* ============================================================
   * PATCH #4 — Canvas2D render hooks
   * ============================================================ */
  const OrigCtx = CanvasRenderingContext2D.prototype;
  const origDrawImage = OrigCtx.drawImage;
  OrigCtx.drawImage = function (...args) {
    try { runHooks('preRender', this); } catch (e) { err(e); }
    const r = origDrawImage.apply(this, args);
    try { runHooks('postRender', this); } catch (e) { err(e); }
    return r;
  };

  /* ============================================================
   * MOD LOADING
   * ============================================================ */
  async function loadManifest() {
    try {
      const res = await fetch(MANIFEST, { cache:'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return Array.isArray(data.mods) ? data.mods : [];
    } catch (e) {
      warn(`No ${MANIFEST} (${e.message}). No mods will be loaded.`);
      return [];
    }
  }

  async function loadMod(id) {
    const basePath = MODS_DIR + id + '/';
    const meta = {
      id, basePath,
      name: id, version: '0.0.0', author: 'Unknown',
      description: '', icon: null, main: 'main.js',
      enabled: true, status: 'loading', iconUrl: null, exports: {}
    };
    try {
      const mRes = await fetch(basePath + 'mod.json', { cache:'no-store' });
      if (mRes.ok) Object.assign(meta, await mRes.json());
      meta.id = id; meta.basePath = basePath;

      if (meta.icon) {
        try {
          const head = await fetch(basePath + meta.icon, { method:'HEAD', cache:'no-store' });
          meta.iconUrl = head.ok ? basePath + meta.icon : null;
        } catch { meta.iconUrl = null; }
      }

      if (meta.enabled !== false && meta.main !== false) {
        const sRes = await fetch(basePath + meta.main, { cache:'no-store' });
        if (!sRes.ok) throw new Error(`main script HTTP ${sRes.status}`);
        const code = await sRes.text();
        const factory = new Function(
          'api', 'mod',
          `"use strict";\n${code}\n//# sourceURL=${basePath}${meta.main}`
        );
        meta.exports = factory(API, meta) || {};
      }
      meta.status = 'loaded';
      log(`Loaded: ${meta.name} (${id}) v${meta.version}`);
    } catch (e) {
      meta.status = 'error';
      meta.error  = e;
      err(`Failed to load ${id}:`, e);
    }
    mods.set(id, meta);
    emit('modLoaded', meta);
    return meta;
  }

  async function loadAll() {
    const ids = await loadManifest();
    const loaded = [];
    for (const id of ids) loaded.push(await loadMod(id));
    emit('modsLoaded', loaded);
    return loaded;
  }

  /* ============================================================
   * MOD MENU  (list ⇄ grid toggle)
   * ============================================================ */
  let menuEl = null;
  let menuLayout = localStorage.getItem('tt-modlayout') || 'list';

  function buildMenu() {
    const root = document.createElement('div');
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
    layoutBtn.style.cssText = 'background:#333;color:#fff;border:1px solid #555;padding:8px 14px;border-radius:6px;cursor:pointer;font-size:13px;font-family:inherit;';
    layoutBtn.title = 'Toggle list / grid layout';

    const close = document.createElement('button');
    close.textContent = '✕ Close';
    close.style.cssText = 'background:#444;color:#fff;border:0;padding:8px 16px;border-radius:6px;cursor:pointer;font-family:inherit;';
    close.onclick = () => root.style.display = 'none';

    head.append(h, layoutBtn, close);

    const container = document.createElement('div');
    container.style.cssText = 'overflow-y:auto;flex:1;';

    root.append(head, container);
    document.body.appendChild(root);

    function updateLayoutBtn() {
      layoutBtn.textContent = menuLayout === 'list' ? '☷ List' : '▦ Grid';
    }

    function renderList() {
      container.innerHTML = '';
      container.style.cssText = 'overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:8px;';
      if (!mods.size) {
        container.innerHTML = '<div style="opacity:.6;font-style:italic">No mods found. Create ./mods/manifest.json.</div>';
        return;
      }
      for (const m of mods.values()) {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:14px;background:#1c1f24;border:1px solid #333;border-radius:8px;padding:12px 16px;';

        const thumb = document.createElement('div');
        thumb.style.cssText = 'width:56px;height:56px;flex:0 0 56px;border-radius:6px;overflow:hidden;background:#000;display:flex;align-items:center;justify-content:center;font-size:24px;';
        if (m.iconUrl) {
          const img = document.createElement('img');
          img.src = m.iconUrl;
          img.style.cssText = 'width:100%;height:100%;object-fit:cover;';
          thumb.appendChild(img);
        } else thumb.textContent = '🔧';

        const info = document.createElement('div');
        info.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:2px;min-width:0;';
        const nameEl = document.createElement('div');
        nameEl.style.cssText = 'font-weight:bold;font-size:15px;';
        nameEl.textContent = m.name;
        const metaEl = document.createElement('div');
        metaEl.style.cssText = 'font-size:12px;opacity:.7;';
        metaEl.textContent = `v${m.version} · ${m.author}`;
        const descEl = document.createElement('div');
        descEl.style.cssText = 'font-size:12px;opacity:.85;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
        descEl.textContent = m.description || '';
        info.append(nameEl, metaEl, descEl);

        const status = document.createElement('div');
        status.style.cssText = 'font-size:11px;opacity:.55;flex:0 0 auto;text-align:right;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
        status.textContent = m.status === 'error' ? ('Error: ' + (m.error?.message || '?')) : m.status;

        row.append(thumb, info, status);
        container.appendChild(row);
      }
    }

    function renderGrid() {
      container.innerHTML = '';
      container.style.cssText = 'overflow-y:auto;flex:1;display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:16px;';
      if (!mods.size) {
        container.innerHTML = '<div style="opacity:.6;font-style:italic;grid-column:1/-1;">No mods found. Create ./mods/manifest.json.</div>';
        return;
      }
      for (const m of mods.values()) {
        const card = document.createElement('div');
        card.style.cssText = 'background:#1c1f24;border:1px solid #333;border-radius:8px;overflow:hidden;display:flex;flex-direction:column;';
        if (m.iconUrl) {
          const img = document.createElement('img');
          img.src = m.iconUrl;
          img.style.cssText = 'width:100%;height:130px;object-fit:cover;background:#000;';
          card.appendChild(img);
        }
        const body = document.createElement('div');
        body.style.cssText = 'padding:12px;display:flex;flex-direction:column;gap:6px;flex:1;';
        const nameEl = document.createElement('div');
        nameEl.style.cssText = 'font-weight:bold;font-size:15px;';
        nameEl.textContent = m.name;
        const metaEl = document.createElement('div');
        metaEl.style.cssText = 'font-size:12px;opacity:.7;';
        metaEl.textContent = `v${m.version} · ${m.author}`;
        const descEl = document.createElement('div');
        descEl.style.cssText = 'font-size:12px;opacity:.85;flex:1;';
        descEl.textContent = m.description || '';
        const status = document.createElement('div');
        status.style.cssText = 'font-size:11px;opacity:.55;';
        status.textContent = m.status === 'error' ? ('Error: ' + (m.error?.message || '?')) : m.status;
        body.append(nameEl, metaEl, descEl, status);
        card.appendChild(body);
        container.appendChild(card);
      }
    }

    function refresh() {
      updateLayoutBtn();
      if (menuLayout === 'list') renderList(); else renderGrid();
    }

    layoutBtn.addEventListener('click', () => {
      menuLayout = menuLayout === 'list' ? 'grid' : 'list';
      localStorage.setItem('tt-modlayout', menuLayout);
      refresh();
    });

    return { root, refresh };
  }

  function showMenu() {
    if (!menuEl) menuEl = buildMenu();
    menuEl.refresh();
    menuEl.root.style.display = 'flex';
  }
  function hideMenu() {
    if (menuEl) menuEl.root.style.display = 'none';
  }
  function toggleMenu2() {
    if (menuEl && menuEl.root.style.display === 'flex') hideMenu();
    else showMenu();
  }

  window.addEventListener('keydown', e => {
    if (e.key === 'F10') { e.preventDefault(); toggleMenu2(); }
  });

  /* ============================================================
   * UI CLEANUP + REBRAND
   * ============================================================ */

  /* ---- (A) Hide top-left store/discord icons (canvas) ---- */
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
  API.showStoreIcons = function () {
    const TT = window.__TT__;
    if (!TT || !TT.bb) return false;
    for (let i = 0; i < TT.bb.gM.length; i++) TT.bb.gM[i] = true;
    TT.bb.__ttStoreHidden = false;
    log('Store icons re-enabled');
    return true;
  };

  /* ---- (B) Hide bottom-left clan bar (DOM) ---- */
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
  // Intercept body.appendChild
  const origBodyAppend = document.body.appendChild.bind(document.body);
  document.body.appendChild = function (node) {
    try { if (isClanBarNode(node)) hideClanBarNode(node); } catch {}
    return origBodyAppend(node);
  };
  // Sweep anything already in the DOM
  function sweepClanBar() {
    for (const n of document.body.children) hideClanBarNode(n);
  }

  /* ---- (C) 🔮 Rebrand: territorial.io → modatorial.io ---- */
  let rebranded = false;
  let cachedModatorialCanvas = null;

  function buildModatorialCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    g.clearRect(0, 0, w, h);
    g.imageSmoothingEnabled = false;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const fs = Math.max(8, Math.floor(h * 0.62));
    g.font = 'bold ' + fs + 'px Arial Black, system-ui, sans-serif';
    g.fillStyle = '#dcdcdc';
    // simple 1px dark outline so it pops like the original pixel-art
    g.lineWidth = Math.max(1, Math.floor(fs * 0.06));
    g.strokeStyle = 'rgba(0,0,0,0.75)';
    g.strokeText('MODATORIAL.IO', w / 2, h / 2 + fs * 0.04);
    g.fillText('MODATORIAL.IO', w / 2, h / 2 + fs * 0.04);
    return c;
  }

  function patchAih() {
    const TT = window.__TT__;
    if (!TT || !TT.ac || typeof TT.ac.aIh !== 'function') return false;
    const ac = TT.ac;
    if (ac.__ttRebrandPatched) { rebranded = true; return true; }
    const origAih = ac.aIh.bind(ac);
    ac.aIh = function (name) {
      if (name === 'territorial.io') {
        if (!cachedModatorialCanvas) {
          const orig = origAih(name);
          cachedModatorialCanvas = buildModatorialCanvas(orig.width || 512, orig.height || 64);
        }
        return cachedModatorialCanvas;
      }
      return origAih(name);
    };
    ac.__ttRebrandPatched = true;
    rebranded = true;
    log('🔮 Rebranded: territorial.io → modatorial.io');
    return true;
  }

  API.names = function () {
    if (!patchAih()) {
      warn('names(): internals not ready yet — try again after the game loads');
      return false;
    }
    API.showToast('🔮 modatorial.io activated');
    return true;
  };

  /* ---- Boot the cleanup tasks ---- */
  const iv1 = setInterval(() => { if (killStoreIcons()) clearInterval(iv1); }, 200);
  const iv2 = setInterval(sweepClanBar, 500);

  /* ---- Auto-rebrand: territorial.io → modatorial.io ---- */
  let rebrandToastShown = false;
  const iv3 = setInterval(() => {
    if (patchAih()) {
      clearInterval(iv3);
      if (!rebrandToastShown) {
        rebrandToastShown = true;
        API.showToast('🔮 modatorial.io activated');
      }
    }
  }, 200);

  /* ============================================================
   * 2b — INJECT "MODS" BUTTON INTO THE MAIN MENU
   * ============================================================ */
  const MODS_BTN_ID = 'tt-mods-btn';

  function findMenuButtons() {
    const btns = [...document.querySelectorAll('body > button')];
    const mp = btns.find(b => /^rgba?\(\s*0\s*,\s*70\s*,\s*0\b/.test(b.style.backgroundColor || ''));
    const gm = btns.find(b => /^rgba?\(\s*80\s*,\s*60\s*,\s*60\b/.test(b.style.backgroundColor || ''));
    return { mp, gm };
  }

  function positionModsButton(btn, mpBtn, gmBtn) {
    btn.style.left   = mpBtn.offsetLeft + 'px';
    btn.style.top    = (gmBtn.offsetTop + gmBtn.offsetHeight + 8) + 'px';
    btn.style.width  = ((gmBtn.offsetLeft + gmBtn.offsetWidth) - mpBtn.offsetLeft) + 'px';
    btn.style.height = mpBtn.offsetHeight + 'px';
  }

  const MODS_BG_BASE  = 'linear-gradient(180deg,rgba(0,110,0,0.92) 0%,rgba(0,70,0,0.92) 100%)';
  const MODS_BG_HOVER = 'linear-gradient(180deg,rgba(0,160,0,0.95) 0%,rgba(0,90,0,0.95) 100%)';

  function injectModsButton() {
    const { mp, gm } = findMenuButtons();
    const existing = document.getElementById(MODS_BTN_ID);

    if (!mp || !gm) { if (existing) existing.remove(); return; }
    if (existing)   { positionModsButton(existing, mp, gm); return; }

    const btn = document.createElement('button');
    btn.id = MODS_BTN_ID;
    btn.type = 'button';
    btn.innerHTML = '🔧<br>Mods';
    btn.setAttribute('aria-label', 'Open Mod Menu');

    Object.assign(btn.style, {
      color: '#fff', userSelect:'none', outline:'none', overflowWrap:'break-word',
      background: MODS_BG_BASE, border: '2.2px solid #fff',
      font: mp.style.font || '17.55px system-ui', padding: '0em 0.3em',
      position: 'absolute', cursor: 'pointer', textAlign: 'center',
      lineHeight: '1.2', display:'flex', flexDirection:'column',
      alignItems:'center', justifyContent:'center',
      zIndex: 9999, transition: 'background .15s, transform .08s',
      boxShadow: '0 0 0 1px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.15)'
    });

    btn.addEventListener('mouseenter', () => { btn.style.background = MODS_BG_HOVER; });
    btn.addEventListener('mouseleave', () => { btn.style.background = MODS_BG_BASE; });
    btn.addEventListener('mousedown',  () => { btn.style.transform = 'scale(0.97)'; });
    btn.addEventListener('mouseup',    () => { btn.style.transform = 'scale(1)';   });
    btn.addEventListener('click',      () => showMenu());

    document.body.appendChild(btn);
    positionModsButton(btn, mp, gm);
  }

  const menuObserver = new MutationObserver(() => injectModsButton());
  menuObserver.observe(document.body, { childList: true, subtree: false });
  setInterval(injectModsButton, 500);
  window.addEventListener('resize', injectModsButton);

  /* ============================================================
   * BOOT
   * ============================================================ */
  function boot() {
    log(`Territorial.io Mod Loader v${API.version} (game r${API.gameVersion})`);
    loadAll().then(list => {
      log(`Done. ${list.length} mod(s). Click "Mods" or press F10.`);
      log(`🔮 Hint: type TerritorialMods.names() for a surprise.`);
      emit('ready', list);
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else boot();

})(window);