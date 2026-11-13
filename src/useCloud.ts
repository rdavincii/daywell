import { useCallback, useEffect, useRef, useState } from 'react';
import { deleteCloudCopy, gistConfig, saveGistConfig, stateSig, syncOnce } from './lib/cloud';
import { mergeStates } from './lib/sync';
import type { AppState } from './lib/types';

export type CloudStatus = 'off' | 'syncing' | 'synced' | 'error';
export interface CloudApi {
  status: CloudStatus; error: string | null; lastSynced: number | null;
  connect: (token: string, pass: string) => Promise<boolean>; disconnect: () => void; syncNow: () => Promise<void>; deleteCopy: () => Promise<void>;
}

const friendly = (e: unknown) => {
  const m = e instanceof Error ? e.message : '';
  return m === 'WRONG_PASSPHRASE' ? 'Wrong passphrase for the saved cloud copy. Nothing was changed. Use the passphrase you first set.'
    : m === 'BAD_TOKEN' ? 'GitHub rejected that token. Create a new one and paste it again.'
    : m === 'NEEDS_GIST' ? 'GitHub would not allow that. The token needs the "gist" permission (a classic token).'
    : m.startsWith('GitHub said') ? m
    : "Couldn't reach GitHub. Check your connection and try again.";
};

export function useCloud(state: AppState, setState: (f: (s: AppState) => AppState) => void): CloudApi {
  const [cfg, setCfg] = useState(gistConfig);
  const [status, setStatus] = useState<CloudStatus>('off');
  const [error, setError] = useState<string | null>(null);
  const [lastSynced, setLast] = useState<number | null>(null);
  const first = useRef(true);
  const latest = useRef(state);
  latest.current = state;

  const run = useCallback(async (c: NonNullable<typeof cfg>, force: boolean) => {
    setStatus('syncing'); setError(null);
    try {
      const { state: merged, gistId } = await syncOnce(c, latest.current, first.current);
      first.current = false;
      if (gistId !== c.gistId) { const next = { ...c, gistId }; saveGistConfig(next); setCfg(next); }
      // apply what the cloud added; union with the current state so anything logged during the sync is kept
      if (force || stateSig(merged) !== stateSig(latest.current)) setState((cur) => mergeStates(merged, cur));
      setLast(Date.now()); setStatus('synced');
      return true;
    } catch (e) { setStatus('error'); setError(friendly(e)); return false; }
  }, [setState]);

  // sync shortly after connecting and after each change
  useEffect(() => {
    if (!cfg) return;
    const t = setTimeout(() => { void run(cfg, false); }, first.current ? 100 : 2000);
    return () => clearTimeout(t);
  }, [cfg, state, run]);

  return {
    status: cfg ? status : 'off', error, lastSynced,
    connect: async (token, pass) => {
      const c = { token: token.trim(), pass };
      first.current = true;
      const ok = await run(c, true); // validates the token and passphrase before anything is saved
      if (ok) { saveGistConfig(c); setCfg(c); }
      return ok;
    },
    disconnect: () => { saveGistConfig(null); setCfg(null); setStatus('off'); setError(null); },
    syncNow: async () => { if (cfg) await run(cfg, true); },
    deleteCopy: async () => {
      if (!cfg) return;
      try { await deleteCloudCopy(cfg); saveGistConfig(null); setCfg(null); setStatus('off'); setError(null); } catch (e) { setStatus('error'); setError(friendly(e)); }
    },
  };
}
