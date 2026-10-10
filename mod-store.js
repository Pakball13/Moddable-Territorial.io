/* ============================================================
 * mod-store.js  —  Firebase-backed mod store
 * Browse, search, install, upload .ttmod files
 * Includes promo code redemption
 *
 * PATCHED: adds openInline() for the standalone mod-store.html
 * ============================================================ */
(function (global) {
  'use strict';

  const PFX = '%c[ModStore]';
  const STY = 'color:#f9a;font-weight:bold';
  const log   = (...a) => console.log(PFX, STY, ...a);
  const warn  = (...a) => console.warn(PFX, STY, ...a);
  const error = (...a) => console.error(PFX, STY, ...a);

  const SDK_VERSION = '10.12.0';
  const COLLECTION  = 'mods';

  let _app = null;
  let _db  = null;
  let _sdk = null;

  async function ensureFirebase() {
    if (_db) return _db;
    const cfg = global.MODATORIAL_FIREBASE;
    if (!cfg || !cfg.apiKey || cfg.apiKey === 'PASTE_YOUR_API_KEY_HERE') {
      throw new Error('Firebase not configured — edit firebase-config.js');
    }
    if (!_sdk) {
      const appMod = await import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-app.js`);
      const fsMod  = await import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-firestore.js`);

      /* ← PATCHED: reuse compat-initialized [DEFAULT] app if it exists.
         The compat SDK loaded by firebase-config.js already created it. */
      try {
        _app = appMod.getApp();
        log('Reusing existing Firebase app');
      } catch {
        _app = appMod.initializeApp(cfg);
        log('Initialized new Firebase app');
      }

      _sdk = {
        collection:      fsMod.collection,
        addDoc:          fsMod.addDoc,
        getDocs:         fsMod.getDocs,
        doc:             fsMod.doc,
        updateDoc:       fsMod.updateDoc,
        query:           fsMod.query,
        orderBy:         fsMod.orderBy,
        limit:           fsMod.limit,
        where:           fsMod.where,
        increment:       fsMod.increment,
        serverTimestamp: fsMod.serverTimestamp,
        getFirestore:    fsMod.getFirestore
      };
      _db = _sdk.getFirestore(_app);
      log('Firestore ready');
    }
    return _db;
  }

  const Store = {
    async list({ limit: max = 60 } = {}) {
      await ensureFirebase();
      const col = _sdk.collection(_db, COLLECTION);
      const q = _sdk.query(col, _sdk.orderBy('createdAt', 'desc'), _sdk.limit(max));
      const snap = await _sdk.getDocs(q);
      const out = [];
      snap.forEach(d => out.push(Object.assign({ id: d.id }, d.data())));
      return out;
    },

    async search(term) {
      const all = await this.list({ limit: 200 });
      const t = term.toLowerCase();
      return all.filter(m =>
        (m.name || '').toLowerCase().includes(t) ||
        (m.author || '').toLowerCase().includes(t) ||
        (m.description || '').toLowerCase().includes(t)
      );
    },

    async publish({ name, author, description, version, icon, ttmod, tags }) {
      await ensureFirebase();
      if (!name || name.length > 60)         throw new Error('Name must be 1–60 chars');
      if (!author || author.length > 40)     throw new Error('Author must be 1–40 chars');
      if (!ttmod || ttmod.length > 800000)   throw new Error('Bundle too large (max 800KB)');

      /* -------- Promo code gate -------- */
      if (global.TerritorialPromo) {
        const remaining = global.TerritorialPromo.getUploadsRemaining();
        if (remaining <= 0) {
          throw new Error('No upload slots — redeem a promo code first');
        }
        const used = global.TerritorialPromo.useUploadSlot();
        if (!used) throw new Error('Could not consume upload slot');
      }
      /* -------------------------------- */

      const doc = {
        name:        String(name).slice(0, 60),
        author:      String(author).slice(0, 40),
        description: String(description || '').slice(0, 500),
        version:     String(version || '1.0.0').slice(0, 20),
        icon:        icon || null,
        ttmod:       ttmod,
        tags:        Array.isArray(tags) ? tags.slice(0, 8).map(t => String(t).slice(0, 20)) : [],
        downloads:   0,
        createdAt:   _sdk.serverTimestamp()
      };
      const ref = await _sdk.addDoc(_sdk.collection(_db, COLLECTION), doc);
      log('Published mod', ref.id);
      return ref.id;
    },

    async countDownload(modId) {
      try {
        await ensureFirebase();
        const ref = _sdk.doc(_db, COLLECTION, modId);
        await _sdk.updateDoc(ref, { downloads: _sdk.increment(1) });
      } catch (e) { warn('Count update failed (ok):', e.message); }
    },

    async install(modDoc) {
      if (!modDoc || !modDoc.ttmod) throw new Error('Invalid store item');
      if (!global.TerritorialMods) throw new Error('Mod loader not ready');
      await global.TerritorialMods.importTtmodFile(
        { text: () => Promise.resolve(modDoc.ttmod), name: (modDoc.name || 'mod') + '.ttmod' },
        false
      );
      this.countDownload(modDoc.id);
      log('Installed from store:', modDoc.name);
      return true;
    }
  };

  let modal = null;

  function buildModal() {
    const root = document.createElement('div');
    root.id = 'tt-store-modal';
    root.dataset.ttOur = '1';
    Object.assign(root.style, {
      position: 'fixed', inset: '0',
      background: '#0F172A',
      zIndex: 999999,
      display: 'none', flexDirection: 'column',
      fontFamily: 'system-ui, sans-serif', color: '#fff',
      padding: '0', boxSizing: 'border-box'
    });

    /* ← PATCHED: shared close handler that navigates when standalone */
    function closeThis() {
      if (document.body.dataset.ttStandalone === '1') {
        location.href = 'game.html';
      } else {
        root.style.display = 'none';
      }
    }

    const head = document.createElement('div');
    Object.assign(head.style, {
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '16px 22px',
      background: 'linear-gradient(180deg, #16223c 0%, #0F172A 100%)',
      borderBottom: '1px solid #0284C7',
      flexWrap: 'wrap'
    });

    const title = document.createElement('div');
    title.textContent = '📦 Mod Store';
    title.style.cssText = 'font-size:20px;font-weight:700;flex:0 0 auto;color:#e6edf3;';

    const search = document.createElement('input');
    search.type = 'text';
    search.placeholder = 'Search mods…';
    search.style.cssText =
      'flex:1;min-width:200px;max-width:400px;padding:8px 14px;border-radius:6px;' +
      'background:#1E293B;color:#e6edf3;border:1px solid #0284C7;' +
      'font-family:inherit;font-size:13px;outline:none;';

    const promoBtn = document.createElement('button');
    promoBtn.textContent = '🎁 Redeem';
    promoBtn.title = 'Redeem a promo code';
    promoBtn.style.cssText =
      'background:#6366F1;color:#fff;border:1px solid #4a4dc9;padding:8px 16px;' +
      'border-radius:6px;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600;';

    const uploadBtn = document.createElement('button');
    uploadBtn.textContent = '⬆ Upload .ttmod';
    uploadBtn.style.cssText =
      'background:#10B981;color:#fff;border:1px solid #059669;padding:8px 16px;' +
      'border-radius:6px;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600;';

    const reloadBtn = document.createElement('button');
    reloadBtn.textContent = '🔄';
    reloadBtn.title = 'Reload catalog';
    reloadBtn.style.cssText =
      'background:#1E293B;color:#e6edf3;border:1px solid #0284C7;padding:8px 12px;' +
      'border-radius:6px;cursor:pointer;font-family:inherit;font-size:13px;';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.title = 'Close (Esc)';
    closeBtn.style.cssText =
      'background:#1E293B;color:#e6edf3;border:1px solid #0284C7;padding:8px 14px;' +
      'border-radius:6px;cursor:pointer;font-family:inherit;font-size:14px;';

    head.append(title, search, promoBtn, uploadBtn, reloadBtn, closeBtn);

    const grid = document.createElement('div');
    grid.style.cssText =
      'flex:1;min-height:0;overflow-y:auto;padding:22px;align-content:start;' +
      'display:grid;grid-auto-rows:minmax(250px,auto);' +
      'grid-template-columns:repeat(auto-fill,minmax(min(260px,100%),1fr));gap:16px;';

    const status = document.createElement('div');
    status.style.cssText =
      'padding:10px 22px;background:#0F172A;color:#7d8590;font-size:12px;' +
      'border-top:1px solid #0284C7;';
    status.textContent = 'Ready.';

    root.append(head, grid, status);
    document.body.appendChild(root);

    const fileIn = document.createElement('input');
    fileIn.type = 'file';
    fileIn.accept = '.ttmod,text/plain,application/json';
    fileIn.style.display = 'none';
    document.body.appendChild(fileIn);

    uploadBtn.addEventListener('click', () => fileIn.click());
    fileIn.addEventListener('change', async e => {
      const f = e.target.files && e.target.files[0];
      fileIn.value = '';
      if (!f) return;
      try {
        const text = await f.text();
        await publishFlow(text);
      } catch (err) {
        alert('Upload failed: ' + err.message);
      }
    });

    promoBtn.addEventListener('click', () => openPromoModal());

    /* ← PATCHED: close button uses the shared handler */
    closeBtn.addEventListener('click', closeThis);
    reloadBtn.addEventListener('click', () => loadAndRender(search.value));
    search.addEventListener('input', debounce(() => loadAndRender(search.value), 250));

    /* ← PATCHED: Escape key uses the shared handler too,
       but only when no detail modal is open. */
    document.addEventListener('keydown', e => {
      if (e.key !== 'Escape') return;
      if (document.querySelector('.tt-detail-overlay')) return;
      if (root.style.display !== 'flex') return;
      closeThis();
    });

    function debounce(fn, ms) {
      let t;
      return function (...args) {
        clearTimeout(t);
        t = setTimeout(() => fn.apply(this, args), ms);
      };
    }

    function openPromoModal() {
      const overlay = document.createElement('div');
      overlay.dataset.ttOur = '1';
      Object.assign(overlay.style, {
        position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.9)',
        zIndex: 1000100, display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px'
      });
      const panel = document.createElement('div');
      panel.style.cssText =
        'background:#1E293B;border:1px solid #0284C7;border-radius:12px;' +
        'padding:24px 26px;max-width:460px;width:100%;color:#e6edf3;font-family:system-ui;';

      panel.innerHTML =
        '<div style="font-size:20px;font-weight:700;margin-bottom:14px;">🎁 Promo Codes</div>' +
        '<div style="font-size:13px;opacity:.7;margin-bottom:14px;">Enter a code to unlock upload slots and store credits.</div>';

      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = 'Enter code…';
      input.style.cssText =
        'width:100%;padding:10px 14px;background:#0F172A;color:#e6edf3;border:1px solid #0284C7;' +
        'border-radius:6px;font-family:inherit;font-size:14px;margin-bottom:10px;outline:none;';
      panel.appendChild(input);

      const result = document.createElement('div');
      result.style.cssText = 'font-size:13px;min-height:20px;margin-bottom:12px;';
      panel.appendChild(result);

      const row = document.createElement('div');
      row.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;';

      const cancel = document.createElement('button');
      cancel.textContent = 'Cancel';
      cancel.style.cssText =
        'background:#1E293B;color:#e6edf3;border:1px solid #0284C7;padding:8px 16px;' +
        'border-radius:6px;cursor:pointer;font-family:inherit;font-size:13px;';
      cancel.addEventListener('click', () => overlay.remove());

      const submit = document.createElement('button');
      submit.textContent = 'Redeem';
      submit.style.cssText =
        'background:#10B981;color:#fff;border:1px solid #059669;padding:8px 16px;' +
        'border-radius:6px;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600;';
      submit.addEventListener('click', () => {
        const code = input.value.trim();
        if (!window.TerritorialPromo) {
          result.textContent = '❌ Promo system not loaded';
          return;
        }
        const res = window.TerritorialPromo.redeem(code);
        if (res.ok) {
          result.style.color = '#10B981';
          result.textContent = '✅ ' + res.badge + ' ' + res.name + ' — ' + res.description;
          setTimeout(() => overlay.remove(), 2500);
        } else {
          result.style.color = '#f85149';
          result.textContent = '❌ ' + res.reason;
        }
      });

      row.append(cancel, submit);
      panel.appendChild(row);
      overlay.appendChild(panel);
      overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
      document.body.appendChild(overlay);
      input.focus();
      input.addEventListener('keydown', e => { if (e.key === 'Enter') submit.click(); });
    }

    async function publishFlow(ttmodText) {
      const tm = ttmodText.match(/<ttmod[^>]*>([\s\S]*?)<\/ttmod>/i);
      if (!tm) throw new Error('Invalid .ttmod file — missing <ttmod> block');
      let meta;
      try { meta = JSON.parse(tm[1]); }
      catch { throw new Error('Invalid JSON inside .ttmod'); }

      const name = prompt('Mod name (shown in store):', meta.name || 'Untitled');
      if (!name) return;
      const author = prompt('Your name / handle:', meta.author || 'Anonymous');
      if (!author) return;
      const desc = prompt('Short description (max 500 chars):', meta.description || '');
      if (desc === null) return;

      let iconDataUrl = null;
      if (confirm('Add a cover image?')) {
        iconDataUrl = await pickFile('.png,.jpg,.jpeg,.webp');
      }

      if (ttmodText.length > 800000) {
        alert('File too large for the free tier (max 800KB).');
        return;
      }

      status.textContent = '⏳ Uploading…';
      try {
        await Store.publish({
          name, author,
          description: desc,
          version: meta.version || '1.0.0',
          icon: iconDataUrl,
          ttmod: ttmodText,
          tags: meta.tags || []
        });
        status.textContent = '✅ Uploaded: ' + name;
        await loadAndRender(search.value);
      } catch (e) {
        status.textContent = '❌ ' + e.message;
        throw e;
      }
    }

    function pickFile(accept) {
      return new Promise(resolve => {
        const i = document.createElement('input');
        i.type = 'file';
        i.accept = accept || 'image/*';
        i.addEventListener('change', async () => {
          const f = i.files && i.files[0];
          if (!f) return resolve(null);
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(f);
        });
        i.click();
      });
    }

    async function loadAndRender(searchTerm) {
      grid.innerHTML = '<div style="opacity:.5;grid-column:1/-1;text-align:center;padding:40px;">Loading…</div>';
      try {
        const mods = searchTerm ? await Store.search(searchTerm) : await Store.list();
        status.textContent = `${mods.length} mod${mods.length === 1 ? '' : 's'} found`;
        if (!mods.length) {
          grid.innerHTML = '<div style="opacity:.5;grid-column:1/-1;text-align:center;padding:40px;font-style:italic;">No mods in the store yet. Be the first to upload!</div>';
          return;
        }
        grid.innerHTML = '';
        for (const m of mods) grid.appendChild(renderCard(m));
      } catch (e) {
        status.textContent = '❌ ' + e.message;
        grid.innerHTML = `<div style="opacity:.6;grid-column:1/-1;text-align:center;padding:40px;">Could not load store.<br><small style="opacity:.7">${e.message}</small></div>`;
      }
    }

    function renderCard(m) {
      const card = document.createElement('div');
      card.style.cssText =
        'background:#1E293B;border:1px solid #0284C7;border-radius:10px;' +
        'min-height:250px;box-sizing:border-box;overflow:hidden;display:flex;flex-direction:column;' +
        'transition:transform .12s,box-shadow .12s;';
      card.addEventListener('mouseenter', () => {
        card.style.transform = 'translateY(-2px)';
        card.style.boxShadow = '0 6px 20px rgba(0,245,212,0.15)';
      });
      card.addEventListener('mouseleave', () => {
        card.style.transform = '';
        card.style.boxShadow = '';
      });

      if (m.icon) {
        const img = document.createElement('img');
        img.src = m.icon;
        img.style.cssText = 'width:100%;height:130px;flex:0 0 130px;object-fit:cover;background:#0F172A;';
        card.appendChild(img);
      } else {
        const ph = document.createElement('div');
        ph.textContent = '📦';
        ph.style.cssText =
          'width:100%;height:130px;display:flex;align-items:center;' +
          'flex:0 0 130px;justify-content:center;background:#0F172A;font-size:44px;opacity:.5;';
        card.appendChild(ph);
      }

      const body = document.createElement('div');
      body.style.cssText = 'padding:12px 14px;display:flex;flex-direction:column;gap:6px;flex:1;';

      const name = document.createElement('div');
      name.textContent = m.name || 'Untitled';
      name.style.cssText = 'font-weight:700;font-size:15px;color:#e6edf3;';

      const meta = document.createElement('div');
      meta.textContent = `v${m.version || '1.0.0'} · by ${m.author || 'Unknown'}`;
      meta.style.cssText = 'font-size:12px;opacity:.7;';

      const desc = document.createElement('div');
      desc.textContent = m.description || '';
      desc.style.cssText = 'font-size:12px;opacity:.85;flex:1;color:#adbac7;';

      const foot = document.createElement('div');
      foot.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:4px;';

      const dl = document.createElement('div');
      dl.textContent = `⬇ ${m.downloads || 0}`;
      dl.style.cssText = 'font-size:11px;opacity:.55;';

      const btn = document.createElement('button');
      btn.textContent = '⬇ Install';
      btn.style.cssText =
        'background:#10B981;color:#fff;border:1px solid #059669;' +
        'padding:6px 14px;border-radius:6px;cursor:pointer;' +
        'font-family:inherit;font-size:12px;font-weight:600;';
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = 'Installing…';
        try {
          await Store.install(m);
          btn.textContent = '✅ Installed';
          btn.style.background = '#059669';
        } catch (e) {
          btn.textContent = '❌ Failed';
          btn.style.background = '#6a2020';
          status.textContent = '❌ ' + e.message;
        }
      });

      foot.append(dl, btn);
      body.append(name, meta, desc, foot);
      card.appendChild(body);
      return card;
    }

    let firstOpen = true;
    return {
      root,
      show() {
        root.style.display = 'flex';

        /* ← PATCHED: when loaded as a standalone page,
           turn the ✕ into a ← Back button. */
        if (document.body.dataset.ttStandalone === '1') {
          closeBtn.textContent = '← Back';
          closeBtn.title = 'Back to game';
          closeBtn.style.padding = '8px 16px';
          closeBtn.style.fontWeight = '600';
          closeBtn.style.background = '#0284C7';
          closeBtn.style.borderColor = '#0369a1';
        }

        if (firstOpen) {
          firstOpen = false;
          setTimeout(() => loadAndRender(), 0);
        }
      },
      hide() {
        if (document.body.dataset.ttStandalone === '1') {
          location.href = 'game.html';
        } else {
          root.style.display = 'none';
        }
      },
      render: () => loadAndRender()
    };
  }

  /* ============================================================
   * PUBLIC API
   * ============================================================ */
  global.ModStore = {
    /* ← PATCHED: from game.html / index.html, navigate to the
       dedicated page instead of opening a modal. */
    open() {
      location.href = 'mod-store.html';
    },

    /* ← PATCHED: internal — called by mod-store.html */
    openInline() {
      if (!modal) modal = buildModal();
      modal.show();
    },

    close() {
      if (modal) modal.hide();
    },

    list:    () => Store.list(),
    search:  t  => Store.search(t),
    publish: o  => Store.publish(o),
    install: m  => Store.install(m)
  };

  log('📦 mod-store.js loaded — call ModStore.open() or ModStore.openInline()');
})(window);