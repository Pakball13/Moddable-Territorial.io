/* ============================================================
 * Panorama Background  v0.1.0
 * ------------------------------------------------------------
 * Overlays a scrollable panorama on the main menu, drawn after
 * every game frame. Mouse X controls the look direction with
 * smooth easing (Minecraft-style).
 *
 * Console controls:
 *   TerritorialMods.mods.get('panorama-bg').setEnabled(false)
 *   TerritorialMods.mods.get('panorama-bg').reload()
 * ============================================================ */

let pano        = null;      // HTMLImageElement (or canvas)
let panoPath    = null;      // string, path we loaded, for logging
let enabled     = true;

let targetX     = 0;         // raw mouse X, screen space
let currentX    = 0;         // eased toward targetX each frame

/* ---- input tracking ------------------------------------- */
api.addHook('mouseMove', e => { targetX = e.clientX; });
api.addHook('mouseDown', e => { targetX = e.clientX; });

/* ---- procedural fallback (so it works with zero images) --- */
function makeFallbackPano(W, H) {
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');

  // Sky gradient
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0.0, '#0a0a1a');
  sky.addColorStop(0.6, '#1a1a3a');
  sky.addColorStop(1.0, '#3a1a4a');
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);

  // Stars
  for (let i = 0; i < 500; i++) {
    const x = Math.random() * W;
    const y = Math.random() * H * 0.65;
    const r = Math.random() * 1.4 + 0.3;
    g.fillStyle = `rgba(255,255,255,${Math.random() * 0.7 + 0.3})`;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }

  // Distant hills (silhouette)
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

  // Mid-ground fog band
  const fog = g.createLinearGradient(0, H * 0.7, 0, H);
  fog.addColorStop(0, 'rgba(60, 40, 90, 0)');
  fog.addColorStop(1, 'rgba(60, 40, 90, 0.5)');
  g.fillStyle = fog;
  g.fillRect(0, H * 0.7, W, H * 0.3);

  return c;
}

/* ---- loading ------------------------------------------- */
async function loadPanorama() {
  pano = null; panoPath = null;

  const candidates = [
    'assets/panorama.png',
    'assets/panorama.jpg',
    'assets/panorama.jpeg',
    'assets/panorama.webp',
    'assets/bg.png',
    'assets/bg.jpg'
  ];

  for (const p of candidates) {
    try {
      pano = await api.readModFile(mod, p, 'image');
      panoPath = p;
      api.log(`🌄 Loaded ${p} (${pano.width}×${pano.height})`);
      api.showToast(`🌄 Panorama loaded: ${p}`, 2000);
      return true;
    } catch { /* try next */ }
  }

  api.warn('No image in assets/ — using procedural placeholder. Drop panorama.png/jpg to customize.');
  pano = makeFallbackPano(4096, 1024);
  panoPath = '<procedural placeholder>';
  return false;
}
loadPanorama();

/* ---- menu detection ------------------------------------ */
function isOnMenu() {
  // The main menu has the "Your Kingdom's Name" input box
  return !!document.querySelector('input#input0');
}

/* ---- draw every frame, on top of the game ---------------- */
api.addHook('postUpdate', () => {
  if (!enabled || !pano) return;
  if (!isOnMenu()) return;

  const c = api.getGameCanvas();
  if (!c) return;
  const g = c.getContext('2d');
  const W = c.width, H = c.height;

  // Ease the current view toward the mouse target
  currentX += (targetX - currentX) * 0.08;

  // Cover-fit the image to the screen (like background-size:cover)
  const scaleH = H / pano.height;
  const scaleW = W / pano.width;
  const scale  = Math.max(scaleH, scaleW);
  const scaledW = pano.width  * scale;
  const scaledH = pano.height * scale;

  // Panoramic scroll: mouse X across the window → 0..1 of the extra width
  const t = Math.max(0, Math.min(1, currentX / window.innerWidth));
  const maxScroll = Math.max(0, scaledW - W);
  const scrollX = t * maxScroll;

  // Center vertically if the image is taller than the screen
  const offsetY = (H - scaledH) / 2;

  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.imageSmoothingEnabled = true;
  g.drawImage(pano, -scrollX, offsetY, scaledW, scaledH);
  g.restore();
});

/* ---- public controls ------------------------------------ */
mod.setEnabled = v => {
  enabled = !!v;
  mod.enabled = enabled;
  api.showToast(`🌄 Panorama ${enabled ? 'enabled' : 'disabled'}`);
  api.log('Panorama enabled:', enabled);
};
mod.reload = async () => { await loadPanorama(); };
mod.info   = () => ({ enabled, panoPath, size: pano ? [pano.width, pano.height] : null });

api.log('🌄 Panorama Background ready. Move mouse on the menu to look around.');