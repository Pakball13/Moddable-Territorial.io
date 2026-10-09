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

let patched = false;

function tryPatch() {
  const TT = window.__TT__;
  if (!TT || !TT.aj || typeof TT.aj.a8 !== 'function') return false;
  if (TT.aj.__simpleNamesPatched) { patched = true; return true; }

  const aj = TT.aj;
  const orig = aj.a8.bind(aj);

  aj.a8 = function () {
    orig();
    const aE = TT.aE;
    if (!aE || !aE.data) return;
    if (aE.data.playerNamesType === 2) return;
    const ah = TT.ah;
    if (!ah || !ah.a0j) return;

    const offset = Math.floor(Math.random() * SIMPLE_NAMES.length);
    let count = 0;
    for (let i = aE.ku; i < aE.fW; i++) {
      if (ah.nU[i] === 0) continue;
      const n = SIMPLE_NAMES[(i + offset) % SIMPLE_NAMES.length];
      ah.a0j[i] = n;
      ah.a2w[i] = n;
      count++;
    }
    if (count > 0)
      api.showToast(`🔧 Simple Name Bots — renamed ${count} bot${count === 1 ? '' : 's'}`);
  };

  aj.__simpleNamesPatched = true;
  patched = true;
  api.log(`Patched (${SIMPLE_NAMES.length} names ready).`);
  return true;
}

if (!tryPatch()) {
  const iv = setInterval(() => { if (tryPatch()) clearInterval(iv); }, 100);
  setTimeout(() => clearInterval(iv), 30000);
}
api.addHook('postUpdate', () => { if (!patched) tryPatch(); });