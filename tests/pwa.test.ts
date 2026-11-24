// PWA files must stay installable. Outside src/ so it can use Node's fs without @types/node in the app build.
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = new URL('../', import.meta.url);
const read = (f: string) => readFileSync(new URL(f, root), 'utf8');
const has = (f: string) => existsSync(new URL(f, root));

describe('PWA files', () => {
  const m = JSON.parse(read('public/manifest.webmanifest'));
  it('is installable: name, standalone, relative start, 192 + 512 + maskable icons that exist', () => {
    expect(m.display).toBe('standalone');
    expect(m.start_url).toBe('./');
    const purposes = m.icons.map((i: any) => `${i.sizes}:${i.purpose}`);
    expect(purposes).toEqual(expect.arrayContaining(['192x192:any', '512x512:any', '512x512:maskable']));
    for (const i of m.icons) expect(has('public/' + i.src)).toBe(true);
  });
  it('index.html links use relative paths so they work under /daywell/', () => {
    const html = read('index.html');
    expect(html).toContain('href="./manifest.webmanifest"');
    expect(html).not.toMatch(/href="\/(manifest|icon)/);
    expect(has('public/apple-touch-icon.png')).toBe(true);
  });
});

