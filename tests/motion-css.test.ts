// Lints src/styles.css for motion patterns that must never ship.
// Lives outside src/ so it can use Node's fs without adding @types/node to the app build.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../src/styles.css', import.meta.url), 'utf8');

describe('stylesheet: patterns that must never ship', () => {
  it('actually read the stylesheet (guards against a vacuous pass)', () => {
    expect(css.length).toBeGreaterThan(5000);
    expect(css).toContain('.swipe-content');
  });
  it('has no transition:all, ease-in, scale(0) or the built-in weak ease-out on UI', () => {
    expect(css).not.toMatch(/transition:\s*all/);
    expect(css).not.toMatch(/(?<![\w-])ease-in(?!-out)(?![\w-])/);
    expect(css).not.toMatch(/scale\(0\)/);
    expect(css).not.toMatch(/(?<![-\w])ease-out(?![-\w])/); // only the --ease-out token, never the keyword
  });
  it('defines the shared easing tokens and uses them', () => {
    expect(css).toContain('--ease-out: cubic-bezier(0.23, 1, 0.32, 1)');
    expect(css).toContain('--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)');
    expect(css).toMatch(/var\(--ease-out\)/);
  });
  it('the progress bar no longer animates width', () => {
    const bar = /\.bar > span \{[^}]*\}/.exec(css)![0];
    expect(bar).not.toMatch(/transition:[^;]*\bwidth\b/);
    expect(bar).toMatch(/clip-path/);
  });
  it('reduced motion keeps fades and does not kill every transition', () => {
    const block = css.slice(css.indexOf('@media (prefers-reduced-motion: reduce)'));
    expect(block.length).toBeGreaterThan(200);
    expect(block).not.toMatch(/\*\s*\{[^}]*transition:\s*none\s*!important/);
    expect(block).toMatch(/opacity/);
  });
  it('the swipe row stops transitioning while a finger is dragging', () => {
    expect(css).toMatch(/\.swipe-content\[data-dragging\]\s*\{\s*transition:\s*none/);
  });
  it('no UI duration over 300ms except the sheet itself (drawer: 300ms)', () => {
    const durations = [...css.matchAll(/transition[^;{}]*?(\d+)ms/g)].map((m) => Number(m[1]));
    expect(Math.max(...durations)).toBeLessThanOrEqual(300);
  });
});
