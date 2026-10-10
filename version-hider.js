/* ============================================================
 * version-hider.js — hides the game's version string
 * "25 Sep 2026 [2.16.54]" and similar
 * ============================================================ */
(function () {
  'use strict';

  if (window.__ttVersionHider) return;
  window.__ttVersionHider = true;

  const ctx = CanvasRenderingContext2D.prototype;
  const origFillText = ctx.fillText;

  /* Matches:  DD Mon YYYY [ ... ]
   * No leading ^ so it works even if the game prepends something. */
  const VERSION_RE = /\d{1,2}\s+\w{3,}\s+\d{4}\s*\[/;

  ctx.fillText = function (text, x, y, maxWidth) {
    if (typeof text === 'string') {
      if (VERSION_RE.test(text)) return;
      /* Extra safety: catch the specific Sep 2026 variant */
      if (text.indexOf('Sep 2026') !== -1) return;
      /* Catch generic "DD Mon YYYY" strings the game might draw */
      if (/^\s*\d{1,2}\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{4}/.test(text)) return;
    }
    return maxWidth !== undefined
      ? origFillText.call(this, text, x, y, maxWidth)
      : origFillText.call(this, text, x, y);
  };

  console.log('%c[VersionHider]', 'color:#fa9;font-weight:bold', 'Version text will be hidden');
})();