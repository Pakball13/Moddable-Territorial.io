/* ============================================================
 * sounds.js  —  Modatorial.io audio system
 * v2.3: + typing, attack, and under-attack SFX
 * ============================================================ */
(function (global) {
  'use strict';

  const log   = (...a) => console.log('%c[Audio]', 'color:#fa9;font-weight:bold', ...a);
  const warn  = (...a) => console.warn('%c[Audio]', 'color:#fa9;font-weight:bold', ...a);

  let ctx = null, masterGain = null, ctxReady = false;
  let unlockPromise = null;

  /* ============================================================
   * CONTEXT
   * ============================================================ */
  function initCtx() {
    if (ctxReady) return true;
    try {
      const Ctor = global.AudioContext || global.webkitAudioContext;
      if (!Ctor) { warn('Web Audio API not supported'); return false; }
      ctx = new Ctor();
      masterGain = ctx.createGain();
      masterGain.gain.value = 1;
      masterGain.connect(ctx.destination);
      ctxReady = true;
      return true;
    } catch (e) { warn('AudioContext failed:', e); return false; }
  }

  function ensureRunning() {
    if (!ctxReady) initCtx();
    if (!ctx) return Promise.resolve(false);
    if (ctx.state === 'running') return Promise.resolve(true);
    if (!unlockPromise) {
      unlockPromise = ctx.resume()
        .then(() => true)
        .catch(() => false)
        .finally(() => { unlockPromise = null; });
    }
    return unlockPromise;
  }

  /* ============================================================
   * SYNTH PRIMITIVES
   * ============================================================ */
  function tone({ freq = 440, type = 'sine', dur = 0.15, vol = 0.5,
                  attack = 0.005, sweepTo = null, delay = 0 } = {}) {
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g   = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (sweepTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(masterGain);
    osc.start(t0); osc.stop(t0 + dur + 0.05);
  }

  function noise({ dur = 0.05, vol = 0.4, filterHz = 2000, q = 1.2, delay = 0 } = {}) {
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const size = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass'; filter.frequency.value = filterHz; filter.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter); filter.connect(g); g.connect(masterGain);
    src.start(t0); src.stop(t0 + dur + 0.02);
  }

  function noiseSweep({ dur = 0.25, vol = 0.25, from = 200, to = 4000, q = 2, delay = 0 } = {}) {
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const size = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, size, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < size; i++) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(from, t0);
    filter.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    filter.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter); filter.connect(g); g.connect(masterGain);
    src.start(t0); src.stop(t0 + dur + 0.05);
  }

  /* ============================================================
   * SYNTH LIBRARY
   * ============================================================ */
  const SYNTHS = {
    /* ---- UI ---- */
    click: () => {
      tone({ freq: 900, type: 'sine', dur: 0.06, vol: 0.35 });
      tone({ freq: 1300, type: 'sine', dur: 0.05, vol: 0.2 });
    },
    hover: () => tone({ freq: 1600, type: 'sine', dur: 0.025, vol: 0.12 }),

    /* ---- Typing: short crisp key click ---- */
    type: () => {
      /* High, quiet noise burst + soft tone — like a mechanical key */
      noise({ dur: 0.012, vol: 0.18, filterHz: 4000, q: 2 });
      tone({ freq: 1800, type: 'sine', dur: 0.015, vol: 0.06 });
    },

    /* ---- Sword swing / attack release ---- */
    attack: () => {
      /* Fast descending noise "whoosh" + metallic ring */
      noiseSweep({ dur: 0.18, vol: 0.32, from: 3500, to: 400, q: 3 });
      tone({ freq: 1200, type: 'triangle', dur: 0.08, vol: 0.15, sweepTo: 600 });
      tone({ freq: 2400, type: 'sine', dur: 0.12, vol: 0.08, delay: 0.02, sweepTo: 1400 });
    },

    /* ---- Under attack: alarming two-tone ---- */
    attacked: () => {
      tone({ freq: 440, type: 'square', dur: 0.10, vol: 0.22 });
      tone({ freq: 660, type: 'square', dur: 0.10, vol: 0.22, delay: 0.09 });
      tone({ freq: 440, type: 'square', dur: 0.12, vol: 0.22, delay: 0.18 });
      noise({ dur: 0.05, vol: 0.15, filterHz: 800, delay: 0.02 });
    },

    /* ---- Match flow ---- */
    start: () => {
      tone({ freq: 220, type: 'sawtooth', dur: 0.35, vol: 0.28, sweepTo: 880 });
      tone({ freq: 440, type: 'sine', dur: 0.30, vol: 0.15 });
      tone({ freq: 660, type: 'sine', dur: 0.25, vol: 0.12 });
    },
    clock: () => {
      noise({ dur: 0.02, vol: 0.25, filterHz: 3000 });
      tone({ freq: 800, type: 'square', dur: 0.02, vol: 0.1 });
    },
    timer: () => {
      tone({ freq: 880, type: 'square', dur: 0.09, vol: 0.22 });
      tone({ freq: 880, type: 'square', dur: 0.09, vol: 0.22, delay: 0.13 });
      tone({ freq: 880, type: 'square', dur: 0.09, vol: 0.22, delay: 0.26 });
    },

    /* ---- Outcomes ---- */
    victory: () => {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
        tone({ freq: f, type: 'triangle', dur: 0.35, vol: 0.28, delay: i * 0.10 });
      });
    },
    defeat: () => {
      [392, 349.23, 293.66, 220].forEach((f, i) => {
        tone({ freq: f, type: 'sawtooth', dur: 0.4, vol: 0.22, delay: i * 0.13 });
      });
    },
    surrender: () => {
      tone({ freq: 587, type: 'triangle', dur: 0.25, vol: 0.2 });
      tone({ freq: 392, type: 'triangle', dur: 0.35, vol: 0.18, delay: 0.14 });
    },

    /* ---- Notifications ---- */
    notify: () => {
      tone({ freq: 880, type: 'sine', dur: 0.4, vol: 0.25 });
      tone({ freq: 1760, type: 'sine', dur: 0.3, vol: 0.08 });
    },
    ping: () => {
      tone({ freq: 1200, type: 'sine', dur: 0.12, vol: 0.22 });
      tone({ freq: 1800, type: 'sine', dur: 0.10, vol: 0.1 });
    },
    error: () => {
      tone({ freq: 200, type: 'square', dur: 0.18, vol: 0.22 });
      tone({ freq: 150, type: 'square', dur: 0.22, vol: 0.22, delay: 0.05 });
    },
    success: () => {
      tone({ freq: 659.25, type: 'triangle', dur: 0.14, vol: 0.25 });
      tone({ freq: 987.77, type: 'triangle', dur: 0.20, vol: 0.25, delay: 0.09 });
    },
    whoosh: () => noiseSweep({ dur: 0.25, vol: 0.25, from: 200, to: 4000 }),
    levelup: () => {
      [523, 659, 784, 988, 1175, 1319].forEach((f, i) => {
        tone({ freq: f, type: 'sine', dur: 0.25, vol: 0.18, delay: i * 0.06 });
      });
    }
  };

  /* ============================================================
   * SOUNDS OBJECT
   * ============================================================ */
  const Sounds = {
    library: {
      click: 'synth', hover: 'synth', type: 'synth',
      attack: 'synth', attacked: 'synth',
      start: 'synth', clock: 'synth', timer: 'synth',
      victory: 'synth', defeat: 'synth', surrender: 'synth',
      notify: 'synth', ping: 'synth',
      error: 'synth', success: 'synth',
      whoosh: 'synth', levelup: 'synth'
    },
    volume: parseFloat(localStorage.getItem('tt-volume') || '0.7'),
    muted:  localStorage.getItem('tt-muted') === '1',
    userInteracted: false,

    play(id, { volume } = {}) {
      if (Sounds.muted) return;
      const entry = Sounds.library[id];
      if (!entry) return;
      const volScale = (volume != null ? volume : 1) * Sounds.volume;
      if (volScale <= 0) return;
      ensureRunning().then(ok => {
        if (!ok) return;
        if (entry === 'synth') {
          const fn = SYNTHS[id];
          if (!fn) return;
          const prev = masterGain.gain.value;
          masterGain.gain.value = volScale;
          try { fn(); } catch (e) { warn('Synth error for ' + id + ':', e); }
          setTimeout(() => { if (masterGain) masterGain.gain.value = prev; }, 800);
        }
      });
    },

    setVolume(v) {
      Sounds.volume = Math.min(1, Math.max(0, +v || 0));
      localStorage.setItem('tt-volume', String(Sounds.volume));
      if (global.TerritorialMods?.showToast) {
        global.TerritorialMods.showToast(`🔊 Volume: ${Math.round(Sounds.volume * 100)}%`);
      }
    },
    getVolume() { return Sounds.volume; },
    mute()   { Sounds.muted = true;  localStorage.setItem('tt-muted', '1'); },
    unmute() { Sounds.muted = false; localStorage.setItem('tt-muted', '0'); },
    toggleMute() {
      Sounds.muted ? Sounds.unmute() : Sounds.mute();
      if (global.TerritorialMods?.showToast) {
        global.TerritorialMods.showToast(Sounds.muted ? '🔇 Muted' : '🔊 Unmuted');
      }
      return Sounds.muted;
    },
    isMuted() { return Sounds.muted; },
    unlock() { return ensureRunning(); },
    debug() {
      return {
        ctxReady,
        ctxState: ctx ? ctx.state : 'none',
        volume: Sounds.volume,
        muted: Sounds.muted,
        userInteracted: Sounds.userInteracted,
        synths: Object.keys(SYNTHS).length
      };
    }
  };
  global.TerritorialSounds = Sounds;

  /* ============================================================
   * UNLOCK ON FIRST GESTURE
   * ============================================================ */
  ['pointerdown', 'keydown', 'touchstart', 'click'].forEach(evt => {
    document.addEventListener(evt, function onFirst() {
      if (Sounds.userInteracted) return;
      Sounds.userInteracted = true;
      ensureRunning().then(ok => { if (ok) log('🔊 Audio unlocked'); });
      ['pointerdown', 'keydown', 'touchstart', 'click'].forEach(e2 =>
        document.removeEventListener(e2, onFirst, true));
    }, true);
  });

  /* ============================================================
   * UI EVENT HOOKS
   * ============================================================ */
  document.addEventListener('click', e => {
    if (e.target.closest && e.target.closest(
      'body > button[data-tt-menu-btn="1"], #tt-chrome button, #tt-topright-stack button'
    )) {
      Sounds.play('click', { volume: 0.7 });
    }
  }, true);

  document.addEventListener('mouseenter', e => {
    if (e.target.closest && e.target.closest('body > button[data-tt-menu-btn="1"]')) {
      Sounds.play('hover', { volume: 0.4 });
    }
  }, true);

  /* ============================================================
   * TYPING SOUND
   * Plays a soft click on every non-modifier keypress while
   * the user is typing in any input/textarea.
   * Rate-limited so holding a key doesn't machine-gun the audio.
   * ============================================================ */
  let lastTypeSound = 0;
  const TYPE_COOLDOWN_MS = 30;

  document.addEventListener('keydown', e => {
    /* Ignore modifier keys and repeats shorter than cooldown */
    if (e.key === 'Shift' || e.key === 'Control' || e.key === 'Alt' ||
        e.key === 'Meta' || e.key === 'Tab' || e.key === 'CapsLock' ||
        e.key === 'Escape' || e.key === 'Enter') return;

    /* Only when typing into an input/textarea (or contenteditable) */
    const target = e.target;
    if (!target) return;
    const tag = target.tagName;
    const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || target.isContentEditable;
    if (!isInput) return;

    /* Rate-limit */
    const now = performance.now();
    if (now - lastTypeSound < TYPE_COOLDOWN_MS) return;
    lastTypeSound = now;

    /* Vary pitch slightly for a natural feel */
    const variance = 0.9 + Math.random() * 0.2;
    const prevVol = Sounds.volume;
    Sounds.volume = prevVol * variance;
    Sounds.play('type', { volume: 0.55 });
    Sounds.volume = prevVol;
  }, true);

  /* ============================================================
   * ATTACK SFX — outgoing
   * Decodes the outgoing WebSocket packet to detect an attack.
   *
   * Attack packet layout (from game source, qm.qq):
   *   bit 1: mode = 1  (player action)
   *   bits 2-5: action = 1 (attack)
   * → byte[0] = 0b10001xxx  →  (byte & 0xF8) === 0x88
   * ============================================================ */
  const API = global.TerritorialMods;
  let lastAttackSound = 0;
  const ATTACK_COOLDOWN_MS = 60;

  if (API && API.addHook) {
    API.addHook('netSend', data => {
      try {
        if (!data) return;
        const bytes = data instanceof ArrayBuffer
          ? new Uint8Array(data)
          : data.buffer ? new Uint8Array(data.buffer, data.byteOffset || 0, data.byteLength)
          : data;
        if (!bytes || bytes.length < 2) return;

        /* Only in-match */
        const TT = API.getGame && API.getGame();
        if (!TT || !TT.aE || TT.aE.a2G !== 1) return;

        /* Attack signature: top 5 bits are 1 0001 */
        if ((bytes[0] & 0xF8) !== 0x88) return;

        const now = performance.now();
        if (now - lastAttackSound < ATTACK_COOLDOWN_MS) return;
        lastAttackSound = now;

        Sounds.play('attack', { volume: 0.6 });
      } catch (e) { /* silent */ }
    });
  }

  /* ============================================================
   * ATTACK SFX — incoming (when we get attacked)
   * Detects the game's own "X attacks you! ⚔️" toast by
   * watching the DOM for the notification popups.
   * ============================================================ */
  let lastAttackedSound = 0;
  const ATTACKED_COOLDOWN_MS = 2000;

  if (typeof MutationObserver !== 'undefined') {
    const observer = new MutationObserver(muts => {
      const TT = API && API.getGame && API.getGame();
      if (!TT || !TT.aE || TT.aE.a2G !== 1) return;

      for (const m of muts) {
        for (const n of m.addedNodes) {
          if (!(n instanceof HTMLElement)) continue;
          const txt = n.textContent || '';
          /* Match "attacks you" anywhere in the text (case-insensitive) */
          if (!/attacks you/i.test(txt)) continue;

          const now = performance.now();
          if (now - lastAttackedSound < ATTACKED_COOLDOWN_MS) return;
          lastAttackedSound = now;

          Sounds.play('attacked', { volume: 0.55 });
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  /* ============================================================
   * MATCH EVENTS
   * ============================================================ */
  if (API && API.on) {
    API.on('screenChanged',      () => Sounds.play('ping',   { volume: 0.6 }));
    API.on('modToggled',         () => Sounds.play('notify', { volume: 0.6 }));
    API.on('modSettingsChanged', () => Sounds.play('click',  { volume: 0.5 }));
  }

  global.addEventListener('tt-account-outcome', e => {
    const o = e.detail && e.detail.outcome;
    if (o === 'win')            Sounds.play('victory');
    else if (o === 'loss')      Sounds.play('defeat');
    else if (o === 'surrender') Sounds.play('surrender');
  });

  let wasInMatch = false;
  setInterval(() => {
    const TT = API && API.getGame && API.getGame();
    const inMatch = !!(TT && TT.aE && TT.aE.a2G === 1);
    if (inMatch && !wasInMatch) Sounds.play('start');
    wasInMatch = inMatch;
  }, 500);

  /* ============================================================
   * BOOT
   * ============================================================ */
  initCtx();
  log(`Ready — volume ${Math.round(Sounds.volume * 100)}%, muted: ${Sounds.muted}`);
  log('New SFX: type · attack · attacked');

})(window);