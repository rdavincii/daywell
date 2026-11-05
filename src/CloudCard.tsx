import { useState } from 'react';
import { cloudConfig } from './lib/cloud';
import type { CloudApi } from './useCloud';
import { Field } from './ui';

/** Settings → Data: optional Google sign-in that keeps a private copy of your data in your own Supabase project. */
export function CloudCard({ cloud }: { cloud: CloudApi }) {
  const existing = cloudConfig();
  const [url, setUrl] = useState(existing?.url ?? '');
  const [anon, setAnon] = useState(existing?.anon ?? '');
  const [err, setErr] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const ago = cloud.lastSynced ? new Date(cloud.lastSynced).toLocaleTimeString() : null;

  return (
    <div className="card stack">
      <span className="label">Save to the cloud (optional)</span>
      <div className="sub">Sign in with Google to keep a private backup and use Daywell on other devices. Without it, everything stays in this browser.</div>

      {cloud.status === 'unconfigured' ? (
        <>
          <div className="sub">One-time setup: paste your Supabase project details (free at supabase.com). Steps are in the README under “Cloud save”.</div>
          <Field label="Supabase project URL" full><input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://xxxx.supabase.co" autoComplete="off" /></Field>
          <Field label="Supabase anon / publishable key" full><input className="input" value={anon} onChange={(e) => setAnon(e.target.value)} placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..." autoComplete="off" /></Field>
          <button className="btn secondary small" onClick={() => setErr(cloud.configure({ url, anon }))}>Save connection</button>
          {err && <div className="notice err" role="alert">{err}</div>}
        </>
      ) : cloud.email ? (
        <>
          <div className="row between"><span>Signed in as <strong>{cloud.email}</strong></span><button className="btn secondary small" onClick={cloud.signOut}>Sign out</button></div>
          <div className="sub" role="status">
            {cloud.status === 'syncing' ? 'Syncing…' : cloud.status === 'synced' ? `Saved to the cloud${ago ? ' at ' + ago : ''}.` : 'Not synced yet.'}
          </div>
          <div className="row">
            <button className="btn small" onClick={cloud.syncNow} disabled={cloud.status === 'syncing'}>Sync now</button>
            {!confirmDelete
              ? <button className="btn danger small" onClick={() => setConfirmDelete(true)}>Delete my cloud copy</button>
              : <button className="btn danger small" onClick={() => { void cloud.deleteCopy(); setConfirmDelete(false); }}>Really delete cloud copy</button>}
          </div>
          {confirmDelete && <div className="sub">This removes the copy in the cloud only. Data on this device stays, and you are signed out so it is not uploaded again.</div>}
        </>
      ) : (
        <>
          <button className="btn" onClick={cloud.signIn}>Sign in with Google</button>
          <button className="btn secondary small" onClick={() => { cloud.configure(null); setErr(null); }}>Change Supabase project</button>
        </>
      )}
      {cloud.error && <div className="notice err" role="alert">{cloud.error}</div>}
    </div>
  );
}
