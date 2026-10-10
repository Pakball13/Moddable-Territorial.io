/* ============================================================
 * Infinite Interest — Modatorial.io
 * Overrides the game's per-player interest rate (af.aDb) so you
 * earn absurd income per tick. Bots can also be buffed via the
 * settings panel.
 * ============================================================ */

let patched = false;
let hudEl = null;

/* ------------------------------------------------------------
 * Snapshot the human player index and total player count
 * ------------------------------------------------------------ */
function getGameContext() {
  const TT = api.getGame();
  if (!TT || !TT.aE) return null;
  return {
    TT,
    humanIndex: TT.aE.fJ,
    humanCount: TT.aE.ku,
    totalPlayers: TT.aE.fW,
    inMatch: TT.aE.a2G === 1
  };
}

/* ------------------------------------------------------------
 * Install the override on af.aDb
 *
 * The game does:
 *   this.dk = function() {
 *     if (iIncomeType === 0) this.aDb = function(p){ return aLX(p); };
 *     else if (iIncomeType === 1) this.aDb = function(p){ return ... };
 *     else this.aDb = function(p){ return ... };
 *   };
 *
 * So we wrap af.dk so that AFTER the game reassigns aDb, we
 * immediately wrap it again with our multiplier.
 * ------------------------------------------------------------ */
function installOverride() {
  const ctx = getGameContext();
  if (!ctx) return false;

  const af = ctx.TT.af;
  if (!af) return false;
  if (af.__iiWrapped) return true;

  const origDk = af.dk.bind(af);

  af.dk = function () {
    /* Let the game reassign aDb according to its own income type */
    origDk();

    /* Now wrap the freshly-assigned aDb */
    const innerAdb = this.aDb.bind(this);
    const self = this;

    this.aDb = function (player) {
      const base = innerAdb(player);

      /* Settings — read live so the sliders work mid-match */
      const humanMult = (mod.settings && mod.settings.humanMultiplier) || 1000;
      const botMult   = (mod.settings && mod.settings.botMultiplier)   || 1;
      const scaleBots = !!(mod.settings && mod.settings.scaleBotsToMe);

      const c = getGameContext();
      if (!c) return base;

      const isHuman = player < c.humanCount;

      /* You */
      if (player === c.humanIndex) {
        return base * humanMult;
      }

      /* Other humans — leave alone */
      if (isHuman) {
        return base;
      }

      /* Bots */
      if (scaleBots) {
        return base * humanMult;
      }
      return base * botMult;
    };
  };

  af.__iiWrapped = true;
  api.log('💎 Infinite Interest patched — af.dk is now wrapped');
  return true;
}

/* ------------------------------------------------------------
 * HUD — small overlay showing current multipliers
 * ------------------------------------------------------------ */
function buildHud() {
  if (hudEl) return;
  hudEl = document.createElement('div');
  hudEl.id = 'tt-ii-hud';
  Object.assign(hudEl.style, {
    position: 'fixed',
    top: '52px',
    right: '12px',
    background: 'rgba(0,0,0,0.75)',
    color: '#00F5D4',
    padding: '8px 12px',
    borderRadius: '6px',
    font: '600 11px ui-monospace, Menlo, monospace',
    zIndex: 99997,
    pointerEvents: 'none',
    lineHeight: '1.5',
    display: 'none'
  });
  document.body.appendChild(hudEl);
  setInterval(updateHud, 500);
}

function updateHud() {
  if (!hudEl) return;
  if (mod.settings && mod.settings.showHud === false) {
    hudEl.style.display = 'none';
    return;
  }
  const c = getGameContext();
  const inMatch = c && c.inMatch;
  hudEl.style.display = inMatch ? 'block' : 'none';
  if (!inMatch) return;

  const humanMult = (mod.settings && mod.settings.humanMultiplier) || 1000;
  const botMult   = (mod.settings && mod.settings.botMultiplier) || 1;
  const scaleBots = !!(mod.settings && mod.settings.scaleBotsToMe);

  /* Sample current interest for display */
  let myBaseInterest = 0;
  try {
    myBaseInterest = c.TT.af ? c.TT.af.aDb(c.humanIndex) : 0;
  } catch {}

  hudEl.innerHTML =
    '<div style="color:#10B981;font-weight:bold;margin-bottom:2px">💎 Infinite Interest</div>' +
    '<div>you × ' + humanMult + '</div>' +
    '<div>bots × ' + (scaleBots ? humanMult : botMult) + (scaleBots ? ' (matched)' : '') + '</div>' +
    '<div style="opacity:.7">tick income: ' + formatNum(myBaseInterest) + '</div>';
}

function formatNum(n) {
  n = Math.floor(n || 0);
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return String(n);
}

/* ------------------------------------------------------------
 * Boot
 * ------------------------------------------------------------ */
const iv = setInterval(() => {
  if (getGameContext()) {
    if (installOverride()) clearInterval(iv);
  }
}, 250);

/* Re-patch on screen change — the game may rebuild af between matches */
api.on('screenChanged', () => {
  patched = false;
  /* Unwrap so the next install re-wraps cleanly */
  const TT = api.getGame();
  if (TT && TT.af) delete TT.af.__iiWrapped;
  installOverride();
});

/* Re-apply immediately if the user changes a setting */
api.on('modSettingsChanged', (modId) => {
  if (modId === mod.id) {
    api.showToast(
      '💎 Interest: you ×' + (mod.settings.humanMultiplier || 1000) +
      ', bots ×' + (mod.settings.scaleBotsToMe ? 'matched' : (mod.settings.botMultiplier || 1))
    );
  }
});

if (mod.settings.showHud !== false) buildHud();

api.log('💎 Infinite Interest loaded — settings in the mod menu (F10 → ⚙️)');