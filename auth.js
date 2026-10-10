/* ============================================================
 * auth.js — v2.0.2 — Modatorial.io
 * Firebase Auth + user profiles.
 * Public API: window.Auth
 * ============================================================ */
(function (global) {
  'use strict';

  let app, auth, db;
  let currentUser = null;
  let ready = false;
  const listeners = new Set();

  const log  = (...a) => console.log  ('%c[Auth]', 'color:#3fb950;font-weight:bold', ...a);
  const warn = (...a) => console.warn ('%c[Auth]', 'color:#f0883e;font-weight:bold', ...a);
  const err  = (...a) => console.error('%c[Auth]', 'color:#f85149;font-weight:bold', ...a);

  function emit() {
    for (const fn of listeners) {
      try { fn(currentUser); } catch (e) { err('listener error', e); }
    }
  }

  function attachFirebase() {
    if (app) return true;
    if (!global.firebase) return false;
    if (!firebase.apps || !firebase.apps.length) return false;
    try {
      app  = firebase.app();
      auth = firebase.auth();
      db   = firebase.firestore();
      log('Firebase SDK attached');
      return true;
    } catch (e) {
      err('attachFirebase failed:', e);
      return false;
    }
  }

  /* ── Wait for Firebase with polling + event ─────────── */
  let attempts = 0;
  function tryAttach() {
    attempts++;
    if (attachFirebase()) {
      clearInterval(pollTimer);
      attachAuthListener();
      return true;
    }
    if (attempts === 100) {      // 10 seconds
      warn('⚠️ Firebase did not initialize in 10s.');
      warn('   Check firebase-init.js has real config values.');
      ready = true;
      emit();
    }
    return false;
  }
  const pollTimer = setInterval(tryAttach, 100);
  window.addEventListener('firebase-ready', tryAttach);
  tryAttach();

  function attachAuthListener() {
    auth.onAuthStateChanged(async user => {
      try {
        if (user) {
          const snap = await db.collection('users').doc(user.uid).get();
          currentUser = snap.exists
            ? { uid: user.uid, ...snap.data() }
            : {
                uid: user.uid,
                email: user.email,
                username: (user.email || '').split('@')[0],
                displayName: user.displayName || (user.email || '').split('@')[0]
              };
        } else {
          currentUser = null;
        }
      } catch (e) {
        err('profile fetch failed:', e);
        currentUser = user
          ? { uid: user.uid, email: user.email, displayName: user.displayName }
          : null;
      }
      ready = true;
      emit();
    });
    log('Auth state listener attached');
  }

  /* ── Username validation ───────────────────────────── */
  const USERNAME_RE = /^[a-zA-Z0-9_\-\.]{3,24}$/;

  /* ── Public API ────────────────────────────────────── */
  const Auth = {
    get ready() { return ready; },
    current()   { return currentUser; },

    onChange(fn) {
      listeners.add(fn);
      fn(currentUser);
      return () => listeners.delete(fn);
    },

    async signup(email, password, username, displayName) {
      if (!auth || !db) throw new Error('Firebase is not ready. Wait a moment and try again.');
      if (!USERNAME_RE.test(username || ''))
        throw new Error('Username must be 3–24 chars: letters, numbers, _ - .');
      if (!email || !password) throw new Error('Email and password are required.');
      if (password.length < 8)  throw new Error('Password must be at least 8 characters.');

      // 1. Check username availability
      const unameRef = db.collection('usernames').doc(username.toLowerCase());
      const existing = await unameRef.get();
      if (existing.exists) throw new Error('Username is already taken.');

      // 2. Create the Firebase Auth user
      let cred;
      try {
        cred = await auth.createUserWithEmailAndPassword(email, password);
      } catch (e) {
        // Map common errors to friendly messages
        const code = e.code || '';
        if (code.includes('email-already-in-use'))
          throw new Error('That email is already registered. Try signing in.');
        if (code.includes('invalid-email'))
          throw new Error('That email address looks invalid.');
        if (code.includes('weak-password'))
          throw new Error('Password is too weak. Use 8+ characters.');
        if (code.includes('operation-not-allowed'))
          throw new Error('Email/Password sign-in is not enabled in Firebase Console.');
        throw e;
      }

      const uid = cred.user.uid;

      // 3. Write the profile document
      const profile = {
        uid,
        email: email.toLowerCase(),
        username: username.toLowerCase(),
        usernameDisplay: username,
        displayName: displayName || username,
        photoURL: null,
        phone: null,
        bio: '',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      };

      try {
        const batch = db.batch();
        batch.set(db.collection('users').doc(uid), profile);
        batch.set(unameRef, {
          uid, username: username.toLowerCase(),
          createdAt: profile.createdAt
        });
        await batch.commit();
      } catch (e) {
        // Profile write failed — still signed in, but warn
        warn('Profile write failed:', e);
        // Best effort: delete auth user to keep things consistent
        try { await cred.user.delete(); } catch {}
        throw new Error('Could not save profile. Check Firestore rules.');
      }

      try { await cred.user.updateProfile({ displayName: profile.displayName }); } catch {}

      return profile;
    },

    async login(email, password) {
      if (!auth) throw new Error('Firebase is not ready. Wait a moment and try again.');
      try {
        const cred = await auth.signInWithEmailAndPassword(email, password);
        return cred.user;
      } catch (e) {
        const code = e.code || '';
        if (code.includes('user-not-found'))
          throw new Error('No account found for that email.');
        if (code.includes('wrong-password') || code.includes('invalid-credential'))
          throw new Error('Incorrect password.');
        if (code.includes('invalid-email'))
          throw new Error('That email address looks invalid.');
        if (code.includes('too-many-requests'))
          throw new Error('Too many attempts. Try again in a minute.');
        throw e;
      }
    },

    async logout() {
      if (!auth) return;
      await auth.signOut();
    },

    async resetPassword(email) {
      if (!auth) throw new Error('Firebase is not ready.');
      await auth.sendPasswordResetEmail(email);
    },

    async profile(uid) {
      if (!db) return null;
      const snap = await db.collection('users').doc(uid).get();
      return snap.exists ? { uid, ...snap.data() } : null;
    },

    async profileByUsername(username) {
      if (!db) return null;
      const u = await db.collection('usernames').doc(username.toLowerCase()).get();
      if (!u.exists) return null;
      return Auth.profile(u.data().uid);
    },

    async setPhone(phone) {
      if (!currentUser) throw new Error('Sign in first.');
      await db.collection('users').doc(currentUser.uid).update({
        phone,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    },

    async updateProfile(fields) {
      if (!currentUser) throw new Error('Sign in first.');
      const allowed = ['displayName', 'bio', 'photoURL', 'phone'];
      const patch = { updatedAt: firebase.firestore.FieldValue.serverTimestamp() };
      for (const k of allowed) if (k in fields) patch[k] = fields[k];
      await db.collection('users').doc(currentUser.uid).update(patch);
    },

    openUI() { openAuthModal(); }
  };

  global.Auth = Auth;

  /* ══════════════════════════════════════════════════════════
   * Modal UI
   * ══════════════════════════════════════════════════════════ */
  let modalEl = null;

  function injectStyles() {
    if (document.getElementById('tt-auth-style')) return;
    const s = document.createElement('style');
    s.id = 'tt-auth-style';
    s.textContent = `
      #tt-auth-modal { position:fixed; inset:0; z-index:200000;
        background:rgba(0,0,0,.82); backdrop-filter:blur(6px);
        display:flex; align-items:center; justify-content:center;
        font-family:system-ui,-apple-system,sans-serif; }
      #tt-auth-modal .box { width:100%; max-width:420px; background:#16181d;
        border:1px solid #262a31; border-radius:14px; padding:28px 32px;
        color:#e6edf3; box-shadow:0 20px 60px rgba(0,0,0,.6);
        box-sizing:border-box; }
      #tt-auth-modal h2 { margin:0 0 4px; font-size:20px; font-weight:700; }
      #tt-auth-modal .sub { margin:0 0 20px; color:#8b949e; font-size:13px; }
      #tt-auth-modal label { display:block; font-size:12px; font-weight:600;
        margin:12px 0 4px; color:#adbac7; }
      #tt-auth-modal input { width:100%; box-sizing:border-box; padding:10px 12px;
        border-radius:8px; border:1px solid #30363d; background:#0d1117;
        color:#e6edf3; font-size:14px; transition:border-color .15s; }
      #tt-auth-modal input:focus { outline:none; border-color:#3fb950; }
      #tt-auth-modal .error { color:#f85149; font-size:12px;
        margin-top:10px; min-height:16px; }
      #tt-auth-modal .info { color:#3fb950; font-size:12px;
        margin-top:10px; min-height:16px; }
      #tt-auth-modal .row { display:flex; gap:8px; margin-top:20px; }
      #tt-auth-modal button { padding:10px 18px; border-radius:8px;
        font-weight:600; font-size:14px; cursor:pointer;
        border:1px solid transparent; transition:background .15s; }
      #tt-auth-modal .primary { background:#238636; color:#fff; flex:1; }
      #tt-auth-modal .primary:hover { background:#2ea043; }
      #tt-auth-modal .primary:disabled { background:#1a3a22; cursor:default;
        opacity:.7; }
      #tt-auth-modal .ghost { background:transparent; color:#8b949e;
        border-color:#30363d; }
      #tt-auth-modal .ghost:hover { color:#e6edf3; border-color:#8b949e; }
      #tt-auth-modal .switch { text-align:center; margin-top:14px;
        font-size:12px; color:#8b949e; }
      #tt-auth-modal .switch a { color:#3fb950; cursor:pointer;
        text-decoration:none; }
      #tt-auth-modal .switch a:hover { text-decoration:underline; }
      #tt-auth-modal .status {
        margin-bottom:12px; padding:8px 12px; border-radius:6px;
        font-size:12px; display:flex; align-items:center; gap:6px;
      }
      #tt-auth-modal .status.warn {
        background:#2a1a0a; color:#f0883e; border:1px solid #f0883e;
      }
    `;
    document.head.appendChild(s);
  }

  function openAuthModal() {
    injectStyles();
    if (modalEl) { modalEl.style.display = 'flex'; renderAuthModal('login'); return; }
    modalEl = document.createElement('div');
    modalEl.id = 'tt-auth-modal';
    document.body.appendChild(modalEl);
    renderAuthModal('login');
  }

  function closeAuthModal() {
    if (modalEl) modalEl.style.display = 'none';
  }

  function renderAuthModal(mode) {
    const firebaseReady = !!(auth && db);

    modalEl.innerHTML =
      '<div class="box">' +
        (firebaseReady
          ? ''
          : '<div class="status warn">⚠️ Firebase not initialized — ' +
            'check firebase-init.js has real config values and Email/Password ' +
            'is enabled in Firebase Console.</div>') +
        '<h2>' + (mode === 'login' ? 'Sign in' : 'Create account') + '</h2>' +
        '<p class="sub">Your account protects your mods from impersonation.</p>' +

        '<label for="tt-auth-email">Email</label>' +
        '<input id="tt-auth-email" type="email" autocomplete="email" ' +
        'placeholder="you@example.com" />' +

        (mode === 'signup'
          ? '<label for="tt-auth-username">Username</label>' +
            '<input id="tt-auth-username" type="text" autocomplete="username" ' +
            'placeholder="Letters, numbers, _ - . (3–24 chars)" />' +
            '<label for="tt-auth-name">Display name</label>' +
            '<input id="tt-auth-name" type="text" autocomplete="name" ' +
            'placeholder="Shown on your mods" />'
          : '') +

        '<label for="tt-auth-pass">Password</label>' +
        '<input id="tt-auth-pass" type="password" ' +
        'autocomplete="' + (mode === 'login' ? 'current-password' : 'new-password') + '" ' +
        'placeholder="' + (mode === 'signup' ? 'At least 8 characters' : '') + '" />' +

        '<div class="error" id="tt-auth-error"></div>' +

        '<div class="row">' +
          '<button class="primary" id="tt-auth-submit"' +
            (firebaseReady ? '' : ' disabled') + '>' +
            (mode === 'login' ? 'Sign in' : 'Create account') +
          '</button>' +
          '<button class="ghost" id="tt-auth-cancel">Cancel</button>' +
        '</div>' +

        '<div class="switch">' +
          (mode === 'login'
            ? 'No account? <a id="tt-auth-switch">Create one</a>'
            : 'Already registered? <a id="tt-auth-switch">Sign in</a>') +
        '</div>' +
      '</div>';

    const $ = id => modalEl.querySelector(id);
    $('#tt-auth-cancel').onclick = closeAuthModal;
    $('#tt-auth-switch').onclick = () =>
      renderAuthModal(mode === 'login' ? 'signup' : 'login');

    const submit = async () => {
      const btn = $('#tt-auth-submit');
      const errEl = $('#tt-auth-error');
      errEl.textContent = '';
      errEl.style.color = '#f85149';

      btn.disabled = true;
      const oldText = btn.textContent;
      btn.textContent = '…';

      try {
        const email = $('#tt-auth-email').value.trim();
        const pass  = $('#tt-auth-pass').value;

        if (mode === 'login') {
          await Auth.login(email, pass);
          errEl.style.color = '#3fb950';
          errEl.textContent = '✅ Signed in!';
        } else {
          const uname = $('#tt-auth-username').value.trim();
          const name  = $('#tt-auth-name').value.trim() || uname;
          await Auth.signup(email, pass, uname, name);
          errEl.style.color = '#3fb950';
          errEl.textContent = '✅ Account created!';
        }

        setTimeout(() => {
          closeAuthModal();
          if (global.TerritorialMods?.showToast)
            global.TerritorialMods.showToast(
              mode === 'login' ? '✅ Signed in' : '✅ Account created');
        }, 500);

      } catch (e) {
        errEl.style.color = '#f85149';
        errEl.textContent = '❌ ' + (e.message || String(e));
        btn.disabled = false;
        btn.textContent = oldText;
        console.error('[Auth] submit failed:', e);
      }
    };

    $('#tt-auth-submit').onclick = submit;
    modalEl.querySelectorAll('input').forEach(inp => {
      inp.addEventListener('keydown', e => {
        if (e.key === 'Enter') submit();
      });
    });

    // Autofocus first field
    const first = modalEl.querySelector('input');
    if (first) setTimeout(() => first.focus(), 50);
  }

  log('Account module loaded — Auth API ready');

})(window);