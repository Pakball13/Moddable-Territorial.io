/* Simple Name Bots — v1.1.0
 * Primary: patches aj.a8 (name generator).
 * Fallback: re-applies names every 10 frames in case the game overwrites them.
 */

const SIMPLE_NAMES = [
  'bob','john','joa','zack','bobir','jimmy','dave','steve','alex','sam',
  'max','leo','tom','ben','rob','kim','joe','dan','tim','greg','carl',
  'tony','frank','hank','pete','mike','rick','chuck','buck','larry',
  'gary','kyle','ryan','sean','brian','kevin','ur mom','ur dad',
  'your mom','your dad','the mailman','uncle greg','sussy','baka',
  'yikes','oof','yeet','bruh','noob','pro','god','bot','player','guest',
  'lol','xd','uwu','based','anonymous','subject 12','test bot',
  'not a bot','definitely real'
];

function applyNames() {
  const TT = window.__TT__;
  if (!TT || !TT.aE || !TT.ah) return 0;
  const { aE, ah } = TT;
  if (aE.a2G !== 1) return 0;                 // not actively in a game
  if (aE.data && aE.data.playerNamesType === 2) return 0; // custom names
  if (!ah.a0j || !ah.a2w) return 0;

  let changed = 0;
  for (let i = aE.ku; i < aE.fW; i++) {
    if (ah.nU[i] === 0) continue;
    const target = SIMPLE_NAMES[(i - aE.ku) % SIMPLE_NAMES.length];
    if (ah.a0j[i] !== target) { ah.a0j[i] = target; changed++; }
    if (ah.a2w[i] !== target) { ah.a2w[i] = target; }
  }
  return changed;
}

function patchNameGen() {
  const TT = window.__TT__;
  if (!TT || !TT.aj) return false;
  if (TT.aj.__simplePatched) return true;
  if (typeof TT.aj.a8 !== 'function') return false;

  const orig = TT.aj.a8.bind(TT.aj);
  TT.aj.a8 = function () {
    orig();
    try { applyNames(); } catch (e) { api.error('applyNames', e); }
  };
  TT.aj.__simplePatched = true;
  api.log('✅ Patched aj.a8');
  return true;
}

// keep trying to patch until it works
const iv = setInterval(() => {
  if (patchNameGen()) clearInterval(iv);
}, 200);
setTimeout(() => clearInterval(iv), 30000);
patchNameGen();

// belt & braces: re-apply names every ~10 frames
let frames = 0;
let toasted = false;
api.addHook('postUpdate', () => {
  if (++frames < 10) return;
  frames = 0;
  const changed = applyNames();
  if (changed > 0 && !toasted) {
    toasted = true;
    api.showToast(`🔧 Simple Name Bots active`);
  }
});

// reset toast on new game
api.addHook('postUpdate', () => {
  const TT = window.__TT__;
  if (TT && TT.aE && TT.aE.a2G === 0) toasted = false;
});

api.log('🔧 Simple Name Bots v1.1 loaded.');