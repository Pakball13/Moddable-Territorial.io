/* ============================================================
 * Territorial.io Mod Loader  v1.10.2
 * Full client: sidebar, themes, layouts, mod menu, settings,
 * promo integration, store + appearance buttons
 * ============================================================ */
(function (global) {
  'use strict';

  const MODS_DIR  = 'mods/';
  const MANIFEST  = MODS_DIR + 'manifest.json';
  const LOG_PFX   = '%c[ModLoader]';
  const LOG_STYLE = 'color:#7bd;font-weight:bold';
  const DISABLED_KEY   = 'tt-disabled-mods';
  const LAYOUT_KEY     = 'tt-layout';
  const SIDEBAR_KEY    = 'tt-sidebar-collapsed';
  const IMPORTED_KEY   = 'tt-imported-mods';
  const THEME_KEY      = 'tt-theme';
  const MODSET_KEY_PFX = 'tt-modset-';
  const ICON_DIR       = 'assets/icons/';

  const log  = (...a) => console.log  (LOG_PFX, LOG_STYLE, ...a);
  const warn = (...a) => console.warn (LOG_PFX, LOG_STYLE, ...a);
  const err  = (...a) => console.error(LOG_PFX, LOG_STYLE, ...a);

  const ICONS = {
    'Custom Scenario': ICON_DIR + 'swords.svg',
    'My Account':      ICON_DIR + 'key.svg',
    'Game Menu':       ICON_DIR + 'menu.svg',
    'Multiplayer':     ICON_DIR + 'swords.svg',
    'Mods':            ICON_DIR + 'mods.svg',
    'Mod Store':       ICON_DIR + 'store.svg',
    'Store':           ICON_DIR + 'store.svg',
    'Appearance':      ICON_DIR + 'appearance.svg',
    'Name Changer':    ICON_DIR + 'name.svg',
    'Name':            ICON_DIR + 'name.svg'
  };

  const THEMES = ['modatorial', 'midnight', 'cyberpunk', 'forest', 'mono', 'sunset'];
  function applyTheme(name) {
    if (!THEMES.includes(name)) name = 'midnight';
    document.documentElement.setAttribute('data-tt-theme', name);
    localStorage.setItem(THEME_KEY, name);
  }

  function isVisible(el) {
    if (!el) return false;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || s.opacity === '0') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function downloadText(text, filename) {
    const blob = new Blob([text], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function blobToDataURL(blob) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(r.result);
      r.onerror = rej;
      r.readAsDataURL(blob);
    });
  }

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

  const _stacks = new Map();
  function getTopRightStack(slot) {
    const key = slot || 'default';
    const existing = _stacks.get(key);
    if (existing && document.body.contains(existing)) return existing;
    const el = document.createElement('div');
    el.id = 'tt-topright-stack' + (slot ? '-' + slot : '');
    el.dataset.ttOur = '1';
    Object.assign(el.style, {
      position: 'fixed', top: '12px', right: '12px',
      display: 'flex', flexDirection: 'column', gap: '8px',
      alignItems: 'flex-end', zIndex: 99998, pointerEvents: 'none'
    });
    document.body.appendChild(el);
    _stacks.set(key, el);
    return el;
  }

  let transitionEl = null;
  function getTransitionEl() {
    if (transitionEl && document.body.contains(transitionEl)) return transitionEl;
    transitionEl = document.createElement('div');
    transitionEl.id = 'tt-transition';
    transitionEl.dataset.ttOur = '1';
    document.body.appendChild(transitionEl);
    return transitionEl;
  }
  function fadeTransition(ms = 220) {
    const t = getTransitionEl();
    t.style.opacity = '1';
    setTimeout(() => { t.style.opacity = '0'; }, ms);
  }

  const mods = new Map();

  let disabledMods;
  try {
    const raw = localStorage.getItem(DISABLED_KEY);
    disabledMods = new Set(raw ? JSON.parse(raw) : []);
    log(`Disabled set at boot: [${[...disabledMods].join(', ') || 'empty'}]`);
  } catch { disabledMods = new Set(); }

  function persistDisabled() {
    localStorage.setItem(DISABLED_KEY, JSON.stringify([...disabledMods]));
  }

  let importedBundles = [];
  try {
    const raw = localStorage.getItem(IMPORTED_KEY);
    importedBundles = raw ? JSON.parse(raw) : [];
    if (importedBundles.length) log(`Imported bundles in storage: ${importedBundles.length}`);
  } catch { importedBundles = []; }

  function persistImported() {
    try { localStorage.setItem(IMPORTED_KEY, JSON.stringify(importedBundles)); }
    catch (e) { warn('Could not persist imported bundles:', e); }
  }

  const CLIENT = {
    layout:           localStorage.getItem(LAYOUT_KEY) || 'sidebar',
    sidebarCollapsed: localStorage.getItem(SIDEBAR_KEY) === '1',
    chrome:           localStorage.getItem('tt-chrome') !== '0',
    hideMenuButtons:  localStorage.getItem('tt-hidemenu') !== '0',
    hideLogo:         localStorage.getItem('tt-hidelogo') !== '0',
    hideVersion:      localStorage.getItem('tt-hideversion') !== '0',
    hideMultiplayer:  localStorage.getItem('tt-hidemulti') !== '0'
  };

  function loadSettingsFromStorage(modId, schema) {
    const out = {};
    if (!Array.isArray(schema)) return out;
    schema.forEach(s => {
      const key = MODSET_KEY_PFX + modId + '-' + s.id;
      try {
        const raw = localStorage.getItem(key);
        if (raw !== null) out[s.id] = JSON.parse(raw);
        else out[s.id] = s.default;
      } catch { out[s.id] = s.default; }
    });
    return out;
  }
  function saveSettingValue(modId, settingId, value) {
    const key = MODSET_KEY_PFX + modId + '-' + settingId;
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }

  let settingsModal = null;
  function openSettingsFor(modId) {
    const meta = mods.get(modId);
    if (!meta || !Array.isArray(meta.settings_schema) || !meta.settings_schema.length) {
      API.showToast('This mod has no settings');
      return;
    }
    if (settingsModal) settingsModal.remove();

    const overlay = document.createElement('div');
    overlay.id = 'tt-settings-modal';
    overlay.dataset.ttOur = '1';
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.88)',
      zIndex: 100004, display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '40px 20px', boxSizing: 'border-box'
    });

    const panel = document.createElement('div');
    Object.assign(panel.style, {
      background: '#161b22', border: '1px solid #30363d',
      borderRadius: '12px', padding: '24px 26px',
      maxWidth: '520px', width: '100%',
      maxHeight: '80vh', overflowY: 'auto', color: '#fff'
    });

    const head = document.createElement('div');
    head.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;';
    head.innerHTML = `<div style="font-size:18px;font-weight:700;">⚙️ ${meta.name}</div>`;
    const close = document.createElement('button');
    close.textContent = '✕';
    close.style.cssText = 'background:none;border:0;color:inherit;font-size:18px;cursor:pointer;padding:4px 10px;';
    close.addEventListener('click', () => { overlay.remove(); settingsModal = null; });
    head.appendChild(close);
    panel.appendChild(head);

    meta.settings_schema.forEach(s => {
      const row = document.createElement('div');
      row.style.cssText = 'padding:12px 10px;border-radius:8px;margin-bottom:6px;display:flex;flex-direction:column;gap:6px;';

      const label = document.createElement('div');
      label.textContent = s.label || s.id;
      label.style.cssText = 'font-size:13px;font-weight:600;';
      row.appendChild(label);

      if (s.description) {
        const desc = document.createElement('div');
        desc.textContent = s.description;
        desc.style.cssText = 'font-size:11px;opacity:.6;';
        row.appendChild(desc);
      }

      let input;
      const onChange = v => {
        meta.settings[s.id] = v;
        saveSettingValue(modId, s.id, v);
        emit('modSettingsChanged', modId, s.id, v, meta);
      };

      if (s.type === 'slider') {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'display:flex;gap:10px;align-items:center;';
        input = document.createElement('input');
        input.type = 'range';
        input.min = s.min ?? 0; input.max = s.max ?? 100;
        input.step = s.step ?? 1;
        input.value = meta.settings[s.id] ?? s.default ?? 0;
        input.style.cssText = 'flex:1;';
        const val = document.createElement('div');
        val.textContent = input.value;
        val.style.cssText = 'font-weight:700;min-width:50px;text-align:right;';
        input.addEventListener('input', () => { val.textContent = input.value; onChange(+input.value); });
        wrap.appendChild(input); wrap.appendChild(val);
        row.appendChild(wrap);
      } else if (s.type === 'toggle') {
        input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = !!meta.settings[s.id];
        input.style.cssText = 'width:20px;height:20px;';
        input.addEventListener('change', () => onChange(input.checked));
        row.appendChild(input);
      } else if (s.type === 'text') {
        input = document.createElement('input');
        input.type = 'text';
        input.value = meta.settings[s.id] ?? s.default ?? '';
        input.placeholder = s.placeholder || '';
        input.style.cssText = 'padding:8px 10px;background:#0d1117;color:inherit;border:1px solid #30363d;border-radius:6px;font-family:inherit;font-size:13px;';
        input.addEventListener('input', () => onChange(input.value));
        row.appendChild(input);
      } else if (s.type === 'color') {
        input = document.createElement('input');
        input.type = 'color';
        input.value = meta.settings[s.id] ?? s.default ?? '#ffffff';
        input.style.cssText = 'width:60px;height:36px;border:1px solid #30363d;border-radius:6px;background:transparent;cursor:pointer;';
        input.addEventListener('input', () => onChange(input.value));
        row.appendChild(input);
      } else if (s.type === 'select') {
        input = document.createElement('select');
        input.style.cssText = 'padding:8px 10px;background:#0d1117;color:inherit;border:1px solid #30363d;border-radius:6px;font-family:inherit;font-size:13px;';
        (s.options || []).forEach(opt => {
          const o = document.createElement('option');
          o.value = typeof opt === 'object' ? opt.value : opt;
          o.textContent = typeof opt === 'object' ? opt.label : opt;
          input.appendChild(o);
        });
        input.value = meta.settings[s.id] ?? s.default;
        input.addEventListener('change', () => onChange(input.value));
        row.appendChild(input);
      } else if (s.type === 'button') {
        input = document.createElement('button');
        input.textContent = s.buttonLabel || s.label || 'Run';
        input.style.cssText = 'padding:8px 16px;background:#21262d;color:inherit;border:1px solid #30363d;border-radius:6px;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600;';
        input.addEventListener('click', () => { emit('modSettingsAction', modId, s.id, meta); });
        row.appendChild(input);
      }
      panel.appendChild(row);
    });

    overlay.appendChild(panel);
    overlay.addEventListener('click', e => {
      if (e.target === overlay) { overlay.remove(); settingsModal = null; }
    });
    document.body.appendChild(overlay);
    settingsModal = overlay;
  }

  const API = {
    version: '1.10.2',
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
    isVisible,

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
      b.dataset.ttOur = '1';
      Object.assign(b.style, {
        position:'relative', top:'auto', right:'auto',
        padding:'6px 12px', background:'#222', color:'#fff',
        border:'1px solid #555', borderRadius:'6px', cursor:'pointer',
        fontFamily:'system-ui', fontSize:'12px', pointerEvents:'auto',
        ...style
      });
      b.addEventListener('click', onClick);
      API.addToTopRight(b);
      return b;
    },

    addToTopRight(el, slot) {
      const stack = getTopRightStack(slot);
      if (el.style.position === 'fixed' &&
          (el.style.top !== '10px' || el.style.right !== '10px')) {
        el.style.position = 'relative';
        el.style.top = 'auto'; el.style.right = 'auto';
        el.style.left = 'auto'; el.style.bottom = 'auto';
      }
      el.style.pointerEvents = el.style.pointerEvents || 'auto';
      stack.appendChild(el);
      return el;
    },

    getTopRightStack,

    readModFile(mod, relPath, as = 'text') {
      if (mod._bundle && mod._bundle.assets) {
        const data = mod._bundle.assets[relPath];
        if (typeof data === 'undefined') {
          return Promise.reject(new Error(`Not in bundle: ${relPath}`));
        }
        if (as === 'image') return new Promise((res, rej) => {
          const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = data;
        });
        if (as === 'json')  return Promise.resolve(JSON.parse(data));
        if (as === 'blob')  return fetch(data).then(r => r.blob());
        return Promise.resolve(data);
      }
      const url = mod.basePath + relPath;
      return fetch(url, { cache: 'no-store' }).then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status} – ${url}`);
        if (as === 'json')  return r.json();
        if (as === 'blob')  return r.blob();
        if (as === 'image') return new Promise((res, rej) => {
          const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url;
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
      persistDisabled(); if (menuEl) menuEl.render();
      API.showToast('🔧 All mods disabled — click Reload');
    },
    enableAllMods() {
      disabledMods.clear(); persistDisabled();
      if (menuEl) menuEl.render();
      API.showToast('🔧 All mods enabled — click Reload');
    },
    resetModState() { localStorage.removeItem(DISABLED_KEY); location.reload(); },
    reloadPage() { location.reload(); },

    setSidebarCollapsed(on) {
      CLIENT.sidebarCollapsed = !!on;
      localStorage.setItem(SIDEBAR_KEY, on ? '1' : '0');
      applyLayout();
      emit('sidebarToggled', on);
      return CLIENT.sidebarCollapsed;
    },
    toggleSidebar() { return this.setSidebarCollapsed(!CLIENT.sidebarCollapsed); },
    getSidebarCollapsed() { return CLIENT.sidebarCollapsed; },

    setTheme(name) {
      applyTheme(name);
      if (chromeEl) updateChrome();
      API.showToast(`🎨 Theme: ${name}`);
      return name;
    },
    getTheme() { return localStorage.getItem(THEME_KEY) || 'modatorial'; },
    getThemes() { return THEMES.slice(); },

    openSettings(id) { openSettingsFor(id); },
    getSetting(modId, settingId) {
      const m = mods.get(modId); return m && m.settings ? m.settings[settingId] : undefined;
    },
    setSetting(modId, settingId, value) {
      const m = mods.get(modId); if (!m || !m.settings) return false;
      m.settings[settingId] = value;
      saveSettingValue(modId, settingId, value);
      emit('modSettingsChanged', modId, settingId, value, m);
      return true;
    },

    listImportedBundles() {
      return importedBundles.map(b => ({
        id: b.id, name: b.name, version: b.version, author: b.author
      }));
    },
    async importTtmodFile(file, silent) {
      const text = typeof file.text === 'function' ? await file.text() : String(file);
      if (typeof text === 'string' && /<ttmod[\s>]/i.test(text)) {
        if (!global.TtmodTranslator) throw new Error('TtmodTranslator not loaded');
        const t = global.TtmodTranslator.translate(text);
        return this.importTtmodBundle({
          format: 'ttmod', formatVersion: t.meta.formatVersion || 3,
          id: t.meta.id, name: t.meta.name || t.meta.id,
          version: t.meta.version || '1.0.0',
          author: t.meta.author || 'Unknown',
          description: t.meta.description || '',
          icon: t.meta.icon || null,
          main: t.mainCode, assets: t.assets || {},
          _translated: t, _isV3: true
        }, silent);
      }
      let bundle;
      try { bundle = JSON.parse(text); }
      catch { throw new Error('Not valid .ttmod'); }
      return this.importTtmodBundle(bundle, silent);
    },
    async importTtmodBundle(bundle, silent) {
      if (!bundle || bundle.format !== 'ttmod') throw new Error('Missing "format": "ttmod"');
      if (!bundle.id || typeof bundle.id !== 'string') throw new Error('Bundle missing id');
      if (typeof bundle.main !== 'string') throw new Error('Bundle missing main code');
      if (JSON.stringify(bundle).length > 4 * 1024 * 1024) throw new Error('Bundle too large');
      const existing = importedBundles.findIndex(b => b.id === bundle.id);
      if (existing >= 0) importedBundles.splice(existing, 1);
      importedBundles.push(bundle);
      persistImported();
      await registerImportedMod(bundle);
      if (menuEl) menuEl.render();
      if (!silent) API.showToast(`📦 Imported: ${bundle.name || bundle.id}`);
      return true;
    },
    exportTtmodBundle(id) {
      const bundle = importedBundles.find(b => b.id === id);
      if (!bundle) throw new Error('No imported bundle with id: ' + id);
      downloadText(JSON.stringify(bundle, null, 2), (bundle.id || 'mod') + '.ttmod');
      return true;
    },
    async exportModAsTtmod(id) {
      const meta = mods.get(id);
      if (!meta) throw new Error('No mod with id: ' + id);
      if (meta._bundle) {
        const t = meta._bundle._translated;
        if (t && t.meta && t.userScript !== undefined) {
          const header = `<ttmod>\n${JSON.stringify(t.meta, null, 2)}\n</ttmod>\n<script>\n${t.userScript || ''}\n</script>\n`;
          downloadText(header, id + '.ttmod');
          return true;
        }
        downloadText(JSON.stringify(meta._bundle, null, 2), id + '.ttmod');
        return true;
      }
      const basePath = meta.basePath;
      if (!basePath) throw new Error('Mod has no basePath');
      let modJson = {};
      try {
        const r = await fetch(basePath + 'mod.json', { cache: 'no-store' });
        if (r.ok) modJson = await r.json();
      } catch {}
      const mainFile = modJson.main || meta.main || 'main.js';
      let mainSource = '';
      try {
        const r = await fetch(basePath + mainFile, { cache: 'no-store' });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        mainSource = await r.text();
      } catch (e) { throw new Error('Could not fetch ' + mainFile + ': ' + e.message); }
      const assets = {};
      const tryFetch = async (rel) => {
        if (!rel) return false;
        try {
          const r = await fetch(basePath + rel, { cache: 'no-store' });
          if (!r.ok) return false;
          const blob = await r.blob();
          if (blob.size > 2 * 1024 * 1024) return false;
          assets[rel] = await blobToDataURL(blob);
          return true;
        } catch { return false; }
      };
      if (modJson.icon) await tryFetch(modJson.icon);
      for (const g of [
        'assets/panorama.png','assets/panorama.jpg','assets/icon.png',
        'assets/sound.mp3','assets/music.mp3'
      ]) { if (!assets[g]) await tryFetch(g); }
      const bundleMeta = {
        id: modJson.id || id, name: modJson.name || meta.name,
        version: modJson.version || meta.version,
        author: modJson.author || meta.author,
        description: modJson.description || meta.description,
        gameVersion: modJson.gameVersion || 25,
        icon: modJson.icon || null, config: modJson.config || {}
      };
      if (Object.keys(assets).length) bundleMeta.assets = assets;
      const fileText = `<ttmod>\n${JSON.stringify(bundleMeta, null, 2)}\n</ttmod>\n<script>\n${mainSource}\n</script>\n`;
      downloadText(fileText, id + '.ttmod');
      API.showToast(`📦 Exported ${id}.ttmod`);
      return true;
    },

    setLayout(mode) {
      if (!['sidebar', 'grid', 'circles'].includes(mode)) return false;
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
    setHideLogo(on) { CLIENT.hideLogo = !!on; localStorage.setItem('tt-hidelogo', on ? '1' : '0'); return CLIENT.hideLogo; },
    setHideVersion(on) { CLIENT.hideVersion = !!on; localStorage.setItem('tt-hideversion', on ? '1' : '0'); return CLIENT.hideVersion; },
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

  const SUPPRESS_GAME_ERROR_DIALOG = true;
  if (SUPPRESS_GAME_ERROR_DIALOG) {
    window.addEventListener('error', e => {
      err('Uncaught:', e.message, (e.filename || '') + ':' + e.lineno);
      e.stopImmediatePropagation();
      e.preventDefault();
    }, true);
  }

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
      addEventListener(t, fn) { (L[t] || (L[t] = [])).push(fn); },
      removeEventListener(t, fn) {
        const l = L[t]; if (!l) return;
        const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1);
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

  const origRAF = global.requestAnimationFrame.bind(global);
  global.requestAnimationFrame = cb => origRAF(t => {
    runHooks('preUpdate', t);
    let out; try { out = cb(t); }
    catch (e) { runHooks('postUpdate', t); throw e; }
    runHooks('postUpdate', t);
    return out;
  });

  const inputMap = {
    keydown:'keyDown', keyup:'keyUp',
    mousedown:'mouseDown', mouseup:'mouseUp', mousemove:'mouseMove'
  };
  for (const evt in inputMap) {
    window.addEventListener(evt, e => {
      emit(evt, e); runHooks(inputMap[evt], e);
    }, false);
  }

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
    return (s || '').replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{2190}-\u{21FF}\u{2B00}-\u{2BFF}]/gu, '').trim();
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
        const c = document.createElement('canvas'); c.width = 1; c.height = 1; return c;
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
    ab.aIe = function () { if (CLIENT.hideLogo) return; return orig(); };
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

  const MAIN_KEYS = ['Multiplayer', 'Custom Scenario', 'My Account', 'Game Menu'];
  const MODS_BTN_ID = 'tt-mods-btn';

  function isOurMenuButton(btn) {
    if (!btn || btn.tagName !== 'BUTTON') return false;
    if (btn.parentElement !== document.body) return false;
    if (btn.dataset.ttMenuBtn === '1') return true;
    if (btn.dataset.ttIconApplied === '1') return true;
    if (btn.id === MODS_BTN_ID) return true;
    return false;
  }
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

  function applyIcons() {
    const candidates = [...document.querySelectorAll('body > button')];
    candidates.forEach(btn => {
      const isOurs = isOurButton(btn);
      const ourId = btn.id;
      const ourWhitelist = ['tt-mods-btn', 'tt-store-btn', 'tt-appearance-btn'];
      if (isOurs && !ourWhitelist.includes(ourId)) return;
      if (btn.dataset.ttIconApplied === '1' && btn.querySelector('.tt-btn-icon')) return;
      let label = btn.dataset.ttLabel;
      if (!label) {
        const raw = stripEmoji(btn.textContent);
        const parts = raw.split(/\s{2,}|\n/).map(s => s.trim()).filter(Boolean);
        label = parts[parts.length - 1] || raw;
        if (!label) return;
        btn.dataset.ttLabel = label;
      }
      let iconPath = null;
      for (const [key, path] of Object.entries(ICONS)) {
        if (label.toLowerCase().includes(key.toLowerCase())) { iconPath = path; break; }
      }
      /* Fallback mapping for our injected buttons when the label
         match above doesn't find them */
      if (!iconPath) {
        if (btn.id === 'tt-mods-btn')       iconPath = ICONS['Mods'];
        else if (btn.id === 'tt-store-btn') iconPath = ICONS['Mod Store'];
        else if (btn.id === 'tt-appearance-btn') iconPath = ICONS['Appearance'];
      }
      if (!iconPath) return;
      btn.dataset.ttMenuBtn = '1';
      btn.dataset.ttIconApplied = '1';
      btn.innerHTML = '';
      const icon = document.createElement('img');
      icon.className = 'tt-btn-icon';
      icon.src = iconPath; icon.alt = ''; icon.setAttribute('aria-hidden', 'true');
      icon.style.cssText =
        'width:24px;height:24px;min-width:24px;max-width:24px;' +
        'flex:0 0 24px;display:block;object-fit:contain;' +
        'filter:brightness(0) invert(1);opacity:0.92;pointer-events:none;';
      const span = document.createElement('span');
      span.className = 'tt-btn-label';
      span.textContent = label;
      span.style.cssText = 'flex:1;pointer-events:none;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
      btn.append(icon, span);
    });
  }

  function applyLayout() {
    const mainBtns = getMainMenuButtons();
    if (mainBtns.length < 1) return;

    const sorted = mainBtns.slice().sort((a, b) => {
      const at = parseFloat(a.style.top) || 0;
      const bt = parseFloat(b.style.top) || 0;
      if (Math.abs(at - bt) > 20) return at - bt;
      return (parseFloat(a.style.left) || 0) - (parseFloat(b.style.left) || 0);
    });

    const modsBtn  = document.getElementById('tt-mods-btn');
    const storeBtn = document.getElementById('tt-store-btn');
    const appearBtn = document.getElementById('tt-appearance-btn');
    const filtered = sorted.filter(b =>
      b.id !== 'tt-mods-btn' && b.id !== 'tt-store-btn' && b.id !== 'tt-appearance-btn');
    const extras = [modsBtn, storeBtn, appearBtn].filter(Boolean);
    const all = [...filtered, ...extras];

    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const inputEl  = getPlayerInput();
    const colorBtn = getColorButton();
    const hasTopRow = isVisible(inputEl) || isVisible(colorBtn);

    if (CLIENT.layout === 'sidebar') {
      const collapsed = CLIENT.sidebarCollapsed;
      const panelW  = collapsed ? 60 : 320;
      const leftPad = 32;

      const rows   = all.length + (hasTopRow && !collapsed ? 1 : 0);
      const gap    = 10;

      // ---- Dynamic row height: fit within the viewport ----
      const topMargin    = 50;   // space for the chrome bar
      const bottomMargin = 40;   // space for the bottom status bar
      const available    = vh - topMargin - bottomMargin;
      const idealRowH    = 60;
      const neededH      = rows * idealRowH + (rows - 1) * gap;
      let rowH = idealRowH;
      if (neededH > available) {
        // Shrink rows to fit
        rowH = Math.max(36, Math.floor((available - (rows - 1) * gap) / rows));
      }

      const totalH = rows * rowH + (rows - 1) * gap;
      const startX = leftPad;
      const startY = Math.max(topMargin, Math.floor((vh - totalH) / 2));
      let y = startY;

      if (hasTopRow && !collapsed) {
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
        b.style.setProperty('font-size', Math.max(11, Math.floor(rowH * 0.25)) + 'px', 'important');
        const label = b.querySelector('.tt-btn-label');
        if (collapsed) {
          b.style.setProperty('justify-content', 'center', 'important');
          b.style.setProperty('padding', '0', 'important');
          b.style.setProperty('gap', '0', 'important');
          if (label) label.style.display = 'none';
        } else {
          b.style.setProperty('justify-content', 'flex-start', 'important');
          b.style.setProperty('padding', '0 18px', 'important');
          b.style.setProperty('gap', '14px', 'important');
          if (label) label.style.removeProperty('display');
        }
        b.style.setProperty('flex-direction', 'row', 'important');
        y += rowH + gap;
      });
      return;
    }

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
        b.style.setProperty('justify-content', 'flex-start', 'important');
        b.style.setProperty('gap', '14px', 'important');
        const label = b.querySelector('.tt-btn-label');
        if (label) label.style.removeProperty('display');
      });
      return;
    }

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
        const label = b.querySelector('.tt-btn-label');
        if (label) label.style.removeProperty('display');
      });
    }
  }

  let chromeEl = null;
  function buildChrome() {
    const el = document.createElement('div');
    el.id = 'tt-chrome';
    el.dataset.ttOur = '1';
    Object.assign(el.style, {
      position:'fixed', top:'0', left:'0', right:'0', height:'34px',
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

    let sidebarBtn = null;
    if (CLIENT.layout === 'sidebar') {
      sidebarBtn = mkBtn(
        CLIENT.sidebarCollapsed ? '▶' : '◀',
        'Collapse / expand sidebar',
        () => {
          API.toggleSidebar();
          sidebarBtn.textContent = CLIENT.sidebarCollapsed ? '▶' : '◀';
        }
      );
    }

    const layoutBtn = mkBtn(
      '☷ ' + CLIENT.layout.charAt(0).toUpperCase() + CLIENT.layout.slice(1),
      'Cycle layout',
      () => {
        const order = ['sidebar', 'grid', 'circles'];
        const next = order[(order.indexOf(CLIENT.layout) + 1) % order.length];
        API.setLayout(next);
        layoutBtn.textContent = '☷ ' + next.charAt(0).toUpperCase() + next.slice(1);
        updateChrome();
      }
    );

    const themeBtn = mkBtn(
      '🎨 ' + (API.getTheme()[0].toUpperCase() + API.getTheme().slice(1)),
      'Change theme',
      () => {
        const themes = API.getThemes();
        const cur = API.getTheme();
        const next = themes[(themes.indexOf(cur) + 1) % themes.length];
        API.setTheme(next);
        themeBtn.textContent = '🎨 ' + next[0].toUpperCase() + next.slice(1);
      }
    );

    const storeBtn = mkBtn('📦 Store', 'Open the mod store (F8)', () => {
      if (window.ModStore && typeof window.ModStore.open === 'function') {
        window.ModStore.open();
      } else {
        API.showToast('⚠️ mod-store.js not loaded');
      }
    });

    const modsBtn = mkBtn('🔧 Mods', 'Open mod menu (F10)', () => showMenu());

    const muteBtn = mkBtn(
      (window.TerritorialSounds && window.TerritorialSounds.isMuted()) ? '🔇' : '🔊',
      'Mute / unmute audio',
      () => {
        if (window.TerritorialSounds) {
          const m = window.TerritorialSounds.toggleMute();
          muteBtn.textContent = m ? '🔇' : '🔊';
        } else {
          API.showToast('sounds.js not loaded');
        }
      }
    );

    const hideBtn = mkBtn('✕', 'Hide chrome', () => API.setChrome(false));

    el.append(brand, spacer);
    if (sidebarBtn) el.appendChild(sidebarBtn);
    el.append(layoutBtn, themeBtn, storeBtn, modsBtn, muteBtn, hideBtn);
    return el;
  }
  function updateChrome() {
    if (chromeEl) { chromeEl.remove(); chromeEl = null; }
    if (CLIENT.chrome) {
      chromeEl = buildChrome();
      document.body.appendChild(chromeEl);
    }
  }

  let menuEl = null;
  let menuLayout = localStorage.getItem('tt-modlayout') || 'list';
  let bundleInput = null;

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

  function ensureBundleInput() {
    if (bundleInput) return bundleInput;
    bundleInput = document.createElement('input');
    bundleInput.type = 'file';
    bundleInput.accept = '.ttmod,application/json,text/plain';
    bundleInput.style.display = 'none';
    bundleInput.dataset.ttOur = '1';
    bundleInput.addEventListener('change', async e => {
      const f = e.target.files && e.target.files[0];
      bundleInput.value = '';
      if (!f) return;
      try { await API.importTtmodFile(f); }
      catch (importErr) {
        err('Import failed:', importErr);
        API.showToast('❌ Import failed: ' + importErr.message, 4000);
      }
    });
    document.body.appendChild(bundleInput);
    return bundleInput;
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
      b.addEventListener('click', fn);
      return b;
    };

    const storeBtnMenu = mkHead('📦 Store', 'Browse community mods', () => {
      if (window.ModStore && typeof window.ModStore.open === 'function') {
        window.ModStore.open();
      } else {
        API.showToast('⚠️ mod-store.js not loaded');
      }
    });
    const makerBtn = mkHead('🛠 Maker', 'Open the TTmod Maker / Editor', () => {
      if (window.TtmodMaker && typeof window.TtmodMaker.open === 'function') {
        window.TtmodMaker.open();
      } else {
        API.showToast('ttmod-maker.js not loaded');
      }
    });
    const importBtn = mkHead('📦 Import .ttmod', 'Load a .ttmod bundle', () => {
      ensureBundleInput().click();
    });
    const toggleAllBtn = mkHead('⏻ Toggle All', 'Enable/disable all mods', () => {
      if (anyDisabled()) API.enableAllMods(); else API.disableAllMods();
    });
    const reloadBtn = mkHead('🔄 Reload', 'Apply changes and reload the page', () => location.reload());
    const resetBtn  = mkHead('⟲ Reset', 'Clear the disabled-mods state', () => API.resetModState(), true);
    const layoutBtn = mkHead('☷', 'Toggle list / grid view', () => {
      menuLayout = menuLayout === 'list' ? 'grid' : 'list';
      localStorage.setItem('tt-modlayout', menuLayout);
      render();
    });
    const close = mkHead('✕ Close', 'Close the mod menu', () => { root.style.display = 'none'; });

    head.append(h, storeBtnMenu, makerBtn, importBtn, toggleAllBtn, reloadBtn, resetBtn, layoutBtn, close);

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
          const isBundle = !!m._bundle;
          const hasSettings = Array.isArray(m.settings_schema) && m.settings_schema.length > 0;
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
          } else thumb.textContent = isBundle ? '📦' : '🔧';

          const info = document.createElement('div');
          info.style.cssText = 'flex:1;display:flex;flex-direction:column;gap:2px;min-width:0;';
          info.innerHTML =
            `<div style="font-weight:bold;font-size:15px">${m.name}` +
            (isBundle ? ' <span style="font-size:10px;background:#2b6a2b;color:#cff;padding:2px 6px;border-radius:8px;margin-left:6px">.ttmod</span>' : '') +
            `</div>` +
            `<div style="font-size:12px;opacity:.7">v${m.version} · ${m.author}</div>` +
            `<div style="font-size:12px;opacity:.85;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${m.description || ''}</div>`;

          const status = document.createElement('div');
          status.style.cssText = 'font-size:11px;opacity:.55;text-align:right;min-width:80px;';
          status.textContent = isOff ? 'disabled' :
            (m.status === 'error' ? ('Error: ' + (m.error?.message || '?')) : m.status);

          const actions = document.createElement('div');
          actions.style.cssText = 'display:flex;gap:6px;align-items:center;';

          if (hasSettings) {
            const setBtn = document.createElement('button');
            setBtn.dataset.ttOur = '1';
            setBtn.textContent = '⚙️';
            setBtn.title = 'Mod settings';
            setBtn.style.cssText = 'background:#333;color:#fff;border:1px solid #555;padding:6px 8px;border-radius:6px;cursor:pointer;font-size:13px;';
            setBtn.addEventListener('click', () => API.openSettings(m.id));
            actions.appendChild(setBtn);
          }

          const exp = document.createElement('button');
          exp.dataset.ttOur = '1';
          exp.textContent = '⤓';
          exp.title = 'Export .ttmod';
          exp.style.cssText = 'background:#333;color:#fff;border:1px solid #555;padding:6px 8px;border-radius:6px;cursor:pointer;font-size:13px;';
          exp.addEventListener('click', async () => {
            try { await API.exportModAsTtmod(m.id); }
            catch (e) { API.showToast('Export failed: ' + e.message); }
          });
          actions.appendChild(exp);
          actions.appendChild(makeToggle(isOff, () => API.toggleMod(m.id)));
          row.append(thumb, info, status, actions);
          container.appendChild(row);
        }
      } else {
        container.style.cssText = 'overflow-y:auto;flex:1;display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:16px;';
        for (const m of mods.values()) {
          const isOff = disabledMods.has(m.id);
          const isBundle = !!m._bundle;
          const hasSettings = Array.isArray(m.settings_schema) && m.settings_schema.length > 0;
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
            `<div style="font-weight:bold;font-size:15px">${m.name}` +
            (isBundle ? ' <span style="font-size:10px;background:#2b6a2b;color:#cff;padding:2px 6px;border-radius:8px;margin-left:6px">.ttmod</span>' : '') +
            `</div>` +
            `<div style="font-size:12px;opacity:.7">v${m.version} · ${m.author}</div>` +
            `<div style="font-size:12px;opacity:.85;flex:1">${m.description || ''}</div>` +
            `<div style="font-size:11px;opacity:.55">${isOff ? 'disabled' : (m.status === 'error' ? 'Error: ' + (m.error?.message || '?') : m.status)}</div>`;
          const tw = document.createElement('div');
          tw.style.cssText = 'padding:0 12px 12px 12px;display:flex;justify-content:flex-end;gap:6px;';

          if (hasSettings) {
            const setBtn = document.createElement('button');
            setBtn.dataset.ttOur = '1';
            setBtn.textContent = '⚙️';
            setBtn.style.cssText = 'background:#333;color:#fff;border:1px solid #555;padding:6px 10px;border-radius:6px;cursor:pointer;font-size:12px;';
            setBtn.addEventListener('click', () => API.openSettings(m.id));
            tw.appendChild(setBtn);
          }

          const exp = document.createElement('button');
          exp.dataset.ttOur = '1';
          exp.textContent = '⤓ Export';
          exp.style.cssText = 'background:#333;color:#fff;border:1px solid #555;padding:6px 10px;border-radius:6px;cursor:pointer;font-size:12px;';
          exp.addEventListener('click', async () => {
            try { await API.exportModAsTtmod(m.id); }
            catch (e) { API.showToast('Export failed: ' + e.message); }
          });
          tw.appendChild(exp);
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
    if (e.key === 'F8') {
      e.preventDefault();
      if (window.ModStore && typeof window.ModStore.open === 'function') {
        window.ModStore.open();
      }
    }
  });

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

  async function loadManifest() {
    try {
      const res = await fetch(MANIFEST, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const d = await res.json();
      return Array.isArray(d.mods) ? d.mods : [];
    } catch (e) { warn(`No ${MANIFEST} (${e.message})`); return []; }
  }

  async function loadMod(id) {
    const basePath = MODS_DIR + id + '/';
    const meta = {
      id, basePath, name: id, version: '0.0.0', author: 'Unknown',
      description: '', icon: null, main: 'main.js',
      enabled: !disabledMods.has(id),
      status: 'loading', iconUrl: null, exports: {},
      settings: {}, settings_schema: []
    };
    try {
      const mRes = await fetch(basePath + 'mod.json', { cache: 'no-store' });
      if (mRes.ok) Object.assign(meta, await mRes.json());
      meta.id = id; meta.basePath = basePath;

      if (meta.icon) {
        try {
          const h = await fetch(basePath + meta.icon, { method: 'HEAD', cache: 'no-store' });
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

      meta.settings_schema = Array.isArray(meta.settings) ? meta.settings : [];
      meta.settings = loadSettingsFromStorage(id, meta.settings_schema);

      if (meta.main !== false) {
        const sRes = await fetch(basePath + meta.main, { cache: 'no-store' });
        if (!sRes.ok) throw new Error(`main script HTTP ${sRes.status}`);
        const code = await sRes.text();
        const factory = new Function('api', 'mod',
          `"use strict";\n${code}\n//# sourceURL=${basePath}${meta.main}`);
        meta.exports = factory(API, meta) || {};
      }
      meta.status = 'loaded';
      log(`✅ Loaded: ${meta.name} (${id}) v${meta.version}` +
        (meta.settings_schema.length ? ` · ${meta.settings_schema.length} settings` : ''));
    } catch (e) {
      meta.status = 'error'; meta.error = e;
      err(`Failed to load ${id}:`, e);
    }
    mods.set(id, meta);
    emit('modLoaded', meta);
    return meta;
  }

  async function registerImportedMod(bundle) {
    // Skip if this mod is already registered
    if (mods.has(bundle.id)) {
      log(`⏸ Already loaded, skipping: ${bundle.id}`);
      return mods.get(bundle.id);
    }
    const meta = {
      id: bundle.id, basePath: null,
      name: bundle.name || bundle.id,
      version: bundle.version || '1.0.0',
      author: bundle.author || 'Unknown',
      description: bundle.description || '',
      icon: bundle.icon || null, main: '(embedded)',
      enabled: !disabledMods.has(bundle.id),
      status: 'loading',
      iconUrl: bundle.assets && bundle.icon ? bundle.assets[bundle.icon] || null : null,
      exports: {}, _bundle: bundle,
      settings: {}, settings_schema: []
    };
    if (disabledMods.has(bundle.id)) {
      meta.status = 'disabled';
      mods.set(bundle.id, meta);
      emit('modLoaded', meta);
      return meta;
    }
    try {
      if (meta._bundle._translated && meta._bundle._translated.meta &&
          Array.isArray(meta._bundle._translated.meta.settings)) {
        meta.settings_schema = meta._bundle._translated.meta.settings;
      } else if (bundle.settings_schema) {
        meta.settings_schema = bundle.settings_schema;
      }
      meta.settings = loadSettingsFromStorage(bundle.id, meta.settings_schema);

      const factory = new Function('api', 'mod',
        `"use strict";\n${bundle.main}\n//# sourceURL=ttmod:${bundle.id}`);
      meta.exports = factory(API, meta) || {};
      meta.status = 'loaded';
      log(`✅ Loaded .ttmod: ${meta.name} (${bundle.id}) v${meta.version}`);
    } catch (e) {
      meta.status = 'error'; meta.error = e;
      err(`Failed to run .ttmod ${bundle.id}:`, e);
    }
    mods.set(bundle.id, meta);
    emit('modLoaded', meta);
    return meta;
  }

  async function loadAll() {
    const ids = await loadManifest();
    log(`Manifest: ${ids.join(', ')}`);
    const out = [];
    for (const id of ids) out.push(await loadMod(id));

    try {
      const tRes = await fetch('mods/ttmods/manifest.json', { cache: 'no-store' });
      if (tRes.ok) {
        const list = await tRes.json();
        const files = Array.isArray(list.ttmods) ? list.ttmods : [];
        log(`ttmods folder: ${files.length} file(s)`);
        for (const file of files) {
          try {
            const fRes = await fetch('mods/ttmods/' + file, { cache: 'no-store' });
            if (!fRes.ok) { warn(`ttmod 404: ${file}`); continue; }
            const text = await fRes.text();
            await API.importTtmodFile({ text: () => Promise.resolve(text), name: file }, true);
          } catch (e) { err('ttmod load failed:', file, e); }
        }
      }
    } catch (e) { warn('ttmods scan failed:', e.message); }

    for (const bundle of importedBundles) {
      if (mods.has(bundle.id)) continue;
      out.push(await registerImportedMod(bundle));
    }

    emit('modsLoaded', out);
    return out;
  }

  const MODS_BG_BASE  = 'linear-gradient(180deg,rgba(0,110,0,0.92) 0%,rgba(0,70,0,0.92) 100%)';
  const MODS_BG_HOVER = 'linear-gradient(180deg,rgba(0,160,0,0.95) 0%,rgba(0,90,0,0.95) 100%)';

  /* ============================================================
   * Modatorial palette — used for the three injected buttons
   * ============================================================ */
  const PALETTE = {
    mods:       { base: 'linear-gradient(180deg,#10B981 0%,#059669 100%)',
                  hover:'linear-gradient(180deg,#34d399 0%,#10B981 100%)',
                  border:'#00F5D4' },
    store:      { base: 'linear-gradient(180deg,#059669 0%,#046f53 100%)',
                  hover:'linear-gradient(180deg,#10B981 0%,#059669 100%)',
                  border:'#10B981' },
    appearance: { base: 'linear-gradient(180deg,#6366F1 0%,#4a4dc9 100%)',
                  hover:'linear-gradient(180deg,#818cf8 0%,#6366F1 100%)',
                  border:'#00F5D4' }
  };

  function injectModsButton() {
    const btns = getMainMenuButtons();
    const input = document.getElementById('input0');
    const onMainMenu = isVisible(input);
    const anyGameBtnVisible = btns.some(isVisible);

    if (!onMainMenu || !anyGameBtnVisible) {
      ['tt-mods-btn', 'tt-store-btn', 'tt-appearance-btn'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.remove();
      });
      return;
    }
    if (!btns.length) return;
    if (document.getElementById('tt-mods-btn')) return;

    const baseFont = btns[0].style.font || '17.55px system-ui';

    const make = (id, label, onClick, palette) => {
      const b = document.createElement('button');
      b.id = id;
      b.dataset.ttOur = '1';
      b.dataset.ttLabel = label;
      b.type = 'button';
      b.innerHTML = label;
      Object.assign(b.style, {
        color: '#fff', userSelect: 'none', outline: 'none',
        overflowWrap: 'break-word',
        background: palette.base,
        border: '2.2px solid ' + palette.border,
        font: baseFont,
        padding: '0em 0.3em',
        cursor: 'pointer',
        textAlign: 'center',
        lineHeight: '1.2'
      });
      b.addEventListener('mouseenter', () => { b.style.background = palette.hover; });
      b.addEventListener('mouseleave', () => { b.style.background = palette.base; });
      b.addEventListener('click', onClick);
      document.body.appendChild(b);
      return b;
    };

    make('tt-mods-btn', 'Mods', () => showMenu(), PALETTE.mods);
    make('tt-store-btn', 'Mod Store', () => {
      if (window.ModStore && typeof window.ModStore.open === 'function') {
        window.ModStore.open();
      } else {
        API.showToast('⚠️ mod-store.js not loaded');
      }
    }, PALETTE.store);
    make('tt-appearance-btn', 'Appearance', () => {
      if (window.TerritorialAppearance && typeof window.TerritorialAppearance.open === 'function') {
        window.TerritorialAppearance.open();
      } else {
        API.showToast('appearance.js not loaded');
      }
    }, PALETTE.appearance);
  }

  /* ============================================================
   * Color the game's own menu buttons with the Modatorial palette
   * ============================================================ */
  const MENU_BTN_COLORS = {
    'Custom Scenario': { base: 'linear-gradient(180deg,#0284C7 0%,#0369a1 100%)',
                         hover:'linear-gradient(180deg,#0ea5e9 0%,#0284C7 100%)',
                         border:'#00F5D4' },
    'My Account':      { base: 'linear-gradient(180deg,#6366F1 0%,#4a4dc9 100%)',
                         hover:'linear-gradient(180deg,#818cf8 0%,#6366F1 100%)',
                         border:'#00F5D4' },
    'Game Menu':       { base: 'linear-gradient(180deg,#1E293B 0%,#0F172A 100%)',
                         hover:'linear-gradient(180deg,#334155 0%,#1E293B 100%)',
                         border:'#0284C7' }
  };

  function colorGameMenuButtons() {
    document.querySelectorAll('body > button').forEach(btn => {
      if (btn.dataset.ttOur === '1') return;
      if (btn.dataset.ttMenuBtn !== '1' && btn.dataset.ttIconApplied !== '1') return;

      const label = btn.dataset.ttLabel
        || (btn.querySelector('.tt-btn-label') && btn.querySelector('.tt-btn-label').textContent)
        || stripEmoji(btn.textContent);
      if (!label) return;

      for (const [key, colors] of Object.entries(MENU_BTN_COLORS)) {
        if (label.toLowerCase().includes(key.toLowerCase())) {
          if (btn.dataset.ttColored === key) return;
          btn.dataset.ttColored = key;
          btn.style.setProperty('background', colors.base, 'important');
          btn.style.setProperty('border-color', colors.border, 'important');
          if (!btn.dataset.ttHoverBound) {
            btn.dataset.ttHoverBound = '1';
            btn.addEventListener('mouseenter', () => {
              const c = MENU_BTN_COLORS[btn.dataset.ttColored];
              if (c) btn.style.setProperty('background', c.hover, 'important');
            });
            btn.addEventListener('mouseleave', () => {
              const c = MENU_BTN_COLORS[btn.dataset.ttColored];
              if (c) btn.style.setProperty('background', c.base, 'important');
            });
          }
          return;
        }
      }
    });
  }

  let lastScreenState = null;
  function detectScreenChange() {
    const input = document.getElementById('input0');
    const onMenu = isVisible(input);
    if (lastScreenState === null) { lastScreenState = onMenu; return; }
    if (lastScreenState !== onMenu) {
      lastScreenState = onMenu;
      fadeTransition(220);
      emit('screenChanged', onMenu ? 'menu' : 'game');
    }
  }

  function boot() {
    applyTheme(API.getTheme());

    log(`Territorial.io Mod Loader v${API.version} (game r${API.gameVersion})`);
    log(`Disabled at boot: [${[...disabledMods].join(', ') || 'empty'}]`);
    log(`Layout: ${CLIENT.layout}${CLIENT.layout === 'sidebar' ? (CLIENT.sidebarCollapsed ? ' (collapsed)' : '') : ''}`);
    log(`Theme: ${API.getTheme()}`);

    if (!document.getElementById('tt-client-css')) {
      const link = document.createElement('link');
      link.id = 'tt-client-css';
      link.rel = 'stylesheet';
      link.href = 'css/client.css';
      document.head.appendChild(link);
    }

    (function installRipple(){
      if (window.__ttRippleInstalled) return;
      window.__ttRippleInstalled = true;
      document.addEventListener('click', e => {
        const btn = e.target.closest('body > button[data-tt-menu-btn="1"]');
        if (!btn) return;
        const rect = btn.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height) * 0.55;
        const x = e.clientX - rect.left - size / 2;
        const y = e.clientY - rect.top  - size / 2;
        const dot = document.createElement('span');
        dot.className = 'tt-ripple';
        dot.style.left = x + 'px'; dot.style.top = y + 'px';
        dot.style.width = size + 'px'; dot.style.height = size + 'px';
        btn.appendChild(dot);
        setTimeout(() => dot.remove(), 600);
      }, true);
    })();
    (function installCursorGlow(){
      if (window.__ttGlowInstalled) return;
      window.__ttGlowInstalled = true;
      document.addEventListener('mousemove', e => {
        const btn = e.target.closest('body > button[data-tt-menu-btn="1"]');
        if (!btn) return;
        const rect = btn.getBoundingClientRect();
        const xPct = ((e.clientX - rect.left) / rect.width)  * 100;
        const yPct = ((e.clientY - rect.top)  / rect.height) * 100;
        btn.style.setProperty('--tt-mx', xPct + '%');
        btn.style.setProperty('--tt-my', yPct + '%');
      }, { passive: true });
    })();

    const refresh = () => {
      injectModsButton();
      applyIcons();
      applyLayout();
      colorGameMenuButtons();
      detectScreenChange();
    };

    setInterval(filterMenuPopupButtons, 100);
    setInterval(filterMultiplayer,      100);
    setInterval(refresh,                300);
    setInterval(sweepClanBar,           500);

    window.addEventListener('resize', refresh);
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
      log(`Done. Active: ${active}, Disabled: ${off}. Press F10 for mods, F8 for store.`);
      emit('ready', list);
    });
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else boot();

})(window);