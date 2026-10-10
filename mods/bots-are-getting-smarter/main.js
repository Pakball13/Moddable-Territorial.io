/* ============================================================
 * Bots Are Getting Smarter — Modatorial.io
 *
 * PHASE 1: DATA CAPTURE
 *
 *   Hooks ap.jh.kX — the AI attack decision entry point.
 *   For every bot decision, we snapshot:
 *     - the bot's strength & territory
 *     - each neighbor's strength, territory, team affiliation
 *     - the amount of strength the AI decided to commit
 *   We buffer samples in memory and export them as JSON.
 *
 * PHASE 2 (OFFLINE — Python):
 *
 *   Load bot-training-data.json into a PyTorch notebook.
 *   Train a small MLP:
 *     input  = [myS, myT, neighbors..., normalized]
 *     output = [should_attack, target_index, strength_fraction]
 *   Save the model's weights to policy.json.
 *
 * PHASE 3 (BACK IN THIS MOD — future):
 *
 *   Load policy.json, run inference inside ap.jh.kX override,
 *   replace the bot's decision with the model's.
 *
 *   This file currently implements Phase 1 + the HUD + export.
 * ============================================================ */

const state = {
  patched: false,
  samples: [],
  decisions: 0,
  skipped: 0
};

const MAX_SAMPLES = 8000;
const MAX_NEIGHBORS = 8;

/* ------------------------------------------------------------
 * Read the current game state safely
 * ------------------------------------------------------------ */
function readState(player) {
  const TT = api.getGame();
  if (!TT || !TT.ah || !TT.aE || !TT.ad) return null;
  if (TT.aE.a2G !== 1) return null; // not in match

  const ah = TT.ah;
  const aE = TT.aE;
  const ad = TT.ad;

  /* Player must be alive */
  if (!ah.nU[player] || !ah.hN[player]) return null;

  const myS = ah.hb[player];
  const myT = ah.hN[player];

  /* Discover neighbors from frontier cells */
  const hF = ah.hF[player];
  const neighbors = [];
  if (hF && hF.length) {
    const seen = new Set();
    const border = ad.fb;
    const maxScan = Math.min(hF.length, 200);
    for (let i = 0; i < maxScan; i++) {
      for (let k = 0; k < 4; k++) {
        const nb = hF[i] + border[k];
        if (!ad.h9(nb)) continue;
        const owner = ad.fR(nb);
        if (owner === player) continue;
        if (owner >= aE.fW) continue;
        if (seen.has(owner)) continue;
        seen.add(owner);
        neighbors.push(owner);
        if (neighbors.length >= MAX_NEIGHBORS * 2) break;
      }
      if (neighbors.length >= MAX_NEIGHBORS * 2) break;
    }
  }

  /* Keep only the top N by threat (strength relative to mine) */
  const neighborData = neighbors
    .map(id => ({
      id,
      strength: ah.hb[id] || 0,
      territory: ah.hN[id] || 0,
      isHuman: id < aE.ku,
      sameTeam: (TT.bj && TT.bj.fX) ? TT.bj.fX[id] === TT.bj.fX[player] : false
    }))
    .sort((a, b) => (b.strength / Math.max(myS, 1)) - (a.strength / Math.max(myS, 1)))
    .slice(0, MAX_NEIGHBORS);

  /* Difficulty tier (index into aF.l5 array — 0..6) */
  let difficulty = 0;
  try {
    difficulty = TT.aF ? TT.aF.iI[player] : 0;
  } catch {}

  return {
    myS,
    myT,
    neighbors: neighborData,
    difficulty,
    isHuman: player < aE.ku,
    sameTeamCount: aE.zS,
    aliveCount: aE.a2J,
    playerCount: aE.fW,
    humanCount: aE.ku,
    gameMode: aE.lC,
    myTeam: (TT.bj && TT.bj.fX) ? TT.bj.fX[player] : 0
  };
}

/* ------------------------------------------------------------
 * Build a sample
 * ------------------------------------------------------------ */
function buildSample(player, amount) {
  const s = readState(player);
  if (!s) return null;

  /* Normalize features into a compact vector (for easier training) */
  const my = Math.max(s.myS, 1);
  const feats = [
    /* 0-3: self */
    s.myS / 1e6,
    s.myT / Math.max(s.playerCount, 1),
    s.difficulty / 6,
    s.isHuman ? 1 : 0
  ];

  /* 4..(4+8*5): neighbors (up to 8 × 5 features) */
  for (let i = 0; i < MAX_NEIGHBORS; i++) {
    const n = s.neighbors[i];
    if (n) {
      feats.push(
        n.strength / Math.max(my, 1),   // relative strength
        n.territory / 1e4,              // territory
        n.isHuman ? 1 : 0,
        n.sameTeam ? 1 : 0,
        1                                // "present" flag
      );
    } else {
      feats.push(0, 0, 0, 0, 0);
    }
  }

  /* 44-47: global context */
  feats.push(
    s.aliveCount / Math.max(s.playerCount, 1),
    s.humanCount / Math.max(s.playerCount, 1),
    s.sameTeamCount / 7,
    s.gameMode / 10
  );

  return {
    /* Raw (for offline analysis) */
    raw: s,
    /* Normalized input vector */
    features: feats,
    /* Target: how much strength was committed, normalized by my strength */
    action: {
      type: 'attack',
      committed: amount,
      committedFrac: Math.min(amount / Math.max(my, 1), 1)
    },
    meta: {
      player,
      t: Date.now(),
      tick: api.getGame() && api.getGame().bi ? api.getGame().bi.kr() : 0
    }
  };
}

/* ------------------------------------------------------------
 * Hook ap.jh.kX — the AI attack decision
 * ------------------------------------------------------------ */
function patchAiDecision() {
  const TT = api.getGame();
  if (!TT || !TT.ap || !TT.ap.jh) return false;
  if (state.patched) return true;
  if (TT.ap.jh.__smarterWrapped) return true;

  const jh = TT.ap.jh;
  const origKx = jh.kX.bind(jh);

  jh.kX = function (player, amount) {
    try {
      const cfg = mod.settings || {};
      const captureOn = cfg.captureEnabled !== false;
      const rate = Math.max(1, cfg.captureRate || 10);
      const captureHumans = !!cfg.captureHumansToo;

      const c = getGameContext();

      if (captureOn && c && c.inMatch) {
        const isHuman = player < c.humanCount;
        const shouldCapture = captureHumans || !isHuman;

        if (shouldCapture) {
          state.decisions++;
          if (state.decisions % rate === 0) {
            const sample = buildSample(player, amount);
            if (sample) {
              state.samples.push(sample);
              if (state.samples.length > MAX_SAMPLES) {
                state.samples.shift();
              }
            } else {
              state.skipped++;
            }
          }
        }
      }
    } catch (e) {
      /* never break the game */
      api.warn('capture failed:', e);
    }

    /* Always call the real AI */
    return origKx(player, amount);
  };

  jh.__smarterWrapped = true;
  state.patched = true;
  api.log('🧠 AI decision hook installed (ap.jh.kX)');
  return true;
}

function getGameContext() {
  const TT = api.getGame();
  if (!TT || !TT.aE) return null;
  return {
    TT,
    humanIndex: TT.aE.fJ,
    humanCount: TT.aE.ku,
    inMatch: TT.aE.a2G === 1
  };
}

/* ------------------------------------------------------------
 * HUD
 * ------------------------------------------------------------ */
let hudEl = null;

function buildHud() {
  if (hudEl) return;
  hudEl = document.createElement('div');
  hudEl.id = 'tt-smarter-hud';
  Object.assign(hudEl.style, {
    position: 'fixed',
    top: '52px',
    left: '12px',
    background: 'rgba(0,0,0,0.75)',
    color: '#00F5D4',
    padding: '8px 12px',
    borderRadius: '6px',
    font: '600 11px ui-monospace, Menlo, monospace',
    zIndex: 99997,
    pointerEvents: 'none',
    lineHeight: '1.55',
    display: 'none'
  });
  document.body.appendChild(hudEl);
  setInterval(updateHud, 500);
}

function updateHud() {
  if (!hudEl) return;
  const cfg = mod.settings || {};
  if (cfg.showHud === false) { hudEl.style.display = 'none'; return; }

  const c = getGameContext();
  const inMatch = c && c.inMatch;
  hudEl.style.display = inMatch ? 'block' : 'none';
  if (!inMatch) return;

  hudEl.innerHTML =
    '<div style="color:#6366F1;font-weight:bold">🧠 Bots Getting Smarter</div>' +
    '<div>decisions: ' + state.decisions + '</div>' +
    '<div>samples: ' + state.samples.length + '</div>' +
    '<div style="opacity:.7;margin-top:2px">BotTrainer.export()</div>';
}

/* ------------------------------------------------------------
 * Export — download samples as JSON
 * ------------------------------------------------------------ */
function exportSamples() {
  if (!state.samples.length) {
    api.showToast('⚠️ No samples captured yet — play a match first');
    return;
  }
  const payload = {
    version: 1,
    capturedAt: new Date().toISOString(),
    modVersion: mod.version,
    gameVersion: mod.gameVersion,
    featureNames: buildFeatureNames(),
    samples: state.samples
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'bot-training-data-' + Date.now() + '.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  api.showToast('📥 Exported ' + state.samples.length + ' samples');
}

function buildFeatureNames() {
  const names = ['myStrength', 'myTerritoryRatio', 'myDifficulty', 'myIsHuman'];
  for (let i = 0; i < MAX_NEIGHBORS; i++) {
    names.push(
      'n' + i + '_strengthRatio',
      'n' + i + '_territory',
      'n' + i + '_isHuman',
      'n' + i + '_sameTeam',
      'n' + i + '_present'
    );
  }
  names.push(
    'aliveRatio',
    'humanRatio',
    'teamCountRatio',
    'gameMode'
  );
  return names;
}

/* ------------------------------------------------------------
 * Public API
 * ------------------------------------------------------------ */
window.BotTrainer = {
  export: exportSamples,
  samples: () => state.samples.slice(),
  stats: () => ({
    decisions: state.decisions,
    samples: state.samples.length,
    skipped: state.skipped,
    featureCount: buildFeatureNames().length
  }),
  clear: () => {
    state.samples = [];
    state.decisions = 0;
    state.skipped = 0;
    api.showToast('🧠 Training buffer cleared');
  },
  /* Add a floating export button for quick access */
  addButton: () => api.addButton('📥 Export training', exportSamples)
};

/* ------------------------------------------------------------
 * Boot
 * ------------------------------------------------------------ */
const iv = setInterval(() => {
  if (getGameContext()) {
    if (patchAiDecision()) clearInterval(iv);
  }
}, 250);

api.on('screenChanged', () => {
  state.patched = false;
  const TT = api.getGame();
  if (TT && TT.ap && TT.ap.jh) delete TT.ap.jh.__smarterWrapped;
  patchAiDecision();
});

if (mod.settings.showHud !== false) buildHud();

/* Expose export button in the chrome bar via the top-right stack */
setTimeout(() => {
  if (api.addButton) {
    api.addButton('📥 Export training', exportSamples);
  }
}, 2000);

api.log('🧠 Bots Are Getting Smarter loaded — Phase 1 (capture)');
api.log('   Open DevTools → BotTrainer.stats() for live counts');
api.log('   Export: BotTrainer.export()');