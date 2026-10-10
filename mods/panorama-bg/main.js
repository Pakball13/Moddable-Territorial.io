/* ============================================================
 * Panorama Background  v0.4.0
 * ============================================================ */

let pano     = null;
let panoPath = null;
let panoSize = null;
let enabled  = true;
let cropBand = 0.30;

let targetX  = 0;
let currentX = 0;

/* ---------- input ---------- */
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
  g.fillStyle = sky; g.fillRect(0, 0, W, H);
  for (let i = 0; i < 500; i++) {
    const x = Math.random() * W, y = Math.random() * H * 0.65;
    const r = Math.random() * 1.4 + 0.3;
    g.fillStyle = `rgba(255,255,255,${Math.random() * 0.7 + 0.3})`;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = '#0a0a12'; g.beginPath(); g.moveTo(0, H);
  for (let x = 0; x <= W; x += 10) {
    g.lineTo(x, H - 180 - Math.sin(x / 320) * 90 - Math.sin(x / 80) * 30);
  }
  g.lineTo(W, H); g.closePath(); g.fill();
  return c;
}

/* ---------- EXR (via three.js CDN) ---------- */
async function decodeEXR(url) {
  api.log('🧪 Decoding EXR via three.js …');
  await import('https://esm.sh/three@0.160.0');
  const { EXRLoader } = await import('https://esm.sh/three@0.160.0/examples/jsm/loaders/EXRLoader.js');
  return new Promise((resolve, reject) => {
    new EXRLoader().load(url, tex => {
      try {
        const { width, height, data } = tex.image;
        const c = document.createElement('canvas');
        c.width = width; c.height = height;
        const g = c.getContext('2d');
        const id = g.createImageData(width, height);
        const out = id.data;
        for (let i = 0, n = width * height; i < n; i++) {
          let r  = data[i*4],   gg = data[i*4+1], b = data[i*4+2];
          r  = Math.pow(r  / (1 + r),  1/2.2);
          gg = Math.pow(gg / (1 + gg), 1/2.2);
          b  = Math.pow(b  / (1 + b),  1/2.2);
          out[i*4]   = Math.min(255, r  * 255) | 0;
          out[i*4+1] = Math.min(255, gg * 255) | 0;
          out[i*4+2] = Math.min(255, b  * 255) | 0;
          out[i*4+3] = 255;
        }
        g.putImageData(id, 0, 0);
        resolve(c);
      } catch (e) { reject(e); }
    }, undefined, err => reject(err));
  });
}

/* ---------- loading ---------- */
async function loadPanorama() {
  pano = null; panoPath = null; panoSize = null;
  const rasters = ['assets/panorama.png','assets/panorama.jpg','assets/panorama.jpeg','assets/panorama.webp'];
  const exrs    = ['assets/panorama.exr','assets/bg.exr'];

  for (const p of rasters) {
    try {
      const img = await api.readModFile(mod, p, 'image');
      pano = img; panoPath = p; panoSize = [img.width, img.height];
      api.log(`🌄 Loaded ${p} (${img.width}×${img.height})`);
      api.showToast(`🌄 Panorama: ${p}`, 2000);
      return true;
    } catch {}
  }
  for (const p of exrs) {
    try {
      const h = await fetch(mod.basePath + p, { method:'HEAD', cache:'no-store' });
      if (!h.ok) continue;
      const cv = await decodeEXR(mod.basePath + p);
      pano = cv; panoPath = p; panoSize = [cv.width, cv.height];
      api.showToast(`🌄 EXR loaded: ${p}`, 2500);
      return true;
    } catch (e) { api.warn('EXR decode failed:', e); }
  }
  api.warn('No panorama image found. Using procedural placeholder.');
  pano = makeFallbackPano(4096, 1024);
  panoPath = '<procedural placeholder>';
  panoSize = [4096, 1024];
  api.showToast('🌄 Panorama: procedural placeholder', 2500);
  return false;
}
loadPanorama();

/* ---------- menu detection ---------- */
function isOnMenu() {
  return !!document.querySelector('input#input0');
}

/* ---------- draw ---------- */
function drawPanorama(g, W, H) {
  currentX += (targetX - currentX) * 0.08;

  const bandH  = Math.max(1, pano.height * cropBand);
  const bandY0 = (pano.height - bandH) / 2;

  const srcAspect = pano.width / bandH;
  const dstAspect = W / H;
  let drawW, drawH;
  if (srcAspect >= dstAspect) { drawH = H; drawW = H * srcAspect; }
  else                        { drawW = W; drawH = W / srcAspect; }
  const offsetY = (H - drawH) / 2;

  const t = Math.max(0, Math.min(1, currentX / window.innerWidth));
  const maxScroll = Math.max(0, drawW - W);
  const scrollX = t * maxScroll;

  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = 1;
  g.imageSmoothingEnabled = true;
  g.drawImage(pano, 0, bandY0, pano.width, bandH, -scrollX, offsetY, drawW, drawH);
  g.fillStyle = 'rgba(0,0,0,0.30)';
  g.fillRect(0, 0, W, H);
  g.restore();
}

/* postUpdate fires AFTER the game has finished drawing the frame,
 * so this covers the entire canvas — no more black void. */
api.addHook('postUpdate', () => {
  if (!enabled || !pano) return;
  if (!isOnMenu()) return;
  const c = api.getGameCanvas();
  if (!c) return;
  drawPanorama(c.getContext('2d'), c.width, c.height);
});

/* ---------- controls ---------- */
mod.setEnabled = v => {
  enabled = !!v; mod.enabled = enabled;
  api.showToast(`🌄 Panorama ${enabled ? 'enabled' : 'disabled'}`);
};
mod.reload = () => loadPanorama();
mod.info = () => ({ enabled, panoPath, size: panoSize, cropBand });
mod.setCropBand = v => {
  cropBand = Math.max(0.05, Math.min(1, +v || 0.3));
  api.showToast(`🌄 cropBand = ${cropBand}`);
};

api.log('🌄 Panorama Background v0.4 ready (postUpdate mode).');
