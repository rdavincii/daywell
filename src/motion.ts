import { createContext, useEffect, useState } from 'react';

// Shared motion helpers. Curves and durations live in styles.css (--ease-out, --dur-*).

export function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

/**
 * Keeps a value mounted for `ms` after it becomes null, so an exit animation can play even when the
 * parent unmounts by setting state to null (Save, Delete, Escape all take that path).
 */
export function usePresence<T>(value: T | null, ms = 240): { value: T | null; exiting: boolean } {
  const [kept, setKept] = useState<T | null>(value);
  useEffect(() => {
    if (value !== null) {
      setKept(value);
      return;
    }
    const t = setTimeout(() => setKept(null), prefersReducedMotion() ? Math.min(ms, 120) : ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return { value: value ?? kept, exiting: value === null && kept !== null };
}

const lastSeen = new Map<string, number>();

/**
 * Returns the number to render. If this element was shown before (same key) with a different value,
 * it starts at the old value and moves to the new one after the first paint, so the CSS transition
 * plays. Unchanged values and first-ever renders do not animate. This is how a bar visibly moves
 * after you log something and the dashboard remounts.
 */
export function useSettledValue(key: string | undefined, target: number): number {
  const [shown, setShown] = useState(() => (key !== undefined && lastSeen.has(key) ? (lastSeen.get(key) as number) : target));
  useEffect(() => {
    if (key !== undefined) lastSeen.set(key, target);
    if (shown === target) return;
    let id2 = 0;
    const id1 = requestAnimationFrame(() => {
      id2 = requestAnimationFrame(() => setShown(target)); // two frames: be sure the old value was painted
    });
    return () => {
      cancelAnimationFrame(id1);
      cancelAnimationFrame(id2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, target]);
  return shown;
}

/** Ids of records that were just added, so their rows can animate in. Set by App, read by rows. */
export const FreshIds = createContext<ReadonlyArray<string>>([]);
