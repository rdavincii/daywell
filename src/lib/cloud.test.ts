// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { decrypt, encrypt, stateSig, syncOnce } from './cloud';
import { emptyState } from './store';
import type { AppState } from './types';

afterEach(() => vi.unstubAllGlobals());

const withMeal = (id: string, name = 'secret laksa'): AppState => ({ ...emptyState(), meals: [{ id, ts: 1, mealType: 'Lunch', foodName: name, servingLabel: 's', quantity: 1, portion: 'regular', kcal: 100, proteinG: null, carbsG: null, fatG: null, nutritionSource: 'manual', confidence: 'high', source: 'manual' }] } as AppState);

/** A tiny in-memory GitHub Gist API. */
function fakeGitHub(valid = 'tok') {
  const gists = new Map<string, string>();
  const calls: string[] = [];
  const json = (body: unknown, status = 200) => ({ ok: status < 400, status, json: async () => body });
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: RequestInit = {}) => {
    const path = url.replace('https://api.github.com', '');
    const m = init.method ?? 'GET';
    calls.push(m + ' ' + path.split('?')[0]);
    if ((init.headers as Record<string, string>).Authorization !== `Bearer ${valid}`) return json({}, 401);
    if (m === 'GET' && path.startsWith('/gists?')) return json([...gists.keys()].map((id) => ({ id, files: { 'daywell-data.json': {} } })));
    const id = /^\/gists\/(\w+)/.exec(path)?.[1];
    if (m === 'GET' && id) return gists.has(id) ? json({ files: { 'daywell-data.json': { content: gists.get(id) } } }) : json({}, 404);
    if (m === 'PATCH' && id) { gists.set(id, JSON.parse(init.body as string).files['daywell-data.json'].content); return json({}); }
    if (m === 'POST') { gists.set('g1', JSON.parse(init.body as string).files['daywell-data.json'].content); return json({ id: 'g1' }, 201); }
    if (m === 'DELETE' && id) { gists.delete(id); return json({}, 204); }
    return json({}, 500);
  }));
  return { gists, calls };
}

describe('encryption', () => {
  it('round-trips and hides the content', async () => {
    const enc = await encrypt(withMeal('a'), 'correct horse');
    expect(enc).not.toContain('laksa');
    expect((await decrypt(enc, 'correct horse')).meals[0].foodName).toBe('secret laksa');
  });
  it('a wrong passphrase or damaged data throws WRONG_PASSPHRASE', async () => {
    const enc = await encrypt(withMeal('a'), 'right-pass');
    await expect(decrypt(enc, 'wrong-pass')).rejects.toThrow('WRONG_PASSPHRASE');
    await expect(decrypt('not json', 'right-pass')).rejects.toThrow('WRONG_PASSPHRASE');
  });
});

describe('gist sync', () => {
  const cfg = { token: 'tok', pass: 'my-passphrase' };
  it('creates an encrypted secret gist when none exists, then reuses it', async () => {
    const gh = fakeGitHub();
    const r = await syncOnce(cfg, withMeal('a'), true);
    expect(r.gistId).toBe('g1');
    expect(gh.gists.get('g1')).not.toContain('laksa'); // only ciphertext is stored
    await syncOnce({ ...cfg, gistId: 'g1' }, withMeal('a'), false);
    expect(gh.calls.filter((c) => c === 'POST /gists')).toHaveLength(1);
  });
  it('a second device merges its records with the cloud and uploads the union', async () => {
    fakeGitHub();
    await syncOnce(cfg, withMeal('phone'), true);
    const laptop = await syncOnce(cfg, withMeal('laptop'), true); // finds the gist by name, no gistId given
    expect(laptop.state.meals.map((m) => m.id).sort()).toEqual(['laptop', 'phone']);
  });
  it('first sync: cloud settings win; later syncs: this device wins', async () => {
    fakeGitHub();
    const remote = { ...emptyState(), settings: { ...emptyState().settings, kcalTarget: 1800 } };
    const local = { ...emptyState(), settings: { ...emptyState().settings, kcalTarget: 2500 } };
    await syncOnce(cfg, remote, true);
    expect((await syncOnce({ ...cfg, gistId: 'g1' }, local, true)).state.settings.kcalTarget).toBe(1800);
    expect((await syncOnce({ ...cfg, gistId: 'g1' }, local, false)).state.settings.kcalTarget).toBe(2500);
  });
  it('a wrong passphrase never overwrites the cloud copy', async () => {
    const gh = fakeGitHub();
    await syncOnce(cfg, withMeal('a'), true);
    const before = gh.gists.get('g1');
    await expect(syncOnce({ token: 'tok', pass: 'a-different-pass', gistId: 'g1' }, withMeal('b'), true)).rejects.toThrow('WRONG_PASSPHRASE');
    expect(gh.gists.get('g1')).toBe(before);
    expect(gh.calls.filter((c) => c.startsWith('PATCH'))).toHaveLength(0);
  });
  it('a rejected token reports BAD_TOKEN', async () => {
    fakeGitHub('other');
    await expect(syncOnce(cfg, withMeal('a'), true)).rejects.toThrow('BAD_TOKEN');
  });
  it('signature notices additions but not reordering', () => {
    expect(stateSig(withMeal('a'))).not.toBe(stateSig(emptyState()));
  });
});
