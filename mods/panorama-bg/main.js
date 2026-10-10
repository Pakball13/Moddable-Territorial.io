/* ============================================================
 * Panorama Background  v1.0.0
 *  • Loads a user image (png/jpg/webp/exr)
 *  • OR uses the game's own map as a scrolling panorama
 *  • OR falls back to a procedural starfield
 *  • Draws INSIDE the menu render pass so nothing covers it
 * ============================================================ */

let pano     = null;       // HTMLImageElement or HTMLCanvasElement
let panoPath = null;       // human-readable source
let enabled  = true;
let cropBand = 0.30;       // fraction of source height to use

let targetX  = 0;          // smoothed mouse X (0..1)
let currentX = 0.5;

/* ============================================================
 * INPUT
 * ============================================================ */
api.addHook('mouseMove', e => { targetX = e.clientX / window.innerWidth; });
api.addHook('mouseDown', e => { targetX = e.clientX / window.innerWidth; });

/* ============================================================
 * FALLBACK: PROCEDURAL STARFIELD
 * ============================================================ */
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
    g.fillStyle = `rgba(255,255,255,${Math.random() * 0.7 + 0.3})`;
    g.beginPath();
    g.arc(Math.random() * W, Math.random() * H * 0.65, Math.random() * 1.4 + 0.3, 0, Math.PI * 2);
    g.fill();
  }
  g.fillStyle = '#0a0a12';
  g.beginPath();
  g.moveTo(0, H);
  for (let x = 0; x <= W; x += 10) {
    g.lineTo(x, H - 180 - Math.sin(x / 320) * 90 - Math.sin(x / 80) * 30);
  }
  g.lineTo(W, H);
  g.closePath();
  g.fill();
  return c;
}

/* ============================================================
 * CAPTURE THE GAME'S OWN MAP AS A PANORAMA SOURCE
 * ============================================================ */
function captureGameMap() {
  const c = api.getGameCanvas();
  if (!c || c.width < 200 || c.height < 200) return null;
  const cap = document.createElement('canvas');
  cap.width = c.width;
  cap.height = c.height;
  const g = cap.getContext('2d');
  g.drawImage(c, 0, 0);
  return cap;
}

async function tryCaptureGameMap(maxWaitMs = 10000) {
  const start = performance.now();
  while (performance.now() - start < maxWaitMs) {
    /* Only capture when the main menu is actually showing */
    if (api.isInLobby()) {
      const cap = captureGameMap();
      if (cap) {
        api.log('🎬 Captured game map for panorama');
        return cap;
      }
    }
    await new Promise(r => setTimeout(r, 250));
  }
  return null;
}

/* ============================================================
 * LOAD PANORAMA
 * ============================================================ */
async function loadPanorama() {
  pano = null;
  panoPath = null;

  /* ---- 1. User image ---- */
  const rasters = [
    'assets/panorama.png',
    'assets/panorama.jpg',
    'assets/panorama.jpeg',
    'assets/panorama.webp'
  ];
  for (const p of rasters) {
    try {
      const img = await api.readModFile(mod, p, 'image');
      pano = img;
      panoPath = p;
      api.log(`🌄 Loaded user image: ${p} (${img.width}×${img.height})`);
      api.showToast(`🌄 Panorama: ${p}`, 2000);
      return true;
    } catch (e) {
      api.log(`Skipped ${p} (${e.message || e})`);
    }
  }

  /* ---- 2. EXR (via three.js from CDN) ---- */
  try {
    const head = await fetch(mod.basePath + 'assets/panorama.exr', { method: 'HEAD', cache: 'no-store' });
    if (head.ok) {
      api.log('🧪 Decoding EXR via three.js…');
      await import('https://esm.sh/three@0.160.0');
      const { EXRLoader } = await import('https://esm.sh/three@0.160.0/examples/jsm/loaders/EXRLoader.js');
      const canvas = await new Promise((resolve, reject) => {
        new EXRLoader().load(mod.basePath + 'assets/panorama.exr', tex => {
          try {
            const { width, height, data } = tex.image;
            const c = document.createElement('canvas');
            c.width = width; c.height = height;
            const g = c.getContext('2d');
            const id = g.createImageData(width, height);
            const out = id.data;
            for (let i = 0, n = width * height; i < n; i++) {
              let r = data[i * 4], gg = data[i * 4 + 1], b = data[i * 4 + 2];
              r = Math.pow(r / (1 + r), 1 / 2.2);
              gg = Math.pow(gg / (1 + gg), 1 / 2.2);
              b = Math.pow(b / (1 + b), 1 / 2.2);
              out[i * 4] = Math.min(255, r * 255) | 0;
              out[i * 4 + 1] = Math.min(255, gg * 255) | 0;
              out[i * 4 + 2] = Math.min(255, b * 255) | 0;
              out[i * 4 + 3] = 255;
            }
            g.putImageData(id, 0, 0);
            resolve(c);
          } catch (e) { reject(e); }
        }, undefined, err => reject(err));
      });
      pano = canvas;
      panoPath = 'assets/panorama.exr';
      api.log(`🌄 EXR decoded ${canvas.width}×${canvas.height}`);
      api.showToast('🌄 Panorama: EXR', 2500);
      return true;
    }
  } catch (e) { api.warn('EXR load failed:', e); }

  /* ---- 3. Game's own map ---- */
  api.log('🎬 Trying to capture game map…');
  const mapCap = await tryCaptureGameMap(6000);
  if (mapCap) {
    pano = mapCap;
    panoPath = '<game map>';
    api.showToast('🎬 Using game map as panorama', 2500);
    return true;
  }

  /* ---- 4. Procedural fallback ---- */
  api.warn('No image found. Using procedural placeholder.');
  pano = makeFallbackPano(4096, 1024);
  panoPath = '<procedural>';
  api.showToast('🌄 Panorama: procedural placeholder', 2500);
  return false;
}

loadPanorama();

/* ============================================================
 * DRAW — registered as the menu background
 * Runs INSIDE the game's menu render (via setMenuBackground)
 * ============================================================ */
api.setMenuBackground((g, W, H) => {
  if (!enabled || !pano) return;

  /* Smooth easing toward mouse target */
  currentX += (targetX - currentX) * 0.08;

  /* Vertical crop of the source */
  const bandH  = Math.max(1, pano.height * cropBand);
  const bandY0 = (pano.height - bandH) / 2;

  /* Cover-fit the band to the screen */
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

  /* Horizontal scroll from smoothed mouse X */
  const maxScroll = Math.max(0, drawW - W);
  const scrollX = currentX * maxScroll;

  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.imageSmoothingEnabled = true;
  g.drawImage(pano, 0, bandY0, pano.width, bandH, -scrollX, offsetY, drawW, drawH);
  /* Dim overlay so UI is readable */
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fillRect(0, 0, W, H);
  g.restore();
});

/* ============================================================
 * PUBLIC API
 * ============================================================ */
mod.setEnabled = v => {
  enabled = !!v;
  api.showToast(`🌄 Panorama ${enabled ? 'enabled' : 'disabled'}`);
};
mod.reload = () => loadPanorama();
mod.info = () => ({ enabled, panoPath, cropBand });
mod.setCropBand = v => {
  cropBand = Math.max(0.05, Math.min(1, +v || 0.3));
  api.showToast(`🌄 cropBand = ${cropBand}`);
};

api.log('🌄 Panorama Background v1.0 ready');