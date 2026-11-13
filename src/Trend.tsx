import { useRef, useState } from 'react';
import { monotonePath } from './lib/chart';

export interface TrendPoint { ts: number; value: number; label: string }

const W = 320, H = 140, PX = 10, PY = 14;

/**
 * One chart for Health and Finance: smooth line, small dots, dashed average and target/budget lines.
 * Hover (mouse) or touch anywhere over the chart to read the date and value of the nearest point.
 */
export function TrendChart({ points, format, ariaLabel, average, reference, referenceName = 'Target', zeroBased = false, pad }: {
  points: TrendPoint[]; format: (v: number) => string; ariaLabel: string;
  average?: number; reference?: number | null; referenceName?: string; zeroBased?: boolean; pad?: number;
}) {
  const [active, setActive] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  if (!points.length) return <div className="sub">Nothing recorded in this period yet.</div>;

  const vals = points.map((p) => p.value);
  const all = [...vals, ...(average !== undefined ? [average] : []), ...(reference ? [reference] : [])];
  let lo = Math.min(...all), hi = Math.max(...all);
  if (zeroBased) { lo = 0; hi = hi * 1.15 || 1; }
  else { const m = pad ?? ((hi - lo) * 0.15 || 1); lo -= m; hi += m; }
  const span = hi - lo || 1;
  const t0 = points[0].ts, dt = Math.max(points[points.length - 1].ts - t0, 86400000);
  const X = (ts: number) => (points.length === 1 ? W / 2 : PX + ((ts - t0) / dt) * (W - 2 * PX));
  const Y = (v: number) => PY + (1 - (v - lo) / span) * (H - 2 * PY);
  const nodes = points.map((p) => ({ ...p, x: X(p.ts), y: Y(p.value) }));

  const pick = (clientX: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r || !r.width) return;
    const x = ((clientX - r.left) / r.width) * W;
    let best = 0;
    nodes.forEach((n, i) => { if (Math.abs(n.x - x) < Math.abs(nodes[best].x - x)) best = i; });
    setActive(best);
  };
  const a = active !== null ? nodes[Math.min(active, nodes.length - 1)] : null;

  return (
    <div className="stack" style={{ gap: 8 }}>
      <div
        ref={box}
        style={{ aspectRatio: `${W} / ${H}`, position: 'relative', width: '100%', touchAction: 'pan-y' }}
        onPointerMove={(e) => pick(e.clientX)}
        onPointerDown={(e) => pick(e.clientX)}
        onPointerLeave={(e) => { if (e.pointerType === 'mouse') setActive(null); }}
      >
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={ariaLabel} style={{ width: '100%', height: '100%', overflow: 'visible' }}>
          {average !== undefined && <line x1={PX} y1={Y(average)} x2={W - PX} y2={Y(average)} stroke="var(--green)" strokeWidth="1.5" strokeDasharray="5 4" />}
          {reference ? <line x1={PX} y1={Y(reference)} x2={W - PX} y2={Y(reference)} stroke="var(--orange)" strokeWidth="1.5" strokeDasharray="2 4" strokeLinecap="round" /> : null}
          {a && <line x1={a.x} y1={PY - 6} x2={a.x} y2={H - PY + 6} stroke="var(--muted)" strokeWidth="1" opacity="0.5" />}
          <path d={monotonePath(nodes)} fill="none" stroke="var(--blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {nodes.map((n, i) => <circle key={i} cx={n.x} cy={n.y} r={a === n ? 4.5 : nodes.length > 14 ? 1.8 : 2.5} fill="var(--blue)" />)}
        </svg>
        {a && (
          <div role="status" data-testid="trend-tip" style={{
            position: 'absolute', left: `${Math.min(88, Math.max(12, (a.x / W) * 100))}%`, top: `${(a.y / H) * 100}%`, transform: 'translate(-50%, -135%)',
            background: 'var(--text)', color: 'var(--bg)', padding: '4px 8px', borderRadius: 6, fontSize: 12, pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 10,
            boxShadow: '0 2px 8px rgba(0,0,0,0.25)', textAlign: 'center',
          }}>
            <strong>{format(a.value)}</strong><br /><span style={{ opacity: 0.8, fontSize: 10 }}>{a.label}</span>
          </div>
        )}
      </div>
      <div className="chart-legend">
        <span className="legend-item"><span className="legend-line blue" /> Logged</span>
        {average !== undefined && <span className="legend-item"><span className="legend-line green dashed" /> Average ({format(average)})</span>}
        {reference ? <span className="legend-item"><span className="legend-line orange dashed" /> {referenceName} ({format(reference)})</span> : null}
      </div>
    </div>
  );
}

/** Same list under both charts: newest first, a few rows, then "Show all". */
export function HistoryList({ rows, empty }: { rows: { key: string; label: string; value: string; sub?: string }[]; empty: string }) {
  const [all, setAll] = useState(false);
  if (!rows.length) return <div className="sub">{empty}</div>;
  const shown = all ? rows : rows.slice(0, 5);
  return (
    <div className="stack" style={{ gap: 8 }}>
      {shown.map((r) => (
        <div className="row between" key={r.key}>
          <div className="stack" style={{ gap: 0 }}>
            <span>{r.label}</span>
            {r.sub && <span className="sub">{r.sub}</span>}
          </div>
          <strong>{r.value}</strong>
        </div>
      ))}
      {rows.length > 5 && <button type="button" className="btn secondary small" onClick={() => setAll(!all)}>{all ? 'Show fewer' : `Show all (${rows.length})`}</button>}
    </div>
  );
}
