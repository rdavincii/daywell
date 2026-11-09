import { useCallback, useEffect, useRef, useState } from 'react';
import { cloudConfig, deleteCloudCopy, getClient, saveCloudConfig, stateSig, syncOnce } from './lib/cloud';
import type { CloudConfig } from './lib/cloud';
import { mergeStates } from './lib/sync';
import type { AppState } from './lib/types';

export type CloudStatus = 'unconfigured' | 'signed-out' | 'syncing' | 'synced' | 'error';
export interface CloudApi {
  status: CloudStatus; email: string | null; error: string | null; lastSynced: number | null;
  sendLink: (email: string) => Promise<boolean>; signOut: () => Promise<void>; syncNow: () => Promise<void>;
  configure: (c: CloudConfig | null) => string | null; deleteCopy: () => Promise<void>;
}

const msg = (e: unknown) => (e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : 'Something went wrong');

export function useCloud(state: AppState, setState: (f: (s: AppState) => AppState) => void): CloudApi {
  const [configured, setConfigured] = useState(() => !!cloudConfig());
  const [user, setUser] = useState<{ id: string; email: string | null } | null>(null);
  const [status, setStatus] = useState<CloudStatus>('signed-out');
  const [error, setError] = useState<string | null>(null);
  const [lastSynced, setLast] = useState<number | null>(null);
  const first = useRef(true);
  const latest = useRef(state);
  latest.current = state;

  useEffect(() => {
    const db = getClient();
    if (!db) { setUser(null); return; }
    db.auth.getSession().then(({ data }) => setUser(data.session ? { id: data.session.user.id, email: data.session.user.email ?? null } : null));
    const { data: sub } = db.auth.onAuthStateChange((_e, s) => { first.current = true; setUser(s ? { id: s.user.id, email: s.user.email ?? null } : null); });
    return () => sub.subscription.unsubscribe();
  }, [configured]);

  const run = useCallback(async (force: boolean) => {
    const db = getClient();
    if (!db || !user) return;
    setStatus('syncing'); setError(null);
    try {
      const merged = await syncOnce(db, user.id, latest.current, first.current);
      first.current = false;
      // apply what the cloud added; union with the current state so anything logged during the sync is kept
      if (force || stateSig(merged) !== stateSig(latest.current)) setState((cur) => mergeStates(merged, cur));
      setLast(Date.now()); setStatus('synced');
    } catch (e) { setStatus('error'); setError(msg(e)); }
  }, [user, setState]);

  // sync shortly after sign-in and after each change
  useEffect(() => {
    if (!user) return;
    const t = setTimeout(() => { void run(false); }, first.current ? 100 : 2000);
    return () => clearTimeout(t);
  }, [user, state, run]);

  return {
    status: !configured ? 'unconfigured' : user ? status : 'signed-out',
    email: user?.email ?? null, error, lastSynced,
    // Passwordless email link: no third-party sign-up needed. The link brings you back here, signed in.
    sendLink: async (email) => {
      const db = getClient();
      if (!db) return false;
      const { error: e } = await db.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: location.origin + location.pathname } });
      if (e) { setStatus('error'); setError(msg(e)); return false; }
      setError(null);
      return true;
    },
    signOut: async () => { await getClient()?.auth.signOut(); setUser(null); setStatus('signed-out'); },
    syncNow: () => run(true),
    configure: (c) => { const err = saveCloudConfig(c); if (!err) { setConfigured(!!c); setUser(null); } return err; },
    deleteCopy: async () => {
      const db = getClient();
      if (!db || !user) return;
      try { await deleteCloudCopy(db, user.id); setError(null); await db.auth.signOut(); setUser(null); setStatus('signed-out'); } catch (e) { setStatus('error'); setError(msg(e)); }
    },
  };
}
