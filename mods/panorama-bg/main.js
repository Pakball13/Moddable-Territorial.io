/* ============================================================
 * Panorama Background  v0.3.0
 * ------------------------------------------------------------
 * Scrollable panorama on the main menu, drawn INSIDE the menu
 * render pass (via the client's setMenuBackground hook) so the
 * game's own logo and buttons stay visible on top.
 *
 * Mouse X controls look direction with smooth easing.
 * Supports .png .jpg .jpeg .webp .exr (EXR via three.js CDN).
 * Falls back to a procedural starfield if no image is found.
 *
 * Console:
 *   const p = TerritorialMods.mods.get('panorama-bg');
 *   p.setEnabled(false);       // hide overlay
 *   p.reload();                // re-read image from disk
 *   p.info();                  // { enabled, panoPath, size, cropBand }
 *   p.setCropBand(0.5);        // 0.05 .. 1.0 vertical crop of source
 * ============================================================ */

let pano        = null;   // HTMLImageElement or HTMLCanvasElement
let panoPath    = null;
let panoSize    = null;   // [w, h]
let enabled     = true;
let cropBand    = 0.30;   // fraction of image height to display

let targetX     = 0;
let currentX    = 0;

/* ---------- input tracking ---------- */
api.addHook('mouseMove', e => { targetX = e.clientX; });
api.addHook('mouseDown', e => { targetX = e.clientX; });

/* ---------- procedural fallback ---------- */
function makeFallbackPano(W, H) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');

  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0.0, '#0a0a1a');
  sky.addColorStop(0.6, '#1a1a3a');
  sky.addColorStop(1.0, '#3a1a4a');
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);

  for (let i = 0; i < 500; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H * 0.65;
    const r = Math.random() * 1.4 + 0.3;
    g.fillStyle = `rgba(255,255,255,${Math.random() * 0.7 + 0.3})`;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }

  g.fillStyle = '#0a0a12';
  g.beginPath();
  g.moveTo(0, H);
  for (let x = 0; x <= W; x += 10) {
    const y = H - 180 - Math.sin(x / 320) * 90 - Math.sin(x / 80) * 30;
    g.lineTo(x, y);
  }
  g.lineTo(W, H);
  g.closePath();
  g.fill();

  const fog = g.createLinearGradient(0, H * 0.7, 0, H);
  fog.addColorStop(0, 'rgba(60, 40, 90, 0)');
  fog.addColorStop(1, 'rgba(60, 40, 90, 0.5)');
  g.fillStyle = fog;
  g.fillRect(0, H * 0.7, W, H * 0.3);

  return c;
}

/* ---------- EXR decoding via three.js (CDN) ---------- */
async function decodeEXR(url) {
  api.log('🧪 Decoding EXR via three.js …');
  const THREE = await import('https://esm.sh/three@0.160.0');
  const { EXRLoader } = await import('https://esm.sh/three@0.160.0/examples/jsm/loaders/EXRLoader.js');

  return new Promise((resolve, reject) => {
    new EXRLoader().load(url, tex => {
      try {
        const { width, height, data } = tex.image;   // Float32Array RGBA
        const c = document.createElement('canvas');
        c.width = width; c.height = height;
        const g = c.getContext('2d');
        const id = g.createImageData(width, height);
        const out = id.data;

        // Reinhard tonemap + gamma 2.2
        for (let i = 0, n = width * height; i < n; i++) {
          let r  = data[i * 4];
          let gg = data[i * 4 + 1];
          let b  = data[i * 4 + 2];
          r  = r  / (1 + r);
          gg = gg / (1 + gg);
          b  = b  / (1 + b);
          r  = Math.pow(r,  1 / 2.2);
          gg = Math.pow(gg, 1 / 2.2);
          b  = Math.pow(b,  1 / 2.2);
          out[i * 4]     = Math.min(255, r  * 255) | 0;
          out[i * 4 + 1] = Math.min(255, gg * 255) | 0;
          out[i * 4 + 2] = Math.min(255, b  * 255) | 0;
          out[i * 4 + 3] = 255;
        }
        g.putImageData(id, 0, 0);
        api.log(`🌄 EXR decoded ${width}×${height}`);
        resolve(c);
      } catch (e) { reject(e); }
    }, undefined, err => reject(err));
  });
}

/* ---------- loading ---------- */
async function loadPanorama() {
  pano = null; panoPath = null; panoSize = null;

  const rasterCandidates = [
    'assets/panorama.png',
    'assets/panorama.jpg',
    'assets/panorama.jpeg',
    'assets/panorama.webp'
  ];
  const exrCandidates = [
    'assets/panorama.exr',
    'assets/bg.exr'
  ];

  // 1) Try raster first — fast
  for (const p of rasterCandidates) {
    try {
      const img = await api.readModFile(mod, p, 'image');
      pano = img; panoPath = p;
      panoSize = [img.width, img.height];
      api.log(`🌄 Loaded ${p} (${img.width}×${img.height})`);
      api.showToast(`🌄 Panorama: ${p}`, 2000);
      return true;
    } catch { /* next */ }
  }

  // 2) Fall back to EXR
  for (const p of exrCandidates) {
    try {
      const head = await fetch(mod.basePath + p, { method: 'HEAD', cache: 'no-store' });
      if (!head.ok) continue;
      const canvas = await decodeEXR(mod.basePath + p);
      pano = canvas; panoPath = p;
      panoSize = [canvas.width, canvas.height];
      api.showToast(`🌄 EXR loaded: ${p}`, 2500);
      return true;
    } catch (e) {
      api.warn('EXR decode failed:', e);
    }
  }

  // 3) Nothing found — procedural
  api.warn('No panorama image found. Using procedural placeholder. Drop assets/panorama.{png,jpg,exr}.');
  pano = makeFallbackPano(4096, 1024);
  panoPath = '<procedural placeholder>';
  panoSize = [4096, 1024];
  api.showToast('🌄 Panorama: procedural placeholder', 2500);
  return false;
}
loadPanorama();

/* ---------- menu detection (kept for backward compat) ---------- */
function isOnMenu() {
  return !!document.querySelector('input#input0');
}

/* ---------- register with the client ----------
 * The client (modLoader.js v1.3+) calls this INSIDE the menu render
 * pass — before the game paints its logo and buttons — so nothing
 * gets covered.
 */
api.setMenuBackground((g, W, H) => {
  if (!enabled || !pano) return;

  // ease current X toward mouse X
  currentX += (targetX - currentX) * 0.08;

  // vertical crop of the source (equirect → wide band)
  const bandH  = Math.max(1, pano.height * cropBand);
  const bandY0 = (pano.height - bandH) / 2;

  // cover-fit the band to the screen
  const srcAspect = pano.width / bandH;
  const dstAspect = W / H;
  let drawW, drawH;
  if (srcAspect >= dstAspect) {
    drawH = H;
    drawW = H * srcAspect;
  } else {
    drawW = W;
    drawH = W / srcAspect;
  }
  const offsetY = (H - drawH) / 2;

  // horizontal scroll from mouse X
  const t = Math.max(0, Math.min(1, currentX / window.innerWidth));
  const maxScroll = Math.max(0, drawW - W);
  const scrollX = t * maxScroll;

  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.imageSmoothingEnabled = true;
  g.drawImage(pano, 0, bandY0, pano.width, bandH, -scrollX, offsetY, drawW, drawH);
  // dark vignette so the game's overlay looks natural
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fillRect(0, 0, W, H);
  g.restore();
});

/* ---------- public controls ---------- */
mod.setEnabled = v => {
  enabled = !!v;
  mod.enabled = enabled;
  api.showToast(`🌄 Panorama ${enabled ? 'enabled' : 'disabled'}`);
  api.log('Panorama enabled:', enabled);
};

mod.reload = () => loadPanorama();

mod.info = () => ({
  enabled,
  panoPath,
  size: panoSize,
  cropBand
});

mod.setCropBand = v => {
  cropBand = Math.max(0.05, Math.min(1, +v || 0.3));
  api.log('cropBand =', cropBand);
  api.showToast(`🌄 cropBand = ${cropBand}`);
};

api.log('🌄 Panorama Background v0.3 ready. Move mouse on the menu to look around.');
