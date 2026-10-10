/* ============================================================
 * appearance.js  —  Appearance settings modal
 * Theme + layout + sidebar + chrome controls
 * ============================================================ */
(function (global) {
  'use strict';

  const PFX = '%c[Appearance]';
  const STY = 'color:#c9f;font-weight:bold';
  const log  = (...a) => console.log(PFX, STY, ...a);

  let modal = null;

  function build() {
    const overlay = document.createElement('div');
    overlay.dataset.ttOur = '1';
    Object.assign(overlay.style, {
      position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.9)',
      zIndex: 1000099, display: 'none', alignItems: 'center', justifyContent: 'center',
      padding: '20px', fontFamily: 'system-ui, sans-serif'
    });

    const panel = document.createElement('div');
    panel.style.cssText =
      'background:#161b22;border:1px solid #30363d;border-radius:12px;' +
      'padding:26px 28px;max-width:520px;width:100%;color:#fff;' +
      'max-height:85vh;overflow-y:auto;';

    const API = global.TerritorialMods;
    if (!API) { log('ModLoader not available — appearance modal disabled'); return null; }

    const head = document.createElement('div');
    head.style.cssText = 'display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;';
    head.innerHTML = '<div style="font-size:20px;font-weight:700;">🎨 Appearance</div>';
    const close = document.createElement('button');
    close.textContent = '✕';
    close.style.cssText = 'background:none;border:0;color:#fff;font-size:18px;cursor:pointer;';
    close.addEventListener('click', () => overlay.style.display = 'none');
    head.appendChild(close);
    panel.appendChild(head);

    /* ---- section helper ---- */
    const section = title => {
      const s = document.createElement('div');
      s.style.cssText = 'margin-bottom:22px;';
      const h = document.createElement('div');
      h.textContent = title;
      h.style.cssText =
        'font-size:12px;font-weight:700;text-transform:uppercase;' +
        'letter-spacing:1px;color:#58a6ff;margin-bottom:10px;';
      s.appendChild(h);
      panel.appendChild(s);
      return s;
    };

    /* ---- Theme picker ---- */
    const themeSec = section('Theme');
    const themes = API.getThemes();
    const themeRow = document.createElement('div');
    themeRow.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(90px,1fr));gap:10px;';
    const themeColors = {
      midnight:   '#3fb950',
      cyberpunk:  '#ff00aa',
      forest:     '#8bc34a',
      mono:       '#dddddd',
      sunset:     '#ff8844',
      ocean:      '#4dd0e1',
      modatorial: '#00F5D4'
    };
    themes.forEach(t => {
      const chip = document.createElement('button');
      const isActive = API.getTheme() === t;
      chip.textContent = t[0].toUpperCase() + t.slice(1);
      chip.style.cssText =
        `padding:12px 8px;border-radius:8px;cursor:pointer;font-family:inherit;` +
        `font-size:12px;font-weight:600;text-transform:capitalize;` +
        `background:${themeColors[t] || '#333'};` +
        `color:${['mono','midnight'].includes(t) ? '#000' : '#fff'};` +
        `border:2px solid ${isActive ? '#fff' : 'transparent'};`;
      chip.addEventListener('click', () => {
        API.setTheme(t);
        [...themeRow.children].forEach(c => c.style.borderColor = 'transparent');
        chip.style.borderColor = '#fff';
      });
      themeRow.appendChild(chip);
    });
    themeSec.appendChild(themeRow);

    /* ---- Layout picker ---- */
    const layoutSec = section('Layout');
    const layoutRow = document.createElement('div');
    layoutRow.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:10px;';
    ['sidebar', 'grid', 'circles'].forEach(l => {
      const b = document.createElement('button');
      b.textContent = l[0].toUpperCase() + l.slice(1);
      const isActive = API.getLayout() === l;
      b.style.cssText =
        `padding:12px 8px;border-radius:8px;cursor:pointer;font-family:inherit;` +
        `font-size:13px;font-weight:600;background:#21262d;color:#fff;` +
        `border:2px solid ${isActive ? '#3fb950' : '#30363d'};`;
      b.addEventListener('click', () => {
        API.setLayout(l);
        [...layoutRow.children].forEach(c => c.style.borderColor = '#30363d');
        b.style.borderColor = '#3fb950';
      });
      layoutRow.appendChild(b);
    });
    layoutSec.appendChild(layoutRow);

    /* ---- Toggles ---- */
    const toggleSec = section('Client');
    const toggles = [
      { label: 'Sidebar collapsed', get: () => API.getSidebarCollapsed(), set: v => API.setSidebarCollapsed(v) },
      { label: 'Show chrome bar',   get: () => API.getClient().chrome,    set: v => API.setChrome(v) },
      { label: 'Hide Multiplayer',  get: () => API.getClient().hideMultiplayer, set: v => API.setHideMultiplayer(v) },
      { label: 'Hide game version', get: () => API.getClient().hideVersion, set: v => API.setHideVersion(v) },
      { label: 'Hide game logo',    get: () => API.getClient().hideLogo,  set: v => API.setHideLogo(v) }
    ];
    toggles.forEach(t => {
      const row = document.createElement('label');
      row.style.cssText =
        'display:flex;align-items:center;gap:10px;padding:10px 12px;' +
        'background:#0d1117;border:1px solid #21262d;border-radius:8px;' +
        'margin-bottom:6px;cursor:pointer;font-size:13px;';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!t.get();
      cb.style.cssText = 'width:18px;height:18px;cursor:pointer;accent-color:#3fb950;';
      cb.addEventListener('change', () => t.set(cb.checked));
      row.append(cb, document.createTextNode(t.label));
      toggleSec.appendChild(row);
    });

    overlay.appendChild(panel);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.style.display = 'none'; });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && overlay.style.display === 'flex') overlay.style.display = 'none';
    });
    document.body.appendChild(overlay);
    return overlay;
  }

  global.TerritorialAppearance = {
    open() {
      if (!modal) modal = build();
      if (!modal) return;
      modal.style.display = 'flex';
    },
    close() { if (modal) modal.style.display = 'none'; }
  };

  log('appearance.js loaded — call TerritorialAppearance.open()');
})(window);