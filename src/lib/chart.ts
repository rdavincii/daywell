export interface Pt { x: number; y: number }

/**
 * Smooth SVG path through points (Fritsch-Carlson monotone cubic): curves, but never overshoots
 * between readings, so a weight line can't dip below a value that wasn't logged.
 */
export function monotonePath(input: Pt[]): string {
  const p = input.filter((q, i) => Number.isFinite(q.x) && Number.isFinite(q.y) && (i === 0 || q.x > input[i - 1].x));
  const f = (n: number) => +n.toFixed(2);
  if (p.length === 0) return '';
  if (p.length === 1) return `M${f(p[0].x)},${f(p[0].y)}`;
  const d = p.slice(1).map((q, i) => (q.y - p[i].y) / (q.x - p[i].x)); // segment slopes
  const m = p.map((_, i) => (i === 0 ? d[0] : i === p.length - 1 ? d[i - 1] : d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2));
  d.forEach((s, i) => {
    if (s === 0) { m[i] = 0; m[i + 1] = 0; return; }
    const a = m[i] / s, b = m[i + 1] / s, h = Math.hypot(a, b);
    if (h > 3) { m[i] = (3 * a / h) * s; m[i + 1] = (3 * b / h) * s; }
  });
  let out = `M${f(p[0].x)},${f(p[0].y)}`;
  for (let i = 0; i < p.length - 1; i++) {
    const w = (p[i + 1].x - p[i].x) / 3;
    out += `C${f(p[i].x + w)},${f(p[i].y + m[i] * w)} ${f(p[i + 1].x - w)},${f(p[i + 1].y - m[i + 1] * w)} ${f(p[i + 1].x)},${f(p[i + 1].y)}`;
  }
  return out;
}
