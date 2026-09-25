// Decides whether the hero's three.js brain (Brain3D.astro) is worth loading.
// three.js is ~527 KB minified (~135 KB gzipped), so it is fetched only when
// the brain will actually animate.

/**
 * @param {object} env
 * @param {boolean} env.reducedMotion  prefers-reduced-motion: reduce
 * @param {boolean} env.saveData       navigator.connection.saveData
 * @param {number}  env.viewportWidth  window.innerWidth in CSS px
 * @param {number}  [env.minWidth]     skip below this width; 0 = never skip
 */
export function shouldLoadBrain3D({ reducedMotion, saveData, viewportWidth, minWidth = 0 }) {
  if (reducedMotion) return false; // the scene would render one still frame
  if (saveData) return false;
  if (minWidth > 0 && !(viewportWidth >= minWidth)) return false;
  return true;
}

/** Parses the optional PUBLIC_BRAIN3D_MIN_WIDTH build variable; anything invalid means 0. */
export function parseMinWidth(raw) {
  const n = Number.parseInt(String(raw ?? ''), 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}
