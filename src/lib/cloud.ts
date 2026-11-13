import { sanitize } from './store';
import { mergeStates } from './sync';
import type { AppState } from './types';

// Optional cloud save with no server and no extra account: your data is encrypted in the browser with your passphrase
// and stored in a secret GitHub Gist you own. Needs a GitHub token with only the "gist" permission.
// shortcut: whole-state merge by record id, so a delete on one device can come back from a stale device; add tombstones
// if you use several devices heavily. A secret gist is unlisted (not private), which is why the content is encrypted.

const LS = 'daywell:gist';
const FILE = 'daywell-data.json';
const API = 'https://api.github.com';
export interface GistConfig { token: string; pass: string; gistId?: string }

export function gistConfig(): GistConfig | null {
  try {
    const c = JSON.parse(localStorage.getItem(LS) ?? 'null');
    return c?.token && c?.pass ? c : null;
  } catch { return null; }
}
export function saveGistConfig(c: GistConfig | null) {
  try { c ? localStorage.setItem(LS, JSON.stringify(c)) : localStorage.removeItem(LS); } catch { /* private mode */ }
}

// ---- encryption (AES-GCM, key from the passphrase with PBKDF2) ----
const b64 = (u: Uint8Array) => { let s = ''; for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0)) as Uint8Array<ArrayBuffer>;
async function keyFor(pass: string, salt: Uint8Array<ArrayBuffer>) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 200_000, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function encrypt(state: AppState, pass: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(16))), iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)));
  const data = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await keyFor(pass, salt), new TextEncoder().encode(JSON.stringify(state))));
  return JSON.stringify({ v: 1, salt: b64(salt), iv: b64(iv), data: b64(data) });
}
/** Throws 'WRONG_PASSPHRASE' for a wrong passphrase or damaged data, so we never overwrite a cloud copy we could not read. */
export async function decrypt(payload: string, pass: string): Promise<AppState> {
  try {
    const p = JSON.parse(payload);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(p.iv) }, await keyFor(pass, unb64(p.salt)), unb64(p.data));
    return sanitize(JSON.parse(new TextDecoder().decode(plain)));
  } catch { throw new Error('WRONG_PASSPHRASE'); }
}

// ---- GitHub Gist ----
async function gh(token: string, path: string, init: RequestInit = {}) {
  const res = await fetch(API + path, { ...init, headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(init.headers ?? {}) } });
  if (res.status === 401) throw new Error('BAD_TOKEN');
  if (res.status === 403 || res.status === 404) throw new Error('NEEDS_GIST');
  if (!res.ok) throw new Error(`GitHub said ${res.status}`);
  return res;
}

async function findGist(token: string): Promise<string | null> {
  for (let page = 1; page <= 5; page++) {
    const list: { id: string; files: Record<string, unknown> }[] = await (await gh(token, `/gists?per_page=100&page=${page}`)).json();
    const hit = list.find((g) => FILE in g.files);
    if (hit) return hit.id;
    if (list.length < 100) break;
  }
  return null;
}

/** Pull, merge, push. First sync after connecting: the cloud copy wins settings conflicts; afterwards this device wins. */
export async function syncOnce(cfg: GistConfig, local: AppState, first: boolean): Promise<{ state: AppState; gistId: string }> {
  const gistId = cfg.gistId ?? (await findGist(cfg.token));
  let remote: AppState | null = null;
  if (gistId) {
    const g = await (await gh(cfg.token, `/gists/${gistId}`)).json();
    const f = g.files?.[FILE];
    const text: string | undefined = f?.truncated ? await (await fetch(f.raw_url)).text() : f?.content;
    if (text) remote = await decrypt(text, cfg.pass);
  }
  const merged = !remote ? local : first ? mergeStates(local, remote) : mergeStates(remote, local);
  const content = await encrypt(merged, cfg.pass);
  if (gistId) await gh(cfg.token, `/gists/${gistId}`, { method: 'PATCH', body: JSON.stringify({ files: { [FILE]: { content } } }) });
  else {
    const made = await (await gh(cfg.token, '/gists', { method: 'POST', body: JSON.stringify({ description: 'Daywell encrypted backup', public: false, files: { [FILE]: { content } } }) })).json();
    return { state: merged, gistId: made.id };
  }
  return { state: merged, gistId };
}

export async function deleteCloudCopy(cfg: GistConfig) {
  const id = cfg.gistId ?? (await findGist(cfg.token));
  if (id) await gh(cfg.token, `/gists/${id}`, { method: 'DELETE' });
}

/** Cheap change signal: counts only, so a merge that reorders records does not look like a change. */
export const stateSig = (s: AppState) => [s.expenses.length, s.meals.length, s.weightLogs.length, (s.customFoods || []).length].join();
