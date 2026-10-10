/* ============================================================
 * client-features.js — v2.0.3 — Modatorial.io
 * Chrome bar, themes, audio, achievements, speedrun, accounts.
 * Sign-in button now redirects to /login.html (much more reliable
 * than the in-game modal).
 * ============================================================ */
(function (global) {
  'use strict';

  const VERSION = '2.0.3';
  const MAX_ACCOUNTS = 3;

  const KEYS = {
    theme: 'tt-theme', layout: 'tt-layout', audio: 'tt-audio',
    achievements: 'tt-achievements', speedrunPB: 'tt-speedrun-pb',
    matchHistory: 'tt-match-history', stats: 'tt-profile-stats',
    accounts: 'tt-accounts', chromeHidden: 'tt-chrome-hidden',
    sidebarCollapsed: 'tt-sidebar-collapsed', seenIntro: 'tt-seen-intro'
  };

  const THEMES = [
    { id:'midnight',   label:'Midnight',   icon:'🌙', vars:{accent:'#3fb950',background:'#0a0c10',text:'#e6edf3',surface:'#16181d'} },
    { id:'forest',     label:'Forest',     icon:'🌲', vars:{accent:'#8bc34a',background:'#0d1f0d',text:'#e8f5e9',surface:'#1a2a1a'} },
    { id:'cyberpunk',  label:'Cyberpunk',  icon:'🌆', vars:{accent:'#00ffff',background:'#0a0014',text:'#f0f0ff',surface:'#1a0a2e'} },
    { id:'mono',       label:'Monochrome', icon:'◼️', vars:{accent:'#dddddd',background:'#000000',text:'#ffffff',surface:'#1a1a1a'} },
    { id:'sunset',     label:'Sunset',     icon:'🌅', vars:{accent:'#ff8844',background:'#1a0a1e',text:'#ffe8d6',surface:'#2a1028'} },
    { id:'ocean',      label:'Ocean',      icon:'🌊', vars:{accent:'#4dd0e1',background:'#0a1929',text:'#e0f7fa',surface:'#152b40'} },
    { id:'modatorial', label:'Modatorial', icon:'⬢',  vars:{accent:'#00F5D4',background:'#0F172A',text:'#e6edf3',surface:'#1E293B'} }
  ];

  const ACHIEVEMENTS = [
    { id:'first-launch',   icon:'🚀', name:'First Steps',     desc:'Launch Modatorial.io for the first time.' },
    { id:'mod-enthusiast', icon:'🧩', name:'Mod Enthusiast',  desc:'Install 3 mods.' },
    { id:'mod-addict',     icon:'🔥', name:'Mod Addict',      desc:'Install 10 mods.' },
    { id:'designer',       icon:'🎨', name:'Designer',        desc:'Change your theme.' },
    { id:'photographer',   icon:'📸', name:'Photographer',    desc:'Take your first screenshot.' },
    { id:'speedrunner',    icon:'⏱️', name:'Speedrunner',     desc:'Complete a match under 2 minutes.' },
    { id:'centurion',      icon:'💯', name:'Centurion',       desc:'Play 100 matches.' },
    { id:'level-5',        icon:'⭐', name:'Rising Star',     desc:'Reach level 5.' },
    { id:'level-10',       icon:'🌟', name:'Veteran',         desc:'Reach level 10.' },
    { id:'publisher',      icon:'📦', name:'Publisher',       desc:'Publish your first mod.' },
    { id:'collector',      icon:'🏆', name:'Collector',       desc:'Unlock 5 achievements.' },
    { id:'completionist',  icon:'👑', name:'Completionist',   desc:'Unlock every achievement.' }
  ];

  const log  = (...a) => console.log  ('%c[Features]', 'color:#3fb950;font-weight:bold', ...a);
  const warn = (...a) => console.warn ('%c[Features]', 'color:#f0883e;font-weight:bold', ...a);
  const err  = (...a) => console.error('%c[Features]', 'color:#f85149;font-weight:bold', ...a);

  /* ── Defensive helpers ─────────────────────────────── */
  function toArray(v) {
    if (Array.isArray(v)) return v;
    if (v && typeof v === 'object') return Object.values(v);
    return [];
  }
  function toObject(v, fallback) {
    if (v && typeof v === 'object' && !Array.isArray(v)) return v;
    return fallback || {};
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
      ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
  }

  /* ── Storage ────────────────────────────────────────── */
  const store = {
    get(k, fb) {
      try {
        const v = localStorage.getItem(k);
        if (v === null) return fb;
        try { return JSON.parse(v); } catch { return v; }
      } catch { return fb; }
    },
    set(k, v) {
      try { localStorage.setItem(k, typeof v === 'string' ? v : JSON.stringify(v)); } catch {}
    },
    del(k) { try { localStorage.removeItem(k); } catch {} }
  };

  /* ── Toast ──────────────────────────────────────────── */
  function Toast(msg, ms) {
    ms = ms || 3000;
    const el = document.createElement('div');
    el.textContent = msg;
    Object.assign(el.style, {
      position:'fixed', left:'50%', bottom:'80px', transform:'translateX(-50%)',
      background:'rgba(0,0,0,.9)', color:'#fff', padding:'10px 20px',
      borderRadius:'8px', font:'500 13px system-ui', zIndex: 999999,
      pointerEvents:'none', transition:'opacity .3s',
      boxShadow:'0 4px 20px rgba(0,0,0,.5)'
    });
    document.body.appendChild(el);
    setTimeout(() => { el.style.opacity = '0';
                       setTimeout(() => el.remove(), 300); }, ms);
  }

  /* ── Theme ──────────────────────────────────────────── */
  const Theme = {
    current: (() => {
      const v = store.get(KEYS.theme, 'modatorial');
      return typeof v === 'string' ? v : 'modatorial';
    })(),
    apply(id) {
      const t = THEMES.find(x => x.id === id) || THEMES[0];
      this.current = t.id;
      store.set(KEYS.theme, t.id);
      const r = document.documentElement;
      r.style.setProperty('--accent', t.vars.accent);
      r.style.setProperty('--background', t.vars.background);
      r.style.setProperty('--text', t.vars.text);
      r.style.setProperty('--surface', t.vars.surface);
    },
    cycle() {
      const i = THEMES.findIndex(x => x.id === this.current);
      const n = THEMES[(i + 1) % THEMES.length];
      this.apply(n.id);
      Achievements.unlock('designer');
      Toast('🎨 ' + n.icon + ' ' + n.label);
    }
  };

  /* ── Audio ──────────────────────────────────────────── */
  const Audio_ = (() => {
    const saved = toObject(store.get(KEYS.audio, {}), {});
    return {
      ctx: null,
      muted: !!saved.muted,
      volume: typeof saved.volume === 'number' ? saved.volume : 0.7,
      ensure() {
        if (this.ctx) return this.ctx;
        try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch {}
        return this.ctx;
      },
      play(name, freq, dur, type) {
        if (this.muted) return;
        const ctx = this.ensure(); if (!ctx) return;
        if (ctx.state === 'suspended') { try { ctx.resume(); } catch {} }
        try {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = type || 'sine';
          osc.frequency.value = freq || 440;
          gain.gain.value = this.volume * 0.15;
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (dur || 0.08));
          osc.connect(gain).connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + (dur || 0.08));
        } catch {}
      },
      save() { store.set(KEYS.audio, { volume: this.volume, muted: this.muted }); },
      toggleMute() { this.muted = !this.muted; this.save(); return this.muted; }
    };
  })();

  ['click','keydown','touchstart'].forEach(evt => {
    window.addEventListener(evt, () => {
      Audio_.ensure();
      try { if (Audio_.ctx && Audio_.ctx.state === 'suspended') Audio_.ctx.resume(); } catch {}
    }, { once: true });
  });

  /* ── Achievements ──────────────────────────────────── */
  const Achievements = {
    unlocked: new Set(toArray(store.get(KEYS.achievements)).filter(x => typeof x === 'string')),
    unlock(id) {
      if (this.unlocked.has(id)) return false;
      const a = ACHIEVEMENTS.find(x => x.id === id);
      if (!a) return false;
      this.unlocked.add(id);
      store.set(KEYS.achievements, [...this.unlocked]);
      Toast('🏆 ' + a.icon + ' ' + a.name);
      Audio_.play('unlock', 880, 0.12);
      if (this.unlocked.size >= 5) this.unlock('collector');
      if (this.unlocked.size >= ACHIEVEMENTS.length - 1) this.unlock('completionist');
      return true;
    },
    has(id) { return this.unlocked.has(id); },
    count() { return this.unlocked.size; },
    total() { return ACHIEVEMENTS.length; }
  };

  /* ── Speedrun ──────────────────────────────────────── */
  const Speedrun = {
    running: false, startTime: 0, elapsed: 0, intervalId: null,
    pb: store.get(KEYS.speedrunPB, null), overlay: null,
    start() {
      if (this.running) return;
      this.running = true;
      this.startTime = performance.now();
      this.elapsed = 0;
      this._ensureOverlay();
      this.intervalId = setInterval(() => this._tick(), 33);
      this.overlay.style.display = 'block';
    },
    stop() {
      if (!this.running) return;
      this.running = false;
      clearInterval(this.intervalId);
      const t = this.elapsed;
      if (!this.pb || t < this.pb) {
        this.pb = t; store.set(KEYS.speedrunPB, t);
        Toast('⏱️ New PB: ' + this._fmt(t));
      } else Toast('⏱️ ' + this._fmt(t) + ' (PB: ' + this._fmt(this.pb) + ')');
      if (t < 120000) Achievements.unlock('speedrunner');
      if (this.overlay) this.overlay.style.display = 'none';
    },
    _tick() {
      this.elapsed = performance.now() - this.startTime;
      if (this.overlay) this.overlay.textContent = this._fmt(this.elapsed);
    },
    _fmt(ms) {
      const s = Math.floor(ms / 1000);
      const m = Math.floor(s / 60);
      const cs = Math.floor((ms % 1000) / 10);
      return String(m).padStart(2,'0') + ':' +
             String(s % 60).padStart(2,'0') + '.' +
             String(cs).padStart(2,'0');
    },
    _ensureOverlay() {
      if (this.overlay) return;
      this.overlay = document.createElement('div');
      Object.assign(this.overlay.style, {
        position:'fixed', top:'70px', left:'50%', transform:'translateX(-50%)',
        zIndex: 99997, background:'rgba(0,0,0,.85)', color:'#3fb950',
        padding:'10px 24px', borderRadius:'10px',
        font:'700 24px "SF Mono",Menlo,monospace', letterSpacing:'2px',
        display:'none', border:'1px solid #3fb950', pointerEvents:'none'
      });
      this.overlay.textContent = '00:00.00';
      document.body.appendChild(this.overlay);
    }
  };

  /* ── Screenshot ────────────────────────────────────── */
  function Screenshot() {
    const canvas = document.getElementById('canvasA') ||
                   document.querySelector('canvas');
    if (!canvas) return Toast('❌ No canvas found');
    try {
      canvas.toBlob(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const ts = new Date().toISOString().replace(/[:.]/g, '-');
        a.href = url;
        a.download = 'modatorial-' + ts + '.png';
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        Achievements.unlock('photographer');
        Toast('📸 Screenshot saved');
        Audio_.play('success', 660, 0.15);
      });
    } catch (e) {
      Toast('❌ Screenshot failed: ' + e.message);
    }
  }

  /* ── Stats ─────────────────────────────────────────── */
  const Stats = {
    data: (() => {
      const d = toObject(store.get(KEYS.stats, {}), {});
      return {
        games:  typeof d.games === 'number' ? d.games : 0,
        wins:   typeof d.wins  === 'number' ? d.wins  : 0,
        xp:     typeof d.xp    === 'number' ? d.xp    : 0,
        level:  typeof d.level === 'number' ? d.level : 0
      };
    })(),
    record(result, duration, xpEarned) {
      this.data.games++;
      if (result === 'win') this.data.wins++;
      this.data.xp += xpEarned;
      const nl = Math.floor(Math.sqrt(this.data.xp / 50));
      if (nl > this.data.level) {
        this.data.level = nl;
        Toast('🎉 Level ' + nl + '!');
        if (nl >= 5)  Achievements.unlock('level-5');
        if (nl >= 10) Achievements.unlock('level-10');
      }
      if (this.data.games >= 100) Achievements.unlock('centurion');
      store.set(KEYS.stats, this.data);
    }
  };

  /* ── Accounts ──────────────────────────────────────── */
  const Accounts = {
    list() {
      try {
        const raw = localStorage.getItem(KEYS.accounts);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter(a => a && typeof a === 'object' && a.uid);
      } catch { return []; }
    },
    save(list) {
      try {
        const safe = toArray(list).slice(0, MAX_ACCOUNTS);
        localStorage.setItem(KEYS.accounts, JSON.stringify(safe));
      } catch {}
      emitChange();
    },
    current() {
      try { return global.Auth && global.Auth.current ? global.Auth.current() : null; }
      catch { return null; }
    },
    remember(user) {
      if (!user || !user.uid) return;
      const list = this.list().filter(a => a.uid !== user.uid);
      list.unshift({
        uid: user.uid,
        email: user.email || '',
        displayName: user.displayName || user.username || user.email || 'User',
        username: user.username || '',
        photoURL: user.photoURL || null,
        lastUsed: Date.now()
      });
      this.save(list);
    },
    forget(uid) { this.save(this.list().filter(a => a.uid !== uid)); },
    isCurrent(uid) {
      const c = this.current();
      return c && c.uid === uid;
    },
    hasRoom() { return this.list().length < MAX_ACCOUNTS; },

    /* Switch: sign out and redirect to login for the target email */
    async switchTo(uid) {
      const target = this.list().find(a => a.uid === uid);
      if (!target) return Toast('❌ Account not found');
      if (this.isCurrent(uid)) return Toast('Already signed in');
      if (!global.Auth) return Toast('❌ Auth not available');
      try {
        if (this.current()) await global.Auth.logout();
        // Store hint so login page can prefill the email
        sessionStorage.setItem('tt-login-hint', target.email);
        location.href = 'login.html?next=' + encodeURIComponent(location.pathname);
      } catch (e) {
        Toast('❌ ' + e.message);
      }
    },

    /* Add: sign out, go to signup page */
    async add() {
      if (!this.hasRoom()) return Toast('Maximum ' + MAX_ACCOUNTS + ' accounts');
      if (!global.Auth) return Toast('❌ Auth not available');
      if (this.current()) {
        if (!confirm('Adding an account will sign you out. Continue?')) return;
        await global.Auth.logout();
      }
      location.href = 'signup.html?next=' + encodeURIComponent(location.pathname);
    },

    _listeners: new Set(),
    onChange(fn) { this._listeners.add(fn); return () => this._listeners.delete(fn); }
  };

  function emitChange() {
    for (const fn of Accounts._listeners) {
      try { fn(Accounts.list()); } catch (e) { warn(e); }
    }
  }

  /* ── My Account Modal ──────────────────────────────── */
  let accountModal = null;

  function openAccountModal() {
    if (accountModal) {
      accountModal.style.display = 'flex';
      refreshAccountModal();
      return;
    }

    accountModal = document.createElement('div');
    accountModal.id = 'tt-account-modal';
    Object.assign(accountModal.style, {
      position:'fixed', inset:0, zIndex: 250000,
      background:'rgba(0,0,0,.85)', backdropFilter:'blur(8px)',
      display:'flex', alignItems:'center', justifyContent:'center'
    });

    accountModal.innerHTML =
      '<div style="width:min(560px,92vw);max-height:88vh;' +
      'background:#16181d;border:1px solid #262a31;border-radius:14px;' +
      'color:#e6edf3;font-family:system-ui;display:flex;' +
      'flex-direction:column;overflow:hidden;box-sizing:border-box;' +
      'box-shadow:0 20px 60px rgba(0,0,0,.6)">' +
        '<div style="display:flex;justify-content:space-between;' +
        'align-items:center;padding:18px 24px;border-bottom:1px solid #262a31">' +
          '<h2 style="margin:0;font-size:18px">👤 My Account</h2>' +
          '<button id="tt-acct-close" style="background:transparent;color:#8b949e;' +
          'border:0;font:600 20px system-ui;cursor:pointer">✕</button>' +
        '</div>' +
        '<div id="tt-acct-body" style="padding:20px 24px;overflow-y:auto;flex:1"></div>' +
      '</div>';
    document.body.appendChild(accountModal);

    accountModal.querySelector('#tt-acct-close').onclick = () =>
      accountModal.style.display = 'none';
    accountModal.addEventListener('click', e => {
      if (e.target === accountModal) accountModal.style.display = 'none';
    });

    refreshAccountModal();
    Accounts.onChange(refreshAccountModal);
    if (global.Auth && global.Auth.onChange) global.Auth.onChange(refreshAccountModal);
  }

  function refreshAccountModal() {
    if (!accountModal) return;
    const body = accountModal.querySelector('#tt-acct-body');
    if (!body) return;

    const user = Accounts.current();
    const list = Accounts.list();
    const displayList = [...list];
    if (user && !displayList.find(a => a.uid === user.uid)) {
      displayList.unshift({
        uid: user.uid, email: user.email || '',
        displayName: user.displayName || user.email || 'You',
        username: user.username || '',
        photoURL: user.photoURL || null, lastUsed: Date.now()
      });
    }

    body.innerHTML =
      (user ? renderCurrentUserCard(user) : renderSignedOutCard()) +
      '<h3 style="margin:24px 0 10px;font-size:13px;color:#8b949e;' +
      'text-transform:uppercase;letter-spacing:.6px">' +
        'Saved accounts (' + displayList.length + '/' + MAX_ACCOUNTS + ')</h3>' +
      '<div>' + displayList.map(renderAccountRow).join('') + '</div>' +
      (Accounts.hasRoom()
        ? '<button id="tt-acct-add" style="width:100%;margin-top:12px;' +
          'padding:12px;background:transparent;color:#3fb950;' +
          'border:1px dashed #3fb950;border-radius:8px;' +
          'font:600 13px system-ui;cursor:pointer">+ Add another account</button>'
        : '<div style="text-align:center;color:#6e7681;font-size:11px;' +
          'margin-top:12px;font-style:italic">' +
          'Account limit reached (' + MAX_ACCOUNTS + ' max).</div>') +
      (user
        ? '<button id="tt-acct-logout" style="width:100%;margin-top:16px;' +
          'padding:12px;background:#8b2626;color:#fff;border:0;' +
          'border-radius:8px;font:600 13px system-ui;cursor:pointer">' +
          'Sign out of ' + escapeHtml(user.displayName || user.email) + '</button>'
        : '');

    const addBtn = body.querySelector('#tt-acct-add');
    if (addBtn) addBtn.onclick = () => Accounts.add();

    const logoutBtn = body.querySelector('#tt-acct-logout');
    if (logoutBtn) logoutBtn.onclick = async () => {
      if (confirm('Sign out?')) {
        if (global.Auth && global.Auth.logout) await global.Auth.logout();
        refreshAccountModal();
      }
    };

    const signInBtn = body.querySelector('#tt-acct-signin');
    if (signInBtn) signInBtn.onclick = () => {
      location.href = 'login.html?next=' + encodeURIComponent(location.pathname);
    };

    body.querySelectorAll('[data-switch]').forEach(b => {
      b.onclick = () => Accounts.switchTo(b.dataset.switch);
    });
    body.querySelectorAll('[data-remove]').forEach(b => {
      b.onclick = () => {
        const uid = b.dataset.remove;
        if (Accounts.isCurrent(uid)) return Toast('❌ Sign out first');
        if (!confirm('Remove this account from the list?\n' +
                     '(The Firebase account itself is not deleted)')) return;
        Accounts.forget(uid);
      };
    });

    const editBtn = body.querySelector('#tt-acct-edit');
    if (editBtn) editBtn.onclick = openProfileEditor;
  }

  function renderCurrentUserCard(user) {
    const initial = ((user.displayName || user.email || '?')[0] || '?').toUpperCase();
    return '<div style="display:flex;gap:16px;align-items:center;' +
      'padding:16px;background:#0d1117;border-radius:10px;' +
      'border:1px solid #262a31">' +
        '<div style="width:64px;height:64px;border-radius:50%;' +
        'background:linear-gradient(135deg,#238636,#3fb950);' +
        'display:flex;align-items:center;justify-content:center;' +
        'font:700 24px system-ui;color:#fff;flex-shrink:0">' +
          escapeHtml(initial) +
        '</div>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font:700 16px system-ui;margin-bottom:2px">' +
            escapeHtml(user.displayName || 'Unnamed') +
            '<span style="font-size:11px;color:#3fb950;margin-left:6px">● active</span>' +
          '</div>' +
          '<div style="font:400 12px system-ui;color:#8b949e;' +
          'white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' +
            escapeHtml(user.email || '') + '</div>' +
          (user.username ? '<div style="font:400 12px system-ui;color:#8b949e">' +
            '@' + escapeHtml(user.username) + '</div>' : '') +
          (user.phone ? '<div style="font:400 12px system-ui;color:#8b949e">' +
            '📞 ' + escapeHtml(user.phone) + '</div>' : '') +
        '</div>' +
        '<button id="tt-acct-edit" style="padding:8px 14px;background:transparent;' +
        'color:#3fb950;border:1px solid #3fb950;border-radius:8px;' +
        'font:600 12px system-ui;cursor:pointer">Edit profile</button>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;' +
      'gap:8px;margin-top:12px">' +
        statBox('Games', Stats.data.games) +
        statBox('Wins', Stats.data.wins) +
        statBox('Level', Stats.data.level) +
      '</div>' +
      '<div style="margin-top:16px">' +
        '<div style="font:600 11px system-ui;color:#8b949e;' +
        'text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px">' +
          '🏆 Achievements (' + Achievements.count() + '/' + Achievements.total() + ')</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:6px">' +
          ACHIEVEMENTS.map(a => {
            const has = Achievements.has(a.id);
            return '<span title="' + escapeHtml(a.name + ': ' + a.desc) + '" ' +
              'style="font-size:18px;padding:4px 8px;border-radius:6px;' +
              'background:' + (has ? '#1a2a1a' : '#0d1117') + ';' +
              'opacity:' + (has ? 1 : 0.35) + ';' +
              'filter:' + (has ? 'none' : 'grayscale(1)') + '">' +
              a.icon + '</span>';
          }).join('') +
        '</div>' +
      '</div>';
  }

  function statBox(label, value) {
    return '<div style="padding:12px;background:#0d1117;border-radius:8px;text-align:center">' +
      '<div style="font:700 20px system-ui;color:#3fb950">' + value + '</div>' +
      '<div style="font:400 11px system-ui;color:#8b949e;margin-top:2px">' +
        escapeHtml(label) + '</div></div>';
  }

  function renderSignedOutCard() {
    return '<div style="text-align:center;padding:32px 16px;' +
      'background:#0d1117;border-radius:10px;border:1px dashed #30363d">' +
        '<div style="font-size:48px;margin-bottom:12px">👤</div>' +
        '<div style="font:600 15px system-ui;margin-bottom:4px">' +
          'You&#39;re not signed in</div>' +
        '<div style="font:400 12px system-ui;color:#8b949e;margin-bottom:16px">' +
          'Sign in to publish mods and save your progress.</div>' +
        '<button id="tt-acct-signin" style="padding:10px 24px;background:#238636;' +
        'color:#fff;border:0;border-radius:8px;font:600 13px system-ui;' +
        'cursor:pointer">Sign in / Create account</button>' +
      '</div>';
  }

  function renderAccountRow(a) {
    const isCurrent = Accounts.isCurrent(a.uid);
    const initial = ((a.displayName || a.email || '?')[0] || '?').toUpperCase();
    return '<div style="display:flex;gap:12px;align-items:center;padding:12px;' +
      'background:' + (isCurrent ? '#1a2a1a' : '#0d1117') + ';' +
      'border-radius:8px;margin-bottom:8px;' +
      'border:1px solid ' + (isCurrent ? '#3fb950' : '#262a31') + '">' +
        '<div style="width:40px;height:40px;border-radius:50%;' +
        'background:linear-gradient(135deg,#238636,#3fb950);' +
        'display:flex;align-items:center;justify-content:center;' +
        'font:700 16px system-ui;color:#fff;flex-shrink:0">' +
          escapeHtml(initial) +
        '</div>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font:600 13px system-ui;white-space:nowrap;' +
          'overflow:hidden;text-overflow:ellipsis">' +
            escapeHtml(a.displayName || 'Unnamed') +
            (isCurrent ? '<span style="color:#3fb950;font-size:10px"> · active</span>' : '') +
          '</div>' +
          '<div style="font:400 11px system-ui;color:#8b949e;white-space:nowrap;' +
          'overflow:hidden;text-overflow:ellipsis">' +
            escapeHtml(a.email || '') + '</div>' +
        '</div>' +
        (!isCurrent
          ? '<button data-switch="' + a.uid + '" ' +
            'style="padding:6px 12px;background:transparent;color:#3fb950;' +
            'border:1px solid #3fb950;border-radius:6px;' +
            'font:600 11px system-ui;cursor:pointer">Switch</button>' +
            '<button data-remove="' + a.uid + '" title="Remove from list" ' +
            'style="padding:6px 10px;background:transparent;color:#8b949e;' +
            'border:1px solid #30363d;border-radius:6px;' +
            'font:600 11px system-ui;cursor:pointer">✕</button>'
          : '') +
      '</div>';
  }

  function openProfileEditor() {
    const user = Accounts.current();
    if (!user) return Toast('❌ Not signed in');

    const overlay = document.createElement('div');
    Object.assign(overlay.style, {
      position:'fixed', inset:0, zIndex: 260000,
      background:'rgba(0,0,0,.85)', backdropFilter:'blur(6px)',
      display:'flex', alignItems:'center', justifyContent:'center'
    });
    overlay.innerHTML =
      '<div style="width:min(420px,92vw);background:#16181d;' +
      'border:1px solid #262a31;border-radius:14px;color:#e6edf3;' +
      'font-family:system-ui;padding:24px;box-sizing:border-box">' +
        '<h3 style="margin:0 0 16px;font-size:16px">Edit profile</h3>' +
        '<label style="display:block;font:600 11px system-ui;color:#8b949e;' +
        'margin-bottom:4px">Display name</label>' +
        '<input id="tt-pe-name" type="text" value="' +
        escapeHtml(user.displayName || '') + '" ' +
        'style="width:100%;box-sizing:border-box;padding:10px 12px;' +
        'border-radius:8px;border:1px solid #30363d;background:#0d1117;' +
        'color:#e6edf3;font:400 13px system-ui;margin-bottom:12px" />' +
        '<label style="display:block;font:600 11px system-ui;color:#8b949e;' +
        'margin-bottom:4px">Phone number</label>' +
        '<input id="tt-pe-phone" type="tel" value="' + escapeHtml(user.phone || '') +
        '" placeholder="+1 555 000 0000" ' +
        'style="width:100%;box-sizing:border-box;padding:10px 12px;' +
        'border-radius:8px;border:1px solid #30363d;background:#0d1117;' +
        'color:#e6edf3;font:400 13px system-ui;margin-bottom:12px" />' +
        '<label style="display:block;font:600 11px system-ui;color:#8b949e;' +
        'margin-bottom:4px">Bio</label>' +
        '<textarea id="tt-pe-bio" rows="3" style="width:100%;box-sizing:border-box;' +
        'padding:10px 12px;border-radius:8px;border:1px solid #30363d;' +
        'background:#0d1117;color:#e6edf3;font:400 13px system-ui;' +
        'margin-bottom:16px;resize:vertical">' + escapeHtml(user.bio || '') +
        '</textarea>' +
        '<div style="display:flex;gap:8px">' +
          '<button id="tt-pe-save" style="flex:1;padding:10px;background:#238636;' +
          'color:#fff;border:0;border-radius:8px;font:600 13px system-ui;' +
          'cursor:pointer">Save</button>' +
          '<button id="tt-pe-cancel" style="padding:10px 16px;background:transparent;' +
          'color:#8b949e;border:1px solid #30363d;border-radius:8px;' +
          'font:600 13px system-ui;cursor:pointer">Cancel</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    overlay.querySelector('#tt-pe-cancel').onclick = () => overlay.remove();
    overlay.querySelector('#tt-pe-save').onclick = async () => {
      const displayName = overlay.querySelector('#tt-pe-name').value.trim();
      const phone       = overlay.querySelector('#tt-pe-phone').value.trim();
      const bio         = overlay.querySelector('#tt-pe-bio').value.trim();
      try {
        if (global.Auth && global.Auth.updateProfile) {
          await global.Auth.updateProfile({ displayName, phone, bio });
        }
        Toast('✅ Profile updated');
        overlay.remove();
        refreshAccountModal();
      } catch (e) { Toast('❌ ' + e.message); }
    };
  }

  /* ── Chrome Bar ────────────────────────────────────── */
  let chromeBar = null;
  let acctBtn = null;

  function buildChrome() {
    if (chromeBar) return chromeBar;

    chromeBar = document.createElement('div');
    chromeBar.id = 'tt-chrome';
    Object.assign(chromeBar.style, {
      position:'fixed', top:0, left:0, right:0, height:'48px',
      background:'rgba(13,17,23,.94)', backdropFilter:'blur(10px)',
      borderBottom:'1px solid #262a31', zIndex: 99996,
      display:'flex', alignItems:'center', padding:'0 12px', gap:'6px',
      font:'500 12px system-ui', color:'#adbac7',
      transition:'transform .2s ease, opacity .2s ease'
    });

    chromeBar.innerHTML =
      '<div style="display:flex;align-items:center;gap:8px;' +
      'font-weight:700;color:#e6edf3;margin-right:8px">' +
        '<span style="font-size:16px">🛠️</span>' +
        '<span>Modatorial</span>' +
        '<span style="font-size:10px;color:#6e7681;font-weight:400">v' +
        VERSION + '</span>' +
      '</div>';

    const btn = (label, icon, onClick, title, variant) => {
      const b = document.createElement('button');
      const iconHtml = icon ? '<span style="font-size:14px">' + icon + '</span>' : '';
      const labelHtml = label
        ? '<span style="margin-left:' + (icon ? '6px' : '0') + '">' + label + '</span>'
        : '';
      b.innerHTML = iconHtml + labelHtml;
      b.title = title || label || icon || '';

      const base = {
        background:'transparent', color:'#adbac7', border:'1px solid transparent',
        padding:'6px 11px', borderRadius:'6px', cursor:'pointer',
        font:'600 12px system-ui', display:'flex', alignItems:'center',
        transition:'background .15s, color .15s'
      };
      const primary = Object.assign({}, base, {
        background:'#238636', color:'#fff', border:'1px solid #2ea043'
      });
      Object.assign(b.style, variant === 'primary' ? primary : base);

      if (variant === 'primary') {
        b.onmouseenter = () => { b.style.background = '#2ea043'; };
        b.onmouseleave = () => { b.style.background = '#238636'; };
      } else {
        b.onmouseenter = () => { b.style.background = '#1c1f24'; b.style.color = '#e6edf3'; };
        b.onmouseleave = () => { b.style.background = 'transparent'; b.style.color = '#adbac7'; };
      }
      b.onclick = onClick;
      return b;
    };

    const collapseBtn = btn('', '☰', () => Sidebar.toggle(), 'Toggle sidebar');
    collapseBtn.style.border = '1px solid #30363d';
    collapseBtn.style.padding = '5px 10px';
    chromeBar.appendChild(collapseBtn);

    chromeBar.appendChild(btn('Store', '📦',
      () => global.ModStore && global.ModStore.open && global.ModStore.open(),
      'Browse mods (F8)'));
    chromeBar.appendChild(btn('Mods', '🔧',
      () => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F10' })),
      'Manage mods (F10)'));

    const spacer = document.createElement('div');
    spacer.style.flex = '1';
    chromeBar.appendChild(spacer);

    chromeBar.appendChild(btn('', '🎨', () => Theme.cycle(), 'Cycle theme (F9)'));
    chromeBar.appendChild(btn('', '📸', Screenshot, 'Screenshot (F2)'));

    const srBtn = btn('Run', '⏱️', () => {
      if (Speedrun.running) Speedrun.stop(); else Speedrun.start();
      const lbl = srBtn.querySelector('span:last-child');
      if (lbl) lbl.textContent = Speedrun.running ? 'Stop' : 'Run';
    }, 'Toggle speedrun timer');
    chromeBar.appendChild(srBtn);

    const achBtn = btn(Achievements.count() + '/' + Achievements.total(), '🏆',
      () => openAccountModal(), 'Achievements');
    chromeBar.appendChild(achBtn);
    setInterval(() => {
      const lbl = achBtn.querySelector('span:last-child');
      if (lbl) lbl.textContent = Achievements.count() + '/' + Achievements.total();
    }, 2000);

    const audioBtn = btn('', Audio_.muted ? '🔇' : '🔊', () => {
      const muted = Audio_.toggleMute();
      const i = audioBtn.querySelector('span');
      if (i) i.textContent = muted ? '🔇' : '🔊';
    }, 'Toggle audio');
    chromeBar.appendChild(audioBtn);

    chromeBar.appendChild(btn('', '💬',
      () => window.open('https://discord.gg/5y8bE2hYSY', '_blank', 'noopener'),
      'Join the Discord community'));

    /* ── ACCOUNT BUTTON — redirects to login.html / signup.html ── */
    acctBtn = btn('Sign in', '👤', () => {
      const u = Accounts.current();
      if (u) {
        openAccountModal();
      } else {
        location.href = 'login.html?next=' + encodeURIComponent(location.pathname);
      }
    }, 'Click to sign in or manage accounts', 'primary');
    chromeBar.appendChild(acctBtn);

    chromeBar.appendChild(btn('', '✕', () => {
      if (!confirm('Hide the top bar? Press Ctrl+Shift+B to bring it back.')) return;
      chromeBar.style.transform = 'translateY(-100%)';
      chromeBar.style.opacity = '0';
      setTimeout(() => { chromeBar.style.display = 'none'; }, 200);
      store.set(KEYS.chromeHidden, '1');
    }, 'Hide chrome bar'));

    document.body.appendChild(chromeBar);

    const refreshAccountBtn = () => {
      if (!acctBtn) return;
      const u = Accounts.current();
      const icon = acctBtn.querySelector('span:first-child');
      const lbl  = acctBtn.querySelector('span:last-child');
      if (u) {
        const name = u.displayName || u.username ||
                     (u.email ? u.email.split('@')[0] : 'Account');
        const short = name.length > 14 ? name.slice(0, 12) + '…' : name;
        if (icon) icon.textContent = '👤';
        if (lbl)  lbl.textContent = short;
        Object.assign(acctBtn.style, {
          background:'#1a2a1a', color:'#3fb950', borderColor:'#3fb950'
        });
        acctBtn.title = 'Signed in as ' + name + ' · ' + (u.email || '');
      } else {
        if (icon) icon.textContent = '👤';
        if (lbl)  lbl.textContent = 'Sign in';
        Object.assign(acctBtn.style, {
          background:'#238636', color:'#fff', borderColor:'#2ea043'
        });
        acctBtn.title = 'Sign in or create an account';
      }
    };
    refreshAccountBtn();

    if (global.Auth && global.Auth.onChange) {
      global.Auth.onChange(u => {
        if (u) {
          Accounts.remember(u);
          Achievements.unlock('first-launch');
        }
        refreshAccountBtn();
      });
    }
    Accounts.onChange(refreshAccountBtn);

    if (store.get(KEYS.chromeHidden, false) === '1') {
      chromeBar.style.display = 'none';
    }

    return chromeBar;
  }

  /* ── Sidebar ───────────────────────────────────────── */
  const Sidebar = {
    collapsed: store.get(KEYS.sidebarCollapsed, false) === true,
    apply() {
      document.body.classList.toggle('tt-sidebar-collapsed', this.collapsed);
      try {
        document.documentElement.style.setProperty(
          '--tt-sidebar-width', this.collapsed ? '56px' : '220px');
      } catch {}
    },
    toggle() {
      this.collapsed = !this.collapsed;
      store.set(KEYS.sidebarCollapsed, this.collapsed);
      this.apply();
    },
    collapse() { this.collapsed = true; store.set(KEYS.sidebarCollapsed, true); this.apply(); },
    expand()   { this.collapsed = false; store.set(KEYS.sidebarCollapsed, false); this.apply(); }
  };

  /* ── Hotkeys ───────────────────────────────────────── */
  window.addEventListener('keydown', e => {
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' ||
        (e.target && e.target.isContentEditable)) return;

    if (e.ctrlKey && e.shiftKey && (e.key === 'B' || e.key === 'b')) {
      e.preventDefault();
      store.del(KEYS.chromeHidden);
      if (chromeBar) {
        chromeBar.style.display = 'flex';
        chromeBar.style.transform = '';
        chromeBar.style.opacity = '1';
        Toast('✓ Chrome bar restored');
      }
      return;
    }

    switch (e.key) {
      case 'F2': e.preventDefault(); Screenshot(); break;
      case 'F9': e.preventDefault(); Theme.cycle(); break;
    }
  });

  /* ── Public API ────────────────────────────────────── */
  global.ClientFeatures = {
    VERSION: VERSION,
    Theme, Audio: Audio_, Achievements, Speedrun, Screenshot,
    Stats, Accounts, Sidebar, Toast,
    openAccount: openAccountModal,
    openProfileEditor
  };

  /* ── Boot ──────────────────────────────────────────── */
  function boot() {
    log('client-features.js v' + VERSION + ' loaded');
    try { Theme.apply(Theme.current); } catch (e) { err('theme:', e); }
    try { Sidebar.apply(); } catch (e) { err('sidebar:', e); }
    try { buildChrome(); } catch (e) { err('chrome:', e); }
    log('All features active');

    if (!store.get(KEYS.seenIntro, false)) {
      setTimeout(() => {
        Achievements.unlock('first-launch');
        store.set(KEYS.seenIntro, true);
      }, 1500);
    }

    setInterval(() => {
      try {
        const list = JSON.parse(localStorage.getItem('tt-imported-mods') || '[]');
        if (Array.isArray(list)) {
          if (list.length >= 3)  Achievements.unlock('mod-enthusiast');
          if (list.length >= 10) Achievements.unlock('mod-addict');
        }
      } catch {}
    }, 5000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  log('Public API exposed at window.ClientFeatures');

})(window);