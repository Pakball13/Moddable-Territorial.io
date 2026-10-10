/* ============================================================
 * ttmod-maker.js  —  visual editor for .ttmod bundles
 * Opened from the mod menu (🛠 Maker button)
 * ============================================================ */
(function (global) {
  'use strict';

  const PFX = '%c[TtmodMaker]';
  const STY = 'color:#fc9;font-weight:bold';
  const log = (...a) => console.log(PFX, STY, ...a);
  const err = (...a) => console.error(PFX, STY, ...a);

  let makerEl = null;
  let state = null;

  /* ---------- helpers ---------- */
  const el = (tag, css, text) => {
    const n = document.createElement(tag);
    if (css)  n.style.cssText = css;
    if (text !== undefined) n.textContent = text;
    return n;
  };
  const row = (label, hint) => {
    const wrap = el('div', 'display:flex;flex-direction:column;gap:4px;margin-bottom:10px;');
    const lab  = el('label', 'font-size:12px;font-weight:600;color:#cce;letter-spacing:.3px;', label);
    wrap.appendChild(lab);
    if (hint) wrap.appendChild(el('div', 'font-size:11px;color:#889;margin-top:-2px;', hint));
    return wrap;
  };
  const input = (placeholder, value) => {
    const i = el('input', 'width:100%;padding:8px 10px;background:#0d1117;color:#fff;border:1px solid #30363d;border-radius:6px;font-family:inherit;font-size:13px;box-sizing:border-box;');
    i.type = 'text';
    i.placeholder = placeholder || '';
    i.value = value || '';
    return i;
  };
  const checkbox = (labelText) => {
    const wrap = el('label', 'display:flex;align-items:center;gap:8px;padding:6px 0;font-size:13px;cursor:pointer;color:#cce;');
    const cb = el('input');
    cb.type = 'checkbox';
    cb.style.cssText = 'width:16px;height:16px;cursor:pointer;accent-color:#3fb950;';
    wrap.appendChild(cb);
    wrap.appendChild(el('span', '', labelText));
    wrap.__input = cb;
    return wrap;
  };
  const section = (title) => {
    const s = el('div', 'margin-bottom:20px;padding:16px 18px;background:#161b22;border:1px solid #30363d;border-radius:10px;');
    s.appendChild(el('div', 'font-size:14px;font-weight:700;color:#58a6ff;margin-bottom:12px;text-transform:uppercase;letter-spacing:.8px;', title));
    return s;
  };
  const select = (options, value) => {
    const s = el('select', 'width:100%;padding:8px 10px;background:#0d1117;color:#fff;border:1px solid #30363d;border-radius:6px;font-family:inherit;font-size:13px;cursor:pointer;');
    options.forEach(opt => {
      const o = el('option', '', opt);
      o.value = opt;
      if (opt === value) o.selected = true;
      s.appendChild(o);
    });
    return s;
  };
  const button = (label, kind, onClick) => {
    const colors = {
      primary: 'background:#238636;border-color:#2ea043;color:#fff;',
      danger:  'background:#6a2020;border-color:#8b2d2d;color:#fff;',
      ghost:   'background:transparent;border-color:#30363d;color:#c9d1d9;'
    };
    const b = el('button',
      'padding:9px 16px;border:1px solid #30363d;border-radius:6px;cursor:pointer;' +
      'font-family:inherit;font-size:13px;font-weight:600;transition:filter .12s;' +
      (colors[kind] || colors.ghost));
    b.textContent = label;
    b.addEventListener('mouseenter', () => b.style.filter = 'brightness(1.15)');
    b.addEventListener('mouseleave', () => b.style.filter = '');
    b.addEventListener('click', onClick);
    return b;
  };

  /* ---------- state ---------- */
  function freshState() {
    return {
      id: '', name: '', version: '1.0.0', author: '',
      description: '', gameVersion: 25,
      config: {},
      assets: {},
      userScript: ''
    };
  }

  /* ---------- UI ---------- */
  function build() {
    const root = el('div',
      'position:fixed;inset:0;background:rgba(0,0,0,.9);z-index:100001;' +
      'display:none;flex-direction:column;font-family:system-ui,sans-serif;color:#fff;' +
      'padding:0;box-sizing:border-box;');

    // ---- header ----
    const head = el('div',
      'display:flex;align-items:center;gap:12px;padding:14px 20px;' +
      'background:#0d1117;border-bottom:1px solid #30363d;flex:0 0 auto;');
    head.appendChild(el('div', 'font-size:18px;font-weight:700;letter-spacing:.3px;', '🛠 TTmod Maker'));
    head.appendChild(el('div', 'font-size:12px;color:#7d8590;flex:1;', 'Design a .ttmod bundle — no code required'));
    head.appendChild(button('📂 Import .ttmod', 'ghost', onImportExisting));
    head.appendChild(button('🆕 New', 'ghost', () => { state = freshState(); syncForm(); updatePreview(); }));
    head.appendChild(button('✕ Close', 'ghost', hide));
    root.appendChild(head);

    // ---- body: two columns ----
    const body = el('div',
      'flex:1;display:grid;grid-template-columns:1fr 1fr;overflow:hidden;');

    // ---- LEFT: form ----
    const left = el('div', 'overflow-y:auto;padding:20px 24px;');

    // ---- RIGHT: preview + actions ----
    const right = el('div',
      'display:flex;flex-direction:column;overflow:hidden;' +
      'border-left:1px solid #30363d;background:#0d1117;');
    const previewHead = el('div',
      'padding:14px 20px;border-bottom:1px solid #30363d;font-size:12px;' +
      'font-weight:600;text-transform:uppercase;letter-spacing:.8px;color:#7d8590;' +
      'display:flex;justify-content:space-between;align-items:center;');
    previewHead.appendChild(el('span', '', 'Live preview'));
    const copyBtn = button('📋 Copy', 'ghost', onCopy);
    const dlBtn   = button('⬇ Download .ttmod', 'primary', onDownload);
    previewHead.appendChild(copyBtn);
    right.appendChild(previewHead);
    const pre = el('pre',
      'flex:1;margin:0;padding:16px 20px;overflow:auto;' +
      'font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;line-height:1.55;' +
      'color:#c9d1d9;white-space:pre-wrap;word-break:break-word;');
    right.appendChild(pre);

    const footer = el('div',
      'padding:14px 20px;border-top:1px solid #30363d;display:flex;gap:10px;justify-content:flex-end;');
    footer.appendChild(dlBtn);
    right.appendChild(footer);

    body.appendChild(left);
    body.appendChild(right);
    root.appendChild(body);

    /* ---------- LEFT FORM ---------- */

    // ---- Basic info ----
    const basic = section('① Basic information');
    basic.appendChild(row('ID', 'Unique lowercase-dash identifier, e.g. cool-player-pack'));
    const idIn = input('my-cool-mod'); basic.appendChild(idIn);
    basic.appendChild(row('Name'));            const nameIn = input('My Cool Mod'); basic.appendChild(nameIn);
    basic.appendChild(row('Version'));         const verIn  = input('1.0.0'); basic.appendChild(verIn);
    basic.appendChild(row('Author'));          const authIn = input('YourName'); basic.appendChild(authIn);
    basic.appendChild(row('Description'));
    const descIn = input('A short sentence describing what this mod does.');
    basic.appendChild(descIn);
    left.appendChild(basic);

    // Auto-slug the id from the name
    nameIn.addEventListener('input', () => {
      if (!idIn.value || idIn.dataset.auto !== '0') {
        idIn.value = slug(nameIn.value);
        idIn.dataset.auto = '1';
      }
    });
    idIn.addEventListener('input', () => { idIn.dataset.auto = '0'; });

    // ---- Identity ----
    const ident = section('② Identity');
    const userNameRow = row('Kingdom name', 'Auto-fills the name input on the menu');
    const userNameIn = input('CoolPlayer'); userNameRow.appendChild(userNameIn);
    ident.appendChild(userNameRow);

    const userColorRow = row('Kingdom color', 'Hex, e.g. #00ff88');
    const userColorIn = input('#00ff88'); userColorRow.appendChild(userColorIn);
    ident.appendChild(userColorRow);

    const fontRow = row('Font', 'Any CSS font-family');
    const fontIn = input('Inter, system-ui'); fontRow.appendChild(fontIn);
    ident.appendChild(fontRow);

    const flagsRow = row('Flags', 'Emojis appended to the name, comma-separated');
    const flagsIn = input('🇵🇰, 🔥'); flagsRow.appendChild(flagsIn);
    ident.appendChild(flagsRow);

    left.appendChild(ident);

    // ---- Theme ----
    const theme = section('③ Theme');
    const accentRow = row('Accent color'); const accentIn = input('#00ff88'); accentRow.appendChild(accentIn);
    theme.appendChild(accentRow);
    const bgRow = row('Background color'); const bgIn = input('#0a0a1a'); bgRow.appendChild(bgIn);
    theme.appendChild(bgRow);
    left.appendChild(theme);

    // ---- Layout & UI toggles ----
    const layout = section('④ Layout & UI');
    const layoutRow = row('Default layout'); const layoutSel = select(['sidebar','grid','circles'], 'sidebar');
    layoutRow.appendChild(layoutSel); layout.appendChild(layoutRow);

    const hideMp   = checkbox('Hide Multiplayer button');   layout.appendChild(hideMp);
    const hideVer  = checkbox('Hide game version');         layout.appendChild(hideVer);
    const hideLogo = checkbox('Hide game logo');            layout.appendChild(hideLogo);
    const showFps  = checkbox('Show FPS counter');          layout.appendChild(showFps);
    const showClk  = checkbox('Show clock');                layout.appendChild(showClk);
    const confirm  = checkbox('Confirm before leaving a match'); layout.appendChild(confirm);
    const skipSp   = checkbox('Auto-skip splash screen');   layout.appendChild(skipSp);

    const layoutHint = el('div', 'font-size:11px;color:#7d8590;margin-top:6px;', 'Tip: you can also collapse the sidebar from the top bar.');
    layout.appendChild(layoutHint);
    left.appendChild(layout);

    // ---- Panorama / visuals ----
    const visuals = section('⑤ Panorama & visuals');
    const panoRow = row('Panorama image', 'PNG/JPG — will be embedded in the bundle');
    const panoIn = el('input',
      'width:100%;padding:8px;background:#0d1117;color:#fff;border:1px solid #30363d;' +
      'border-radius:6px;font-family:inherit;font-size:12px;');
    panoIn.type = 'file'; panoIn.accept = 'image/png,image/jpeg,image/webp';
    panoRow.appendChild(panoIn); visuals.appendChild(panoRow);

    const panoSpeedRow = row('Panorama speed', 'Lower = slower (default 0.00005)');
    const panoSpeedIn = input('0.00005'); panoSpeedRow.appendChild(panoSpeedIn);
    visuals.appendChild(panoSpeedRow);

    const watermarkRow = row('Watermark text', 'Shown in a corner of the menu');
    const watermarkIn = input('Made by <you>'); watermarkRow.appendChild(watermarkIn);
    visuals.appendChild(watermarkRow);

    const wmPosRow = row('Watermark position');
    const wmPosSel = select(['bottom-right','bottom-left','top-right','top-left'], 'bottom-right');
    wmPosRow.appendChild(wmPosSel); visuals.appendChild(wmPosRow);
    left.appendChild(visuals);

    // ---- Assets ----
    const assets = section('⑥ Assets');
    const iconRow = row('Icon', 'Small cover image shown in the mod menu');
    const iconIn = el('input',
      'width:100%;padding:8px;background:#0d1117;color:#fff;border:1px solid #30363d;' +
      'border-radius:6px;font-family:inherit;font-size:12px;');
    iconIn.type = 'file'; iconIn.accept = 'image/png,image/jpeg,image/webp,image/svg+xml';
    iconRow.appendChild(iconIn); assets.appendChild(iconRow);

    const musicRow = row('Background music', 'MP3 / OGG, loops while in the menu');
    const musicIn = el('input',
      'width:100%;padding:8px;background:#0d1117;color:#fff;border:1px solid #30363d;' +
      'border-radius:6px;font-family:inherit;font-size:12px;');
    musicIn.type = 'file'; musicIn.accept = 'audio/mpeg,audio/ogg,audio/wav';
    musicRow.appendChild(musicIn); assets.appendChild(musicRow);

    const musicVolRow = row('Music volume', '0.0 – 1.0');
    const musicVolIn = input('0.3'); musicVolRow.appendChild(musicVolIn);
    assets.appendChild(musicVolRow);
    left.appendChild(assets);

    // ---- Buttons ----
    const btnSec = section('⑦ Custom buttons');
    const btnHint = el('div', 'font-size:11px;color:#7d8590;margin-bottom:8px;',
      'Each line becomes a floating button. Format: Label | https://url  OR  Label | toast:Message');
    btnSec.appendChild(btnHint);
    const btnTextarea = el('textarea',
      'width:100%;height:80px;padding:8px 10px;background:#0d1117;color:#fff;' +
      'border:1px solid #30363d;border-radius:6px;font-family:ui-monospace,Menlo,Consolas,monospace;' +
      'font-size:12px;box-sizing:border-box;resize:vertical;');
    btnTextarea.placeholder = '💬 Discord | https://discord.gg/example\n🎨 Colors | toast:Look at my theme!';
    btnSec.appendChild(btnTextarea);
    left.appendChild(btnSec);

    // ---- Advanced script ----
    const script = section('⑧ Advanced · user script');
    const scriptHint = el('div', 'font-size:11px;color:#7d8590;margin-bottom:8px;',
      'Optional — anything you put here runs as real JavaScript with full api.* access.');
    script.appendChild(scriptHint);
    const scriptArea = el('textarea',
      'width:100%;height:180px;padding:12px;background:#0d1117;color:#c9d1d9;' +
      'border:1px solid #30363d;border-radius:6px;' +
      'font-family:ui-monospace,Menlo,Consolas,monospace;font-size:12px;line-height:1.55;' +
      'box-sizing:border-box;resize:vertical;');
    scriptArea.placeholder =
      '// Complex features go here.\n' +
      'api.log("My mod is running");\n' +
      'api.addButton("Hi", () => api.showToast("Hello!"));';
    script.appendChild(scriptArea);
    left.appendChild(script);

    // ---- wire up live preview ----
    const allInputs = [idIn, nameIn, verIn, authIn, descIn,
                       userNameIn, userColorIn, fontIn, flagsIn,
                       accentIn, bgIn, layoutSel,
                       hideMp.__input, hideVer.__input, hideLogo.__input,
                       showFps.__input, showClk.__input, confirm.__input, skipSp.__input,
                       panoSpeedIn, watermarkIn, wmPosSel,
                       musicVolIn, btnTextarea, scriptArea];

    allInputs.forEach(n => {
      n.addEventListener('input', updatePreview);
      n.addEventListener('change', updatePreview);
    });
    panoIn.addEventListener('change', () => onAssetPicked(panoIn, 'panorama.png'));
    iconIn.addEventListener('change', () => onAssetPicked(iconIn, 'icon.png'));
    musicIn.addEventListener('change', () => onAssetPicked(musicIn, 'music.mp3'));

    /* ---------- update state from form ---------- */
    function syncForm() {
      idIn.value = state.id;
      nameIn.value = state.name;
      verIn.value = state.version;
      authIn.value = state.author;
      descIn.value = state.description;
      const c = state.config || {};
      userNameIn.value = c.userName || '';
      userColorIn.value = c.userColor || '';
      fontIn.value = c.font || '';
      flagsIn.value = Array.isArray(c.flags) ? c.flags.join(', ') : '';
      accentIn.value = (c.theme && c.theme.accent) || '';
      bgIn.value = (c.theme && c.theme.background) || '';
      layoutSel.value = c.layout || 'sidebar';
      hideMp.__input.checked = !!c.hideMultiplayer;
      hideVer.__input.checked = !!c.hideVersion;
      hideLogo.__input.checked = !!c.hideLogo;
      showFps.__input.checked = !!c.showFps;
      showClk.__input.checked = !!c.showClock;
      confirm.__input.checked = !!c.confirmExit;
      skipSp.__input.checked = !!c.autoSkipSplash;
      panoSpeedIn.value = c.panoramaSpeed || '';
      watermarkIn.value = c.watermark || '';
      wmPosSel.value = c.watermarkPosition || 'bottom-right';
      musicVolIn.value = c.musicVolume != null ? c.musicVolume : '';
      btnTextarea.value = (c.buttons || []).map(b => {
        if (b.url)   return `${b.label} | ${b.url}`;
        if (b.toast) return `${b.label} | toast:${b.toast}`;
        return `${b.label} | ${b.action || ''}`;
      }).join('\n');
      scriptArea.value = state.userScript || '';
    }

    /* ---------- build state from form ---------- */
    function readForm() {
      const cfg = {};
      const t = v => (v || '').trim();

      if (t(userNameIn.value))   cfg.userName  = t(userNameIn.value);
      if (t(userColorIn.value))  cfg.userColor = t(userColorIn.value);
      if (t(fontIn.value))       cfg.font      = t(fontIn.value);
      if (t(flagsIn.value)) {
        cfg.flags = flagsIn.value.split(',').map(s => s.trim()).filter(Boolean);
      }
      const theme = {};
      if (t(accentIn.value)) theme.accent = t(accentIn.value);
      if (t(bgIn.value))     theme.background = t(bgIn.value);
      if (Object.keys(theme).length) cfg.theme = theme;

      if (layoutSel.value && layoutSel.value !== 'sidebar') cfg.layout = layoutSel.value;
      if (hideMp.__input.checked)   cfg.hideMultiplayer = true;
      if (hideVer.__input.checked)  cfg.hideVersion     = true;
      if (hideLogo.__input.checked) cfg.hideLogo        = true;
      if (showFps.__input.checked)  cfg.showFps         = true;
      if (showClk.__input.checked)  cfg.showClock       = true;
      if (confirm.__input.checked)  cfg.confirmExit     = true;
      if (skipSp.__input.checked)   cfg.autoSkipSplash  = true;

      if (t(panoSpeedIn.value)) cfg.panoramaSpeed = Number(panoSpeedIn.value) || undefined;
      if (t(watermarkIn.value)) {
        cfg.watermark         = t(watermarkIn.value);
        cfg.watermarkPosition = wmPosSel.value;
      }
      if (t(musicVolIn.value)) cfg.musicVolume = Math.max(0, Math.min(1, Number(musicVolIn.value)));

      const btns = [];
      btnTextarea.value.split('\n').forEach(line => {
        const [lab, target] = line.split('|').map(s => (s || '').trim());
        if (!lab) return;
        if (!target)            btns.push({ label: lab, toast: lab });
        else if (target.startsWith('toast:')) btns.push({ label: lab, toast: target.slice(6) });
        else                    btns.push({ label: lab, url: target });
      });
      if (btns.length) cfg.buttons = btns;

      return {
        id:          t(idIn.value) || 'my-mod',
        name:        t(nameIn.value) || 'My Mod',
        version:     t(verIn.value) || '1.0.0',
        author:      t(authIn.value) || 'Unknown',
        description: t(descIn.value) || '',
        gameVersion: 25,
        config:      cfg,
        assets:      state.assets || {},
        userScript:  scriptArea.value || ''
      };
    }

    /* ---------- preview ---------- */
    function updatePreview() {
      const s = readForm();
      // Save back so form state is preserved if the maker closes
      state = s;
      const meta = {
        id: s.id, name: s.name, version: s.version, author: s.author,
        description: s.description, gameVersion: s.gameVersion,
        config: s.config
      };
      const assetKeys = Object.keys(s.assets);
      if (assetKeys.length) {
        meta.assets = {};
        assetKeys.forEach(k => {
          meta.assets[k] = s.assets[k].slice(0, 60) + '… (' + Math.round(s.assets[k].length / 1024) + ' KB)';
        });
      }
      const preview =
        '<ttmod>\n' + JSON.stringify(meta, null, 2) + '\n</ttmod>\n' +
        '<script>\n' + (s.userScript || '/* (no user script) */') + '\n</script>\n';
      pre.textContent = preview;
    }

    /* ---------- asset file loading ---------- */
    async function onAssetPicked(fileInput, suggestedName) {
      const f = fileInput.files && fileInput.files[0];
      if (!f) return;
      if (f.size > 3 * 1024 * 1024) {
        alert('Asset too big (max 3 MB per file)');
        fileInput.value = '';
        return;
      }
      const dataUrl = await fileToDataURL(f);
      state.assets = state.assets || {};
      state.assets[suggestedName] = dataUrl;
      updatePreview();
    }

    /* ---------- download ---------- */
    function onDownload() {
      const s = readForm();
      const meta = {
        id: s.id, name: s.name, version: s.version, author: s.author,
        description: s.description, gameVersion: s.gameVersion,
        config: s.config
      };
      if (Object.keys(s.assets).length) meta.assets = s.assets;

      const text =
        '<ttmod>\n' + JSON.stringify(meta, null, 2) + '\n</ttmod>\n' +
        '<script>\n' + (s.userScript || '') + '\n</script>\n';

      const blob = new Blob([text], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = (s.id || 'my-mod') + '.ttmod';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      if (global.TerritorialMods) {
        global.TerritorialMods.showToast('📦 Downloaded ' + a.download);
      }
    }

    /* ---------- copy ---------- */
    async function onCopy() {
      try {
        await navigator.clipboard.writeText(pre.textContent);
        if (global.TerritorialMods) global.TerritorialMods.showToast('📋 Copied to clipboard');
      } catch {
        alert('Clipboard blocked by browser');
      }
    }

    /* ---------- import existing .ttmod into the editor ---------- */
    function onImportExisting() {
      const inp = document.createElement('input');
      inp.type = 'file';
      inp.accept = '.ttmod,text/plain,application/octet-stream';
      inp.addEventListener('change', async () => {
        const f = inp.files && inp.files[0];
        if (!f) return;
        const text = await f.text();
        try {
          const tm = text.match(/<ttmod[^>]*>([\s\S]*?)<\/ttmod>/i);
          if (!tm) throw new Error('Missing <ttmod> block');
          const meta = JSON.parse(tm[1]);
          const sm = text.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
          state = {
            id:          meta.id || 'imported',
            name:        meta.name || meta.id,
            version:     meta.version || '1.0.0',
            author:      meta.author || '',
            description: meta.description || '',
            gameVersion: meta.gameVersion || 25,
            config:      meta.config || {},
            assets:      meta.assets || {},
            userScript:  sm ? sm[1].trim() : ''
          };
          syncForm();
          updatePreview();
          if (global.TerritorialMods) global.TerritorialMods.showToast('📂 Imported into editor');
        } catch (e) {
          alert('Could not parse .ttmod: ' + e.message);
        }
      });
      inp.click();
    }

    /* ---------- api ---------- */
    function show() {
      if (!state) { state = freshState(); syncForm(); updatePreview(); }
      root.style.display = 'flex';
    }
    function hide() {
      root.style.display = 'none';
    }

    return { root, show, hide, syncForm, updatePreview };
  }

  /* ---------- slug helper ---------- */
  function slug(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40);
  }

  /* ---------- public ---------- */
  global.TtmodMaker = {
    open() {
      if (!makerEl) { state = freshState(); makerEl = build(); document.body.appendChild(makerEl.root); }
      makerEl.show();
    },
    close() { if (makerEl) makerEl.hide(); }
  };

  log('🛠 ttmod-maker.js ready — call TtmodMaker.open()');
})(window);