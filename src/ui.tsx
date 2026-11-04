import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { usePresence, useSettledValue } from './motion';

/** Starts closed and flips to open right after the first layout, so the CSS transition has a start state. */
function useEntered(ref: React.RefObject<HTMLElement>): boolean {
  const [entered, setEntered] = useState(false);
  useLayoutEffect(() => {
    void ref.current?.getBoundingClientRect(); // commit the closed styles before opening
    setEntered(true);
  }, [ref]);
  return entered;
}

/**
 * Bottom sheet. Parents keep it mounted for the exit with usePresence and pass `closing`.
 * Opening and closing are transitions on data-state, so they can be interrupted without restarting.
 */
export function Sheet({ title, onClose, closing = false, children }: { title: string; onClose: () => void; closing?: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const entered = useEntered(backdropRef);
  const closeRef = useRef(onClose);
  closeRef.current = onClose; // stable effect: a new onClose each render must not re-run focus handling
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current();
    document.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, []);
  const inertProps = closing ? ({ inert: '' } as Record<string, string>) : {};
  return (
    <div
      className="backdrop"
      ref={backdropRef}
      data-state={entered && !closing ? 'open' : 'closed'}
      aria-hidden={closing || undefined}
      {...inertProps}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <div className="sheet-head">
          <h2>{title}</h2>
          <button className="btn secondary small" onClick={onClose}>Close</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ToastBody({ text, exiting }: { text: string; exiting: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const entered = useEntered(ref);
  return (
    <div className="notice toast" role="status" ref={ref} data-state={entered && !exiting ? 'open' : 'closed'}>
      {text}
    </div>
  );
}

/** Slides up from the bottom and leaves the same way. A new message swaps text in place. */
export function Toast({ message }: { message: string | null }) {
  const { value, exiting } = usePresence(message, 200);
  return value === null ? null : <ToastBody text={value} exiting={exiting} />;
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: readonly T[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o} type="button" aria-pressed={value === o} onClick={() => onChange(o)}>
          {o[0].toUpperCase() + o.slice(1)}
        </button>
      ))}
    </div>
  );
}

export function Field({ label, children, full }: { label: string; children: ReactNode; full?: boolean }) {
  return (
    <label className={'field' + (full ? ' full' : '')}>
      <span>{label}</span>
      {children}
    </label>
  );
}

export function ProgressBar({ value, max, tone, id }: { value: number; max: number; tone?: 'green' | 'orange' | 'red'; id?: string }) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const auto = tone ?? (max > 0 && value > max ? 'red' : max > 0 && value >= max * 0.8 ? 'orange' : undefined);
  // `id` lets the bar remember the last value you saw and animate from it when the screen remounts.
  const shown = useSettledValue(id && 'bar:' + id, pct);
  return (
    <div className={'bar ' + (auto ?? '')} role="progressbar" aria-valuemin={0} aria-valuemax={max} aria-valuenow={Math.min(value, max)}>
      <span style={{ clipPath: `inset(0 ${(100 - shown).toFixed(2)}% 0 0 round 99px)` }} />
    </div>
  );
}

export function Ring({ value, max, children, id }: { value: number; max: number; children: ReactNode; id?: string }) {
  const r = 56;
  const c = 2 * Math.PI * r;
  const pct = max > 0 ? Math.min(1, value / max) : 0;
  const over = max > 0 && value > max;
  const shown = useSettledValue(id && 'ring:' + id, pct);
  return (
    <div className="ringwrap">
      <svg viewBox="0 0 132 132" width="132" height="132" aria-hidden="true">
        <circle cx="66" cy="66" r={r} fill="none" stroke="var(--fill)" strokeWidth="12" />
        <circle
          className="ring-fg"
          cx="66" cy="66" r={r} fill="none" strokeWidth="12" strokeLinecap="round"
          style={{ stroke: over ? 'var(--orange)' : 'var(--green)', strokeDasharray: `${c * shown} ${c}` }}
          transform="rotate(-90 66 66)"
        />
      </svg>
      <div className="mid">{children}</div>
    </div>
  );
}

const p = { width: 24, height: 24, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;
export const Icons = {
  home: <svg {...p}><path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></svg>,
  list: <svg {...p}><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01" /></svg>,
  heart: <svg {...p}><path d="M12 21s-7-4.5-9.3-9A5.3 5.3 0 0 1 12 6.6 5.3 5.3 0 0 1 21.3 12C19 16.5 12 21 12 21z" /></svg>,
  wallet: <svg {...p}><path d="M3 7a2 2 0 0 1 2-2h13v4" /><rect x="3" y="7" width="18" height="13" rx="2" /><path d="M16 13.5h.01" /></svg>,
  gear: <svg {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></svg>,
  mic: <svg {...p}><rect x="9" y="3" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></svg>,
  plus: <svg {...p}><path d="M12 5v14M5 12h14" /></svg>,
  stop: <svg {...p}><rect x="6" y="6" width="12" height="12" rx="2" /></svg>,
};
