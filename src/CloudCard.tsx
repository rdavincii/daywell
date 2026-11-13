import { useState } from 'react';
import type { CloudApi } from './useCloud';
import { Field } from './ui';

/** Settings → Data: optional encrypted backup in your own GitHub Gist. No server, no extra sign-up. */
export function CloudCard({ cloud }: { cloud: CloudApi }) {
  const [token, setToken] = useState('');
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const on = cloud.status !== 'off';
  const ago = cloud.lastSynced ? new Date(cloud.lastSynced).toLocaleTimeString() : null;

  return (
    <div className="card stack">
      <span className="label">Save to the cloud (optional)</span>
      <div className="sub">Keeps an encrypted copy of your data in a secret GitHub Gist that you own, so you can use Daywell on other devices. Nothing is sent anywhere else. Without it, everything stays in this browser.</div>

      {!on ? (
        <>
          <ol className="sub" style={{ paddingLeft: 18, margin: 0 }}>
            <li><a href="https://github.com/settings/tokens/new?scopes=gist&description=Daywell%20backup" target="_blank" rel="noreferrer">Create a GitHub token</a> with only the <strong>gist</strong> permission and copy it.</li>
            <li>Paste it below and choose a passphrase. Use the same passphrase on every device. If you forget it, the cloud copy cannot be read.</li>
          </ol>
          <Field label="GitHub token" full><input className="input" type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder="ghp_…" /></Field>
          <Field label="Passphrase (8+ characters)" full><input className="input" type="password" autoComplete="off" value={pass} onChange={(e) => setPass(e.target.value)} /></Field>
          <button className="btn" disabled={busy || token.trim().length < 20 || pass.length < 8}
            onClick={async () => { setBusy(true); await cloud.connect(token, pass); setBusy(false); }}>
            {busy ? 'Connecting…' : 'Connect and sync'}
          </button>
        </>
      ) : (
        <>
          <div className="sub" role="status">
            {cloud.status === 'syncing' ? 'Syncing…' : cloud.status === 'synced' ? `Saved to the cloud${ago ? ' at ' + ago : ''}.` : 'Not synced.'}
          </div>
          <div className="row">
            <button className="btn small" onClick={cloud.syncNow} disabled={cloud.status === 'syncing'}>Sync now</button>
            <button className="btn secondary small" onClick={cloud.disconnect}>Disconnect</button>
            {!confirmDelete
              ? <button className="btn danger small" onClick={() => setConfirmDelete(true)}>Delete cloud copy</button>
              : <button className="btn danger small" onClick={() => { void cloud.deleteCopy(); setConfirmDelete(false); }}>Really delete</button>}
          </div>
          {confirmDelete && <div className="sub">Deletes the gist on GitHub and disconnects. Data on this device stays.</div>}
        </>
      )}
      {cloud.error && <div className="notice err" role="alert">{cloud.error}</div>}
    </div>
  );
}
