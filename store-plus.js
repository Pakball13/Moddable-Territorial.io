/* ============================================================
 * store-plus.js — Modrinth-style store UI
 *  - sidebar categories
 *  - search + sort
 *  - detail modal with Description / Changelog / Versions tabs
 *  - downloads counter, verified author badges
 *  - emoji tiles (no images needed)
 * ============================================================ */
(function () {
  'use strict';

  const NAME_EMOJI = {
    'FPS Counter':'📊','Clock HUD':'🕒','FPS + Clock Combo':'⏱️',
    'Crosshair Cursor':'🎯','Cyan Player':'🔷','Grid Overlay':'🔲',
    'Status Bar (Top)':'⬢','Status Bar (Bottom)':'⬡','Tactical HUD':'🎖️',
    'Modatorial Watermark':'💧','Confirm Exit':'🚪','Auto-Skip Splash':'⏭️',
    'GG Quick Chat':'💬','Highlight Me':'⭐','Reload Hotkey':'🔄',
    'Cyberpunk Theme':'🌆','Forest Theme':'🌲','Monochrome Theme':'◼️',
    'Sunset Theme':'🌅','Midnight+ Theme':'🌙','Clean UI':'✨',
    'No Multiplayer':'🚫','Dark Background':'⬛','Gradient Background':'🌈',
    'Deep Space Background':'🌌','Welcome Message':'👋','Loading Message':'⏳',
    'Name Watermark':'🏷️','Minimal Mode':'▫️'
  };
  const CATEGORIES = [
    { id: 'all',      label: 'All mods',    icon: '🧩' },
    { id: 'hud',      label: 'HUD',         icon: '📊' },
    { id: 'theme',    label: 'Themes',      icon: '🎨' },
    { id: 'utility',  label: 'Utility',     icon: '🔧' },
    { id: 'cosmetic', label: 'Cosmetic',    icon: '✨' },
    { id: 'ui',       label: 'Interface',   icon: '🖥️' },
    { id: 'fun',      label: 'Fun',         icon: '🎉' }
  ];

  /* ── CSS ─────────────────────────────────────────────── */
  const css = `
    .tt-store-shell { display:flex; gap:16px; height:100%; }
    .tt-store-sidebar {
      width: 200px; flex: 0 0 200px; padding: 16px 8px;
      border-right: 1px solid #262a31;
      display:flex; flex-direction:column; gap:2px;
      overflow-y:auto;
    }
    .tt-store-sidebar .cat {
      display:flex; align-items:center; gap:8px;
      padding: 7px 12px; border-radius: 7px;
      font: 500 13px system-ui; color: #adbac7;
      cursor: pointer; user-select:none;
    }
    .tt-store-sidebar .cat:hover { background: #1c1f24; color:#e6edf3; }
    .tt-store-sidebar .cat.active { background: #238636; color: #fff; }
    .tt-store-main { flex:1 1 auto; display:flex; flex-direction:column; min-width:0; }
    .tt-store-toolbar {
      display:flex; gap:10px; padding: 12px 16px;
      border-bottom: 1px solid #262a31;
      align-items:center;
    }
    .tt-store-toolbar input[type="search"] {
      flex:1 1 auto; padding: 9px 12px; border-radius: 8px;
      background:#0d1117; border:1px solid #30363d; color:#e6edf3;
      font: 400 14px system-ui; min-width: 0;
    }
    .tt-store-toolbar input[type="search"]:focus { outline:none; border-color:#3fb950; }
    .tt-store-toolbar select {
      padding: 9px 12px; border-radius: 8px; background:#0d1117;
      border:1px solid #30363d; color:#e6edf3; font: 400 13px system-ui;
      cursor:pointer;
    }
    .tt-store-grid {
      display:grid;
      grid-template-columns: repeat(auto-fill, minmax(320px,1fr));
      gap: 12px; padding: 16px;
      overflow-y:auto; flex:1 1 auto; align-content:start;
    }
    .tt-mod-card {
      display:flex; gap:12px; padding:14px;
      background:#16181d; border:1px solid #262a31; border-radius:10px;
      cursor:pointer; transition: border-color .15s, transform .1s;
      position:relative;
    }
    .tt-mod-card:hover { border-color:#3fb950; transform:translateY(-1px); }
    .tt-mod-emoji {
      flex:0 0 56px; width:56px; height:56px;
      display:flex; align-items:center; justify-content:center;
      font-size:32px; border-radius:10px;
      background: linear-gradient(135deg,#1a2a1a,#0d1a0d);
    }
    .tt-mod-body { flex:1 1 auto; min-width:0; display:flex; flex-direction:column; gap:4px; }
    .tt-mod-name {
      font:700 14px system-ui; color:#e6edf3;
      white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
    }
    .tt-mod-author { font:400 11px system-ui; color:#8b949e;
      display:flex; align-items:center; gap:4px; }
    .tt-mod-verified { color:#3fb950; font-size:11px; }
    .tt-mod-desc {
      font:400 12px system-ui; color:#adbac7; line-height:1.4;
      margin-top:2px; display:-webkit-box; -webkit-line-clamp:2;
      -webkit-box-orient:vertical; overflow:hidden;
    }
    .tt-mod-foot {
      display:flex; gap:10px; align-items:center; margin-top:auto;
      font:400 11px system-ui; color:#8b949e;
    }
    .tt-mod-tag {
      background:#21262d; padding:2px 7px; border-radius:6px;
      font-size:10px; text-transform:uppercase; letter-spacing:0.4px;
    }
    /* Detail modal */
    .tt-detail-overlay {
      position:fixed; inset:0; z-index:150000;
      background:rgba(0,0,0,0.8); backdrop-filter:blur(6px);
      display:flex; align-items:center; justify-content:center;
    }
    .tt-detail {
      width:min(820px,90vw); max-height:85vh;
      background:#16181d; border:1px solid #262a31; border-radius:14px;
      color:#e6edf3; font-family:system-ui;
      display:flex; flex-direction:column; overflow:hidden;
    }
    .tt-detail-head {
      padding:24px; display:flex; gap:18px; align-items:flex-start;
      border-bottom:1px solid #262a31;
    }
    .tt-detail-emoji {
      flex:0 0 96px; width:96px; height:96px;
      display:flex; align-items:center; justify-content:center;
      font-size:56px; border-radius:14px;
      background:linear-gradient(135deg,#1a2a1a,#0d1a0d);
    }
    .tt-detail-title { font:700 22px system-ui; margin:0 0 4px; }
    .tt-detail-meta { color:#8b949e; font-size:13px; margin:0 0 10px; }
    .tt-detail-tags { display:flex; gap:6px; flex-wrap:wrap; }
    .tt-detail-tag {
      background:#21262d; padding:3px 8px; border-radius:6px;
      font-size:10px; text-transform:uppercase; letter-spacing:0.4px;
    }
    .tt-detail-actions { margin-left:auto; display:flex; flex-direction:column; gap:8px; }
    .tt-detail-btn {
      padding:10px 18px; border-radius:8px; font:600 13px system-ui;
      cursor:pointer; border:0; white-space:nowrap;
    }
    .tt-detail-btn.primary { background:#238636; color:#fff; }
    .tt-detail-btn.primary:hover { background:#2ea043; }
    .tt-detail-btn.danger { background:#8b2626; color:#fff; }
    .tt-detail-btn.ghost { background:transparent; color:#8b949e; border:1px solid #30363d; }
    .tt-detail-tabs {
      display:flex; gap:2px; padding:0 24px;
      border-bottom:1px solid #262a31;
    }
    .tt-detail-tab {
      padding:12px 16px; font:600 13px system-ui; color:#8b949e;
      cursor:pointer; border-bottom:2px solid transparent;
    }
    .tt-detail-tab.active { color:#e6edf3; border-bottom-color:#3fb950; }
    .tt-detail-body {
      padding:20px 24px; overflow-y:auto; flex:1 1 auto;
      font:400 14px system-ui; line-height:1.6; color:#adbac7;
    }
    .tt-detail-body h3 { color:#e6edf3; margin:0 0 8px; font-size:15px; }
    .tt-detail-body ul { padding-left:20px; }
    .tt-detail-body code {
      background:#0d1117; padding:1px 6px; border-radius:4px;
      font-family:'SF Mono',Menlo,monospace; font-size:12px;
    }
    .tt-changelog-entry {
      padding:14px; background:#0d1117; border-radius:8px; margin-bottom:10px;
      border-left:3px solid #3fb950;
    }
    .tt-changelog-version {
      font:700 13px system-ui; color:#3fb950; margin-bottom:6px;
    }
    .tt-changelog-date { color:#6e7681; font-size:11px; font-weight:400; margin-left:8px; }
    .tt-empty {
      padding:60px 20px; text-align:center; color:#6e7681;
      font-style:italic; font-size:14px;
    }
  `;
  const styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  /* ── State ───────────────────────────────────────────── */
  let state = {
    mods: [], filtered: [], category: 'all',
    query: '', sort: 'relevance', installed: new Set()
  };

  function getEmoji(name) {
    if (!name) return '🧩';
    const t = name.trim();
    if (NAME_EMOJI[t]) return NAME_EMOJI[t];
    for (const k in NAME_EMOJI)
      if (t.toLowerCase().includes(k.toLowerCase())) return NAME_EMOJI[k];
    return '🧩';
  }

  function esc(s) {
    return String(s || '').replace(/[&<>"']/g, c =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  function timeAgo(ts) {
    if (!ts) return 'just now';
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    const s = (Date.now() - d.getTime()) / 1000;
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.floor(s/60)}m ago`;
    if (s < 86400) return `${Math.floor(s/3600)}h ago`;
    if (s < 2592000) return `${Math.floor(s/86400)}d ago`;
    return d.toLocaleDateString();
  }

  function matchesCategory(m, cat) {
    if (cat === 'all') return true;
    if (!m.tags) return false;
    return m.tags.includes(cat);
  }

  function applyFilters() {
    const q = state.query.toLowerCase();
    let list = state.mods.filter(m => matchesCategory(m, state.category));
    if (q) {
      list = list.filter(m =>
        (m.name || '').toLowerCase().includes(q) ||
        (m.author || '').toLowerCase().includes(q) ||
        (m.description || '').toLowerCase().includes(q));
    }
    switch (state.sort) {
      case 'downloads':
        list.sort((a, b) => (b.downloads || 0) - (a.downloads || 0)); break;
      case 'newest':
        list.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)); break;
      case 'updated':
        list.sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0)); break;
      case 'name':
        list.sort((a, b) => (a.name || '').localeCompare(b.name || '')); break;
    }
    state.filtered = list;
  }

  /* ── Card rendering ──────────────────────────────────── */
  function renderCard(m) {
    const card = document.createElement('div');
    card.className = 'tt-mod-card';

    const installed = state.installed.has(m.id) || state.installed.has(m.name);

    card.innerHTML = `
      <div class="tt-mod-emoji">${getEmoji(m.name)}</div>
      <div class="tt-mod-body">
        <div class="tt-mod-name">${esc(m.name || '(untitled)')}</div>
        <div class="tt-mod-author">
          by ${esc(m.author || 'anonymous')}
          ${m.authorUid ? '<span class="tt-mod-verified" title="Verified publisher">✔</span>' : ''}
        </div>
        <div class="tt-mod-desc">${esc(m.description || '')}</div>
        <div class="tt-mod-foot">
          <span class="tt-mod-tag">${esc((m.tags || [])[0] || 'mod')}</span>
          <span>⬇ ${m.downloads || 0}</span>
          <span>·</span>
          <span>${timeAgo(m.updatedAt || m.createdAt)}</span>
          ${installed ? '<span style="color:#3fb950;margin-left:auto">✓ installed</span>' : ''}
        </div>
      </div>
    `;
    card.onclick = () => openDetail(m);
    return card;
  }

  /* ── Detail modal ────────────────────────────────────── */
  function openDetail(m) {
    const overlay = document.createElement('div');
    overlay.className = 'tt-detail-overlay';

    const installed = state.installed.has(m.id) || state.installed.has(m.name);
    const canManage = window.Auth?.current()?.uid === m.authorUid;

    const changelog = Array.isArray(m.changelog) ? m.changelog
      : (m.changelog ? [{ version: m.version || '1.0.0', date: m.updatedAt, notes: m.changelog }]
                     : [{ version: m.version || '1.0.0', date: m.createdAt, notes: 'Initial release.' }]);

    overlay.innerHTML = `
      <div class="tt-detail">
        <div class="tt-detail-head">
          <div class="tt-detail-emoji">${getEmoji(m.name)}</div>
          <div>
            <h2 class="tt-detail-title">${esc(m.name || '')}</h2>
            <div class="tt-detail-meta">
              v${esc(m.version || '1.0.0')} · by <strong>${esc(m.author || 'anonymous')}</strong>
              ${m.authorUid ? '<span class="tt-mod-verified" title="Verified publisher">✔ verified</span>' : ''}
              · ⬇ ${m.downloads || 0}
            </div>
            <div class="tt-detail-tags">
              ${(m.tags || []).map(t => `<span class="tt-detail-tag">${esc(t)}</span>`).join('')}
            </div>
          </div>
          <div class="tt-detail-actions">
            <button class="tt-detail-btn primary" id="tt-d-install">
              ${installed ? '✓ Installed' : '⬇ Install'}
            </button>
            ${canManage ? `<button class="tt-detail-btn danger" id="tt-d-delete">Delete</button>` : ''}
            <button class="tt-detail-btn ghost" id="tt-d-close">Close</button>
          </div>
        </div>

        <div class="tt-detail-tabs">
          <div class="tt-detail-tab active" data-tab="desc">Description</div>
          <div class="tt-detail-tab" data-tab="changelog">Changelog</div>
          <div class="tt-detail-tab" data-tab="versions">Versions</div>
        </div>

        <div class="tt-detail-body" id="tt-d-body"></div>
      </div>
    `;

    const body = overlay.querySelector('#tt-d-body');

    function renderTab(tab) {
      if (tab === 'desc') {
        body.innerHTML = `
          <h3>About ${esc(m.name)}</h3>
          <p>${esc(m.description || 'No description provided.')}</p>
          ${m.longDescription ? `<h3 style="margin-top:20px">Details</h3><div>${m.longDescription}</div>` : ''}
          <h3 style="margin-top:20px">Compatibility</h3>
          <p>Client <code>v2.0.0+</code> · Game <code>r${esc(m.gameVersion || 25)}</code></p>
        `;
      } else if (tab === 'changelog') {
        body.innerHTML = changelog.map(entry => `
          <div class="tt-changelog-entry">
            <div class="tt-changelog-version">
              v${esc(entry.version)}
              <span class="tt-changelog-date">${timeAgo(entry.date)}</span>
            </div>
            <div>${esc(entry.notes || 'No notes.')}</div>
          </div>
        `).join('') || '<p>No changelog entries.</p>';
      } else if (tab === 'versions') {
        body.innerHTML = changelog.map((entry, i) => `
          <div style="display:flex;justify-content:space-between;padding:12px;
                      background:#0d1117;border-radius:8px;margin-bottom:6px;
                      ${i === 0 ? 'border-left:3px solid #3fb950;' : ''}">
            <div>
              <strong>v${esc(entry.version)}</strong>
              ${i === 0 ? ' <span style="color:#3fb950;font-size:11px">latest</span>' : ''}
            </div>
            <div style="color:#6e7681;font-size:12px">${timeAgo(entry.date)}</div>
          </div>
        `).join('') || '<p>No versions.</p>';
      }
    }
    renderTab('desc');

    overlay.querySelectorAll('.tt-detail-tab').forEach(t => {
      t.onclick = () => {
        overlay.querySelectorAll('.tt-detail-tab').forEach(x => x.classList.remove('active'));
        t.classList.add('active');
        renderTab(t.dataset.tab);
      };
    });

    overlay.querySelector('#tt-d-close').onclick = () => overlay.remove();
    overlay.querySelector('#tt-d-install').onclick = async () => {
      try {
        await ModStore.install(m.id || m.name);
        state.installed.add(m.id || m.name);
        overlay.querySelector('#tt-d-install').textContent = '✓ Installed';
        // bump downloads
        try {
          const db = firebase.firestore();
          await db.collection('mods').doc(m.id).update({
            downloads: firebase.firestore.FieldValue.increment(1)
          });
        } catch {}
      } catch (e) {
        TerritorialMods?.showToast?.(`Install failed: ${e.message}`);
      }
    };

    const delBtn = overlay.querySelector('#tt-d-delete');
    if (delBtn) delBtn.onclick = async () => {
      if (!confirm(`Delete "${m.name}" permanently?`)) return;
      try {
        const db = firebase.firestore();
        await db.collection('mods').doc(m.id).delete();
        state.mods = state.mods.filter(x => x.id !== m.id);
        applyFilters();
        refresh();
        overlay.remove();
        TerritorialMods?.showToast?.('🗑 Deleted');
      } catch (e) {
        TerritorialMods?.showToast?.(`Delete failed: ${e.message}`);
      }
    };

    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    document.body.appendChild(overlay);
  }

  /* ── Shell rendering ─────────────────────────────────── */
  let shell = null, grid = null, countEl = null;

  function build() {
    if (shell) return;

    const overlay = [...document.body.querySelectorAll('div')].find(d =>
      getComputedStyle(d).position === 'fixed' &&
      d.textContent.includes('Mod Store'));
    if (!overlay) return;

    // Wipe the old card grid (we replace it entirely)
    overlay.querySelectorAll('div').forEach(d => {
      if (d.children.length > 5 &&
          [...d.children].every(c => c.getBoundingClientRect().height < 200 &&
                                     c.getBoundingClientRect().width > 200)) {
        d.remove();
      }
    });

    shell = document.createElement('div');
    shell.className = 'tt-store-shell';
    shell.innerHTML = `
      <div class="tt-store-sidebar">
        ${CATEGORIES.map(c => `
          <div class="cat ${c.id === 'all' ? 'active' : ''}" data-cat="${c.id}">
            <span>${c.icon}</span><span>${c.label}</span>
          </div>
        `).join('')}
      </div>
      <div class="tt-store-main">
        <div class="tt-store-toolbar">
          <input type="search" placeholder="Search mods..." id="tt-store-search" />
          <select id="tt-store-sort">
            <option value="relevance">Relevance</option>
            <option value="downloads">Downloads</option>
            <option value="updated">Recently updated</option>
            <option value="newest">Newest</option>
            <option value="name">Name A–Z</option>
          </select>
        </div>
        <div class="tt-store-grid" id="tt-store-grid"></div>
      </div>
    `;
    overlay.appendChild(shell);
    grid = shell.querySelector('#tt-store-grid');

    shell.querySelectorAll('.cat').forEach(c => {
      c.onclick = () => {
        shell.querySelectorAll('.cat').forEach(x => x.classList.remove('active'));
        c.classList.add('active');
        state.category = c.dataset.cat;
        applyFilters();
        refresh();
      };
    });
    shell.querySelector('#tt-store-search').oninput = e => {
      state.query = e.target.value;
      applyFilters();
      refresh();
    };
    shell.querySelector('#tt-store-sort').onchange = e => {
      state.sort = e.target.value;
      applyFilters();
      refresh();
    };
  }

  function refresh() {
    if (!grid) return;
    grid.innerHTML = '';
    if (!state.filtered.length) {
      grid.innerHTML = '<div class="tt-empty">No mods match your filters.</div>';
      return;
    }
    for (const m of state.filtered) grid.appendChild(renderCard(m));
  }

  async function load() {
    if (!window.ModStore?.list) return;
    const installedList = JSON.parse(localStorage.getItem('tt-imported-mods') || '[]');
    state.installed = new Set(installedList.map(m => m.id || m.name));

    try {
      const list = await ModStore.list();
      state.mods = list || [];
      applyFilters();
      refresh();
    } catch (e) {
      console.warn('[StorePlus] list failed:', e);
    }
  }

  // Detect store open by watching for the overlay text
  const obs = new MutationObserver(() => {
    const overlay = [...document.body.querySelectorAll('div')].find(d =>
      getComputedStyle(d).position === 'fixed' &&
      d.textContent.includes('Mod Store') &&
      getComputedStyle(d).display !== 'none');
    if (overlay) { build(); load(); }
  });
  obs.observe(document.body, { childList: true, subtree: true });

  // Also expose a manual refresh
  window.StorePlus = { refresh: load };

  console.log('%c[StorePlus]', 'color:#3fb950;font-weight:bold', 'Modrinth-style store ready');
})();