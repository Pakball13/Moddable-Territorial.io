/* ============================================================
 * mod-store.js  —  Firebase-backed mod store (v1.1)
 * Fixed: proper in-modal upload form (no more file-chooser blocks)
 * ============================================================ */
(function (global) {
  'use strict';

  const PFX = '%c[ModStore]';
  const STY = 'color:#f9a;font-weight:bold';
  const log   = (...a) => console.log(PFX, STY, ...a);
  const warn  = (...a) => console.warn(PFX, STY, ...a);

  const SDK_VERSION = '10.12.0';
  const COLLECTION  = 'mods';

  let _app = null, _db = null, _sdk = null;

  async function ensureFirebase() {
    if (_db) return _db;
    const cfg = global.MODATORIAL_FIREBASE;
    if (!cfg || !cfg.apiKey || cfg.apiKey === 'PASTE_YOUR_API_KEY_HERE') {
      throw new Error('Firebase not configured — edit firebase-config.js');
    }
    if (!_sdk) {
      const appMod = await import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-app.js`);
      const fsMod  = await import(`https://www.gstatic.com/firebasejs/${SDK_VERSION}/firebase-firestore.js`);
      _app = appMod.initializeApp(cfg);
      _sdk = {
        collection: fsMod.collection, addDoc: fsMod.addDoc, getDocs: fsMod.getDocs,
        doc: fsMod.doc, updateDoc: fsMod.updateDoc, query: fsMod.query,
        orderBy: fsMod.orderBy, limit: fsMod.limit, increment: fsMod.increment,
        serverTimestamp: fsMod.serverTimestamp, getFirestore: fsMod.getFirestore
      };
      _db = _sdk.getFirestore(_app);
      log('Firebase initialized');
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
      if (!name || name.length > 60)       throw new Error('Name must be 1–60 chars');
      if (!author || author.length > 40)   throw new Error('Author must be 1–40 chars');
      if (!ttmod || ttmod.length > 800000) throw new Error('Bundle too large (max 800KB)');
      const doc = {
        name: String(name).slice(0, 60),
        author: String(author).slice(0, 40),
        description: String(description || '').slice(0, 500),
        version: String(version || '1.0.0').slice(0, 20),
        icon: icon || null,
        ttmod,
        tags: Array.isArray(tags) ? tags.slice(0, 8).map(t => String(t).slice(0, 20)) : [],
        downloads: 0,
        createdAt: _sdk.serverTimestamp()
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
      } catch (e) { warn('Count update failed:', e.message); }
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

  /* ============================================================
   * UI
   * ============================================================ */
  let modal = null;

  function buildModal() {
    const root = document.createElement('div');
    root.id = 'tt-store-modal';
    root.dataset.ttOur = '1';
    Object.assign(root.style, {
      position: 'fixed', inset: '0',
      background: 'rgba(0,0,0,0.92)',
      zIndex: 100005, display: 'none', flexDirection: 'column',
      fontFamily: 'system-ui, sans-serif', color: '#fff'
    });

    /* ---------- header ---------- */
    const head = document.createElement('div');
    Object.assign(head.style, {
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '16px 22px', background: '#0d1117',
      borderBottom: '1px solid #30363d', flexWrap: 'wrap'
    });
    const title = document.createElement('div');
    title.textContent = '📦 Mod Store';
    title.style.cssText = 'font-size:20px;font-weight:700;flex:0 0 auto;';

    const search = document.createElement('input');
    search.type = 'text';
    search.placeholder = 'Search mods…';
    search.style.cssText = 'flex:1;min-width:200px;max-width:400px;padding:8px 14px;border-radius:6px;background:#161b22;color:#fff;border:1px solid #30363d;font-family:inherit;font-size:13px;';

    const uploadBtn = document.createElement('button');
    uploadBtn.textContent = '⬆ Upload .ttmod';
    uploadBtn.style.cssText = 'background:#238636;color:#fff;border:1px solid #2ea043;padding:8px 16px;border-radius:6px;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600;';

    const reloadBtn = document.createElement('button');
    reloadBtn.textContent = '🔄';
    reloadBtn.title = 'Reload catalog';
    reloadBtn.style.cssText = 'background:#333;color:#fff;border:1px solid #555;padding:8px 12px;border-radius:6px;cursor:pointer;font-family:inherit;font-size:13px;';

    const closeBtn = document.createElement('button');
    closeBtn.textContent = '✕';
    closeBtn.title = 'Close (Esc)';
    closeBtn.style.cssText = 'background:#444;color:#fff;border:1px solid #555;padding:8px 14px;border-radius:6px;cursor:pointer;font-family:inherit;font-size:14px;';

    head.append(title, search, uploadBtn, reloadBtn, closeBtn);

    const grid = document.createElement('div');
    grid.style.cssText = 'flex:1;overflow-y:auto;padding:22px;display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px;';

    const status = document.createElement('div');
    status.style.cssText = 'padding:10px 22px;background:#0d1117;color:#7d8590;font-size:12px;border-top:1px solid #30363d;';
    status.textContent = 'Ready.';

    root.append(head, grid, status);
    document.body.appendChild(root);

    /* ---------- upload modal ---------- */
    let uploadModal = null;
    function buildUploadModal() {
      const overlay = document.createElement('div');
      overlay.dataset.ttOur = '1';
      Object.assign(overlay.style, {
        position: 'fixed', inset: '0', background: 'rgba(0,0,0,0.85)',
        zIndex: 100006, display: 'none', alignItems: 'center', justifyContent: 'center',
        padding: '20px', boxSizing: 'border-box'
      });

      const panel = document.createElement('div');
      panel.style.cssText = 'background:#161b22;border:1px solid #30363d;border-radius:12px;padding:24px 26px;max-width:560px;width:100%;max-height:88vh;overflow-y:auto;color:#fff;font-family:system-ui;';

      const h = document.createElement('div');
      h.textContent = '⬆ Upload .ttmod';
      h.style.cssText = 'font-size:20px;font-weight:700;margin-bottom:6px;';
      panel.appendChild(h);

      const sub = document.createElement('div');
      sub.textContent = 'Fill in the details, then click Publish.';
      sub.style.cssText = 'font-size:12px;opacity:.6;margin-bottom:18px;';
      panel.appendChild(sub);

      /* step 1: pick file */
      const fileRow = document.createElement('div');
      fileRow.style.cssText = 'margin-bottom:14px;';

      const fileLabel = document.createElement('div');
      fileLabel.textContent = '1. Select .ttmod file';
      fileLabel.style.cssText = 'font-size:12px;font-weight:700;color:#58a6ff;margin-bottom:6px;text-transform:uppercase;letter-spacing:.8px;';
      fileRow.appendChild(fileLabel);

      const pickBtn = document.createElement('button');
      pickBtn.textContent = '📁 Choose file…';
      pickBtn.style.cssText = 'background:#21262d;color:#fff;border:1px solid #30363d;padding:10px 18px;border-radius:6px;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600;';
      fileRow.appendChild(pickBtn);

      const fileInfo = document.createElement('div');
      fileInfo.style.cssText = 'font-size:12px;opacity:.7;margin-top:8px;';
      fileInfo.textContent = 'No file selected';
      fileRow.appendChild(fileInfo);

      const fileIn = document.createElement('input');
      fileIn.type = 'file';
      fileIn.accept = '.ttmod,text/plain,application/json';
      fileIn.style.display = 'none';
      fileRow.appendChild(fileIn);

      let parsedMeta = null;
      let ttmodText = '';

      pickBtn.addEventListener('click', () => fileIn.click());

      fileIn.addEventListener('change', async () => {
        const f = fileIn.files && fileIn.files[0];
        if (!f) return;
        if (f.size > 800000) {
          fileInfo.textContent = '❌ File too large (max 800KB). Remove embedded assets.';
          fileInfo.style.color = '#f85149';
          return;
        }
        try {
          ttmodText = await f.text();
          const tm = ttmodText.match(/<ttmod[^>]*>([\s\S]*?)<\/ttmod>/i);
          if (!tm) throw new Error('Missing <ttmod> block');
          parsedMeta = JSON.parse(tm[1]);
          fileInfo.style.color = '#3fb950';
          fileInfo.textContent = `✅ ${f.name} — ${(f.size/1024).toFixed(1)} KB · v${parsedMeta.version || '1.0.0'}`;
          /* prefill fields */
          nameIn.value   = parsedMeta.name || '';
          authorIn.value = parsedMeta.author || '';
          descIn.value   = parsedMeta.description || '';
          versionIn.value = parsedMeta.version || '1.0.0';
          publishBtn.disabled = false;
          publishBtn.style.opacity = '1';
          publishBtn.style.cursor = 'pointer';
        } catch (err) {
          fileInfo.style.color = '#f85149';
          fileInfo.textContent = '❌ ' + err.message;
          parsedMeta = null;
          publishBtn.disabled = true;
          publishBtn.style.opacity = '0.5';
        }
      });

      panel.appendChild(fileRow);

      /* step 2: metadata */
      function field(labelText, placeholder, type = 'text') {
        const wrap = document.createElement('div');
        wrap.style.cssText = 'margin-bottom:12px;';
        const l = document.createElement('div');
        l.textContent = labelText;
        l.style.cssText = 'font-size:12px;font-weight:600;margin-bottom:4px;';
        wrap.appendChild(l);
        const i = document.createElement('input');
        i.type = type;
        i.placeholder = placeholder || '';
        i.style.cssText = 'width:100%;padding:9px 12px;background:#0d1117;color:#fff;border:1px solid #30363d;border-radius:6px;font-family:inherit;font-size:13px;box-sizing:border-box;';
        wrap.appendChild(i);
        return { wrap, input: i };
      }

      const step2 = document.createElement('div');
      step2.style.cssText = 'margin-bottom:14px;';
      const step2Title = document.createElement('div');
      step2Title.textContent = '2. Details';
      step2Title.style.cssText = 'font-size:12px;font-weight:700;color:#58a6ff;margin-bottom:10px;text-transform:uppercase;letter-spacing:.8px;';
      step2.appendChild(step2Title);

      const nameField    = field('Name', 'Cool Mod');
      const authorField  = field('Author', 'Your handle');
      const descField    = field('Description', 'Short description (max 500 chars)');
      const versionField = field('Version', '1.0.0');
      step2.append(nameField.wrap, authorField.wrap, descField.wrap, versionField.wrap);

      const nameIn    = nameField.input;
      const authorIn  = authorField.input;
      const descIn    = descField.input;
      const versionIn = versionField.input;

      /* icon picker */
      const iconRow = document.createElement('div');
      iconRow.style.cssText = 'margin-bottom:14px;';
      const iconLabel = document.createElement('div');
      iconLabel.textContent = 'Cover image (optional)';
      iconLabel.style.cssText = 'font-size:12px;font-weight:600;margin-bottom:4px;';
      iconRow.appendChild(iconLabel);

      const iconBtn = document.createElement('button');
      iconBtn.textContent = '🖼 Choose image…';
      iconBtn.style.cssText = 'background:#21262d;color:#fff;border:1px solid #30363d;padding:8px 16px;border-radius:6px;cursor:pointer;font-family:inherit;font-size:12px;font-weight:600;margin-right:8px;';
      iconRow.appendChild(iconBtn);

      const iconPreview = document.createElement('img');
      iconPreview.style.cssText = 'max-width:80px;max-height:60px;vertical-align:middle;border-radius:4px;display:none;';
      iconRow.appendChild(iconPreview);

      const iconIn = document.createElement('input');
      iconIn.type = 'file';
      iconIn.accept = 'image/png,image/jpeg,image/webp';
      iconIn.style.display = 'none';
      iconRow.appendChild(iconIn);

      let iconDataUrl = null;
      iconBtn.addEventListener('click', () => iconIn.click());
      iconIn.addEventListener('change', async () => {
        const f = iconIn.files && iconIn.files[0];
        if (!f) return;
        if (f.size > 300000) {
          alert('Icon too large (max 300KB)');
          iconIn.value = '';
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          iconDataUrl = reader.result;
          iconPreview.src = iconDataUrl;
          iconPreview.style.display = 'inline-block';
        };
        reader.readAsDataURL(f);
      });

      step2.appendChild(iconRow);
      panel.appendChild(step2);

      /* step 3: publish */
      const actions = document.createElement('div');
      actions.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;margin-top:18px;';

      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = 'Cancel';
      cancelBtn.style.cssText = 'background:#333;color:#fff;border:1px solid #555;padding:10px 20px;border-radius:6px;cursor:pointer;font-family:inherit;font-size:13px;font-weight:600;';
      cancelBtn.addEventListener('click', () => overlay.style.display = 'none');

      const publishBtn = document.createElement('button');
      publishBtn.textContent = '⬆ Publish';
      publishBtn.disabled = true;
      publishBtn.style.cssText = 'background:#238636;color:#fff;border:1px solid #2ea043;padding:10px 22px;border-radius:6px;cursor:pointer;font-family:inherit;font-size:13px;font-weight:700;opacity:0.5;';

      publishBtn.addEventListener('click', async () => {
        if (!parsedMeta || !ttmodText) return;
        const name = nameIn.value.trim();
        const author = authorIn.value.trim();
        if (!name)   { alert('Name required'); return; }
        if (!author) { alert('Author required'); return; }

        publishBtn.disabled = true;
        publishBtn.textContent = '⏳ Uploading…';
        try {
          await Store.publish({
            name, author,
            description: descIn.value.trim(),
            version: versionIn.value.trim() || '1.0.0',
            icon: iconDataUrl,
            ttmod: ttmodText,
            tags: parsedMeta.tags || []
          });
          publishBtn.textContent = '✅ Published!';
          status.textContent = '✅ Uploaded: ' + name;
          setTimeout(() => {
            overlay.style.display = 'none';
            loadAndRender(search.value);
          }, 700);
        } catch (e) {
          publishBtn.disabled = false;
          publishBtn.textContent = '⬆ Publish';
          alert('Upload failed: ' + e.message);
        }
      });

      actions.append(cancelBtn, publishBtn);
      panel.appendChild(actions);

      overlay.appendChild(panel);
      overlay.addEventListener('click', e => {
        if (e.target === overlay) overlay.style.display = 'none';
      });
      document.body.appendChild(overlay);

      return {
        open() {
          /* reset form */
          fileIn.value = '';
          iconIn.value = '';
          iconDataUrl = null;
          iconPreview.style.display = 'none';
          fileInfo.textContent = 'No file selected';
          fileInfo.style.color = '';
          parsedMeta = null;
          ttmodText = '';
          nameIn.value = '';
          authorIn.value = '';
          descIn.value = '';
          versionIn.value = '1.0.0';
          publishBtn.disabled = true;
          publishBtn.textContent = '⬆ Publish';
          publishBtn.style.opacity = '0.5';
          overlay.style.display = 'flex';
        }
      };
    }

    uploadBtn.addEventListener('click', () => {
      if (!uploadModal) uploadModal = buildUploadModal();
      uploadModal.open();
    });

    closeBtn.addEventListener('click', () => { root.style.display = 'none'; });
    reloadBtn.addEventListener('click', () => loadAndRender(search.value));
    search.addEventListener('input', debounce(() => loadAndRender(search.value), 250));

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && root.style.display === 'flex') root.style.display = 'none';
    });

    function debounce(fn, ms) {
      let t;
      return function (...args) { clearTimeout(t); t = setTimeout(() => fn.apply(this, args), ms); };
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
      card.style.cssText = 'background:#161b22;border:1px solid #30363d;border-radius:10px;overflow:hidden;display:flex;flex-direction:column;';
      if (m.icon) {
        const img = document.createElement('img');
        img.src = m.icon;
        img.style.cssText = 'width:100%;height:130px;object-fit:cover;background:#000;';
        card.appendChild(img);
      } else {
        const ph = document.createElement('div');
        ph.textContent = '📦';
        ph.style.cssText = 'width:100%;height:130px;display:flex;align-items:center;justify-content:center;background:#0d1117;font-size:44px;opacity:.4;';
        card.appendChild(ph);
      }
      const body = document.createElement('div');
      body.style.cssText = 'padding:12px 14px;display:flex;flex-direction:column;gap:6px;flex:1;';
      const name = document.createElement('div');
      name.textContent = m.name || 'Untitled';
      name.style.cssText = 'font-weight:700;font-size:15px;';
      const meta = document.createElement('div');
      meta.textContent = `v${m.version || '1.0.0'} · by ${m.author || 'Unknown'}`;
      meta.style.cssText = 'font-size:12px;opacity:.7;';
      const desc = document.createElement('div');
      desc.textContent = m.description || '';
      desc.style.cssText = 'font-size:12px;opacity:.85;flex:1;';
      const foot = document.createElement('div');
      foot.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:8px;margin-top:4px;';
      const dl = document.createElement('div');
      dl.textContent = `⬇ ${m.downloads || 0}`;
      dl.style.cssText = 'font-size:11px;opacity:.5;';
      const btn = document.createElement('button');
      btn.textContent = '⬇ Install';
      btn.style.cssText = 'background:#238636;color:#fff;border:1px solid #2ea043;padding:6px 14px;border-radius:6px;cursor:pointer;font-family:inherit;font-size:12px;font-weight:600;';
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        btn.textContent = 'Installing…';
        try {
          await Store.install(m);
          btn.textContent = '✅ Installed';
          btn.style.background = '#1a4a1a';
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
        if (firstOpen) { firstOpen = false; setTimeout(() => loadAndRender(), 0); }
      },
      hide() { root.style.display = 'none'; }
    };
  }

  global.ModStore = {
    open() { if (!modal) modal = buildModal(); modal.show(); },
    close() { if (modal) modal.hide(); },
    list:    () => Store.list(),
    search:  t  => Store.search(t),
    publish: o  => Store.publish(o),
    install: m  => Store.install(m)
  };

  log('📦 mod-store.js loaded — call ModStore.open()');
})(window);