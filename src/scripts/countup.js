// Count-up math for the landing metrics (Metrics.astro).
//
// The animation clock is anchored to the first requestAnimationFrame
// timestamp, not to performance.now(), and progress is clamped to [0, 1].
// Headless renderers (Firecrawl, crawlers that run JS) can hand rAF a
// timestamp over a second earlier than performance.now(), which made the
// old code print values like "-1249.8% Uptime".

export const COUNTUP_MS = 1400;

/** Animation progress in [0, 1] at frame time `t` for a run whose first frame was `t0`. */
export function countupProgress(t, t0, dur = COUNTUP_MS) {
  if (!(dur > 0)) return 1;
  const p = (t - t0) / dur;
  if (!(p > 0)) return 0;
  return p < 1 ? p : 1;
}

/** Ease-out quart: 0 -> 0, 1 -> 1, monotonic in between. */
export function easeOutQuart(p) {
  return 1 - Math.pow(1 - p, 4);
}
