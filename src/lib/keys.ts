// API keys live in this browser only: not in app state, so they never reach backups or sync.
export type KeyName = 'fdc' | 'gemini';
const k = (n: KeyName) => 'daywell:key:' + n;

export function getKey(n: KeyName): string {
  try { return localStorage.getItem(k(n)) ?? ''; } catch { return ''; }
}
export function setKey(n: KeyName, v: string) {
  try { v.trim() ? localStorage.setItem(k(n), v.trim()) : localStorage.removeItem(k(n)); } catch { /* private mode */ }
}
