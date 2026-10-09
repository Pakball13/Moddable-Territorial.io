api.log(`[${mod.name}] main.js running`);

api.addButton('👍 Example', () => api.showToast('Hello from Example Mod!'));

/* Only draw to the main game canvas so we don't paint on offscreen ones */
api.addHook('postUpdate', () => {
  const c = api.getGameCanvas();
  if (!c) return;
  const g = c.getContext('2d');
  g.save();
  g.fillStyle = 'rgba(255,0,0,0.9)';
  g.fillRect(4, 4, 12, 12);
  g.restore();
});