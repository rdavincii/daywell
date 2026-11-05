import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sanitize } from './store';
import { mergeStates } from './sync';
import type { AppState } from './types';

// Optional cloud save. The app is fully local-first; signing in only adds a private copy in YOUR Supabase project
// (table user_state, see supabase/migrations/0003). shortcut: whole-state merge by record id, so a delete on one device can come
// back from a stale device; add tombstones if you use several devices heavily.

const LS = 'daywell:cloud';
export interface CloudConfig { url: string; anon: string }

export function cloudConfig(): CloudConfig | null {
  const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '';
  const anon = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined) ?? '';
  if (url && anon) return { url, anon };
  try {
    const c = JSON.parse(localStorage.getItem(LS) ?? 'null');
    return c?.url && c?.anon ? c : null;
  } catch { return null; }
}

export function saveCloudConfig(c: CloudConfig | null): string | null {
  if (c && !/^https:\/\/[^\s/]+\.[^\s/]+\/?$/.test(c.url.trim())) return 'The project URL should look like https://abcd.supabase.co';
  if (c && c.anon.trim().length < 20) return 'That key looks too short. Use the anon / publishable key from Supabase → Settings → API.';
  try { c ? localStorage.setItem(LS, JSON.stringify({ url: c.url.trim().replace(/\/$/, ''), anon: c.anon.trim() })) : localStorage.removeItem(LS); } catch { /* private mode */ }
  client = null;
  return null;
}

let client: SupabaseClient | null = null;
export function getClient(): SupabaseClient | null {
  const c = cloudConfig();
  if (!c) return null;
  return (client ??= createClient(c.url, c.anon, { auth: { persistSession: true, autoRefreshToken: true } }));
}

/** Pull, merge, push. On the first sync after signing in the cloud copy wins settings conflicts (a fresh device must not overwrite your targets); afterwards this device wins. */
export async function syncOnce(db: SupabaseClient, userId: string, local: AppState, first: boolean): Promise<AppState> {
  const { data, error } = await db.from('user_state').select('state').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  const merged = !data?.state ? local : first ? mergeStates(local, data.state) : mergeStates(sanitize(data.state), local);
  const { error: e2 } = await db.from('user_state').upsert({ user_id: userId, state: merged, updated_at: new Date().toISOString() });
  if (e2) throw e2;
  return merged;
}

export async function deleteCloudCopy(db: SupabaseClient, userId: string) {
  const { error } = await db.from('user_state').delete().eq('user_id', userId);
  if (error) throw error;
}

/** Cheap change signal: counts only, so a merge that reorders records does not look like a change. */
export const stateSig = (s: AppState) => [s.expenses.length, s.meals.length, s.weightLogs.length, (s.customFoods || []).length].join();
