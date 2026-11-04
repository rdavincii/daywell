import { useEffect, useMemo, useState } from 'react';
import { FOODS, suggestFoods } from './lib/foods';
import { searchWebFoods } from './lib/webFood';
import type { FoodRef } from './lib/types';

export type LookupStatus = 'idle' | 'searching' | 'done' | 'error';

/**
 * Close matches from our own table instantly, plus a debounced online lookup when nothing local is close.
 * `searchOnline()` forces the online lookup even when a local match exists.
 */
export function useFoodSuggestions(text: string, customFoods: FoodRef[], enabled = true) {
  const local = useMemo(() => suggestFoods(text, [...customFoods, ...FOODS], 4), [text, customFoods]);
  const [web, setWeb] = useState<FoodRef[]>([]);
  const [status, setStatus] = useState<LookupStatus>('idle');
  const [force, setForce] = useState('');
  const q = text.trim();
  const strongLocal = (local[0]?.score ?? 0) >= 0.85;

  useEffect(() => {
    setWeb([]);
    if (!enabled || q.length < 3 || (strongLocal && force !== q)) { setStatus('idle'); return; }
    const ctl = new AbortController();
    setStatus('searching');
    const t = setTimeout(async () => {
      try {
        setWeb(await searchWebFoods(q, ctl.signal));
        setStatus('done');
      } catch {
        if (!ctl.signal.aborted) setStatus('error');
      }
    }, 600);
    return () => { clearTimeout(t); ctl.abort(); };
  }, [q, enabled, strongLocal, force]);

  return { local, web, status, strongLocal, searchOnline: () => setForce(q) };
}
