import { getKey } from './keys';
import type { FoodRef } from './types';

export interface DetectedFood { name: string; servings: number }

// shortcut: Gemini free tier called straight from the browser with the user's own key (kept in this browser only).
// Move to a server proxy before shipping to others.
// Google retires model names often, so ask the key which models exist instead of hardcoding one.
let modelCache: { key: string; id: string } | null = null;

interface ModelInfo { name?: string; supportedGenerationMethods?: string[] }

/** Newest stable (non-preview) flash model that can generateContent; previews only if nothing else. Pure, for tests. */
export function pickModel(models: ModelInfo[]): string | null {
  const ok = models
    .filter((m) => m.name && /flash/.test(m.name) && !/lite|image|tts|live|audio|thinking|exp/.test(m.name) && m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => m.name!.replace(/^models\//, ''));
  const ver = (id: string) => parseFloat(/(\d+(?:\.\d+)?)/.exec(id)?.[1] ?? '0');
  const best = (l: string[]) => l.sort((x, y) => ver(y) - ver(x))[0];
  return best(ok.filter((id) => !/preview/.test(id))) ?? best(ok.filter((id) => /preview/.test(id))) ?? null;
}

async function googleError(res: Response): Promise<Error> {
  let detail = '';
  try { detail = (await res.json())?.error?.message ?? ''; } catch { /* not json */ }
  const bad = res.status === 400 && /api key/i.test(detail) || res.status === 403 || res.status === 401;
  return new Error(bad ? 'BAD_KEY' : res.status === 429 ? 'RATE_LIMIT' : `Google said (${res.status}): ${detail.slice(0, 160) || 'no details'}`);
}

async function modelFor(key: string, signal?: AbortSignal): Promise<string> {
  if (modelCache?.key === key) return modelCache.id;
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { signal, headers: { 'x-goog-api-key': key } });
  if (!res.ok) throw await googleError(res);
  const id = pickModel((await res.json()).models ?? []);
  if (!id) throw new Error('No Gemini vision model is available for this key.');
  modelCache = { key, id };
  return id;
}

/** Model reply -> clean list. Tolerates code fences and junk; never throws. */
export function parseDetected(text: string): DetectedFood[] {
  let data: unknown;
  try { data = JSON.parse(text.replace(/^\s*```(?:json)?|```\s*$/g, '').trim()); } catch { return []; }
  const list = Array.isArray(data) ? data : (data as { foods?: unknown })?.foods;
  if (!Array.isArray(list)) return [];
  const out: DetectedFood[] = [];
  for (const x of list) {
    const name = typeof x?.name === 'string' ? x.name.trim().slice(0, 80) : '';
    if (!name || out.some((o) => o.name.toLowerCase() === name.toLowerCase())) continue;
    const s = Number(x.servings);
    out.push({ name, servings: Number.isFinite(s) && s > 0 ? Math.min(10, Math.max(0.25, s)) : 1 });
    if (out.length === 8) break;
  }
  return out;
}

/** Shrinks a photo to at most 1024 px and returns base64 JPEG, so uploads stay small. */
export async function photoToBase64(file: Blob, max = 1024): Promise<string> {
  const bmp = await createImageBitmap(file);
  const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * k);
  c.height = Math.round(bmp.height * k);
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85).split(',')[1];
}

export async function detectFoods(base64Jpeg: string, signal?: AbortSignal): Promise<DetectedFood[]> {
  const key = getKey('gemini');
  if (!key) throw new Error('NO_KEY');
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${await modelFor(key, signal)}:generateContent`, {
    method: 'POST',
    signal,
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ parts: [
        { text: 'List each distinct food or drink in this photo as JSON: [{"name": plain dish name, Malaysian names like "nasi lemak" if that is what it is, no brand unless clearly visible; "servings": estimated number of normal servings, plates or pieces, 1 if unsure}]. Return [] if there is no food.' },
        { inline_data: { mime_type: 'image/jpeg', data: base64Jpeg } },
      ] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: { type: 'ARRAY', items: { type: 'OBJECT', properties: { name: { type: 'STRING' }, servings: { type: 'NUMBER' } }, required: ['name'] } },
      },
    }),
  });
  if (!res.ok) { if (res.status === 404) modelCache = null; throw await googleError(res); }
  const j = await res.json();
  return parseDetected(j?.candidates?.[0]?.content?.parts?.[0]?.text ?? '');
}

/** Model reply -> food, or null if it is missing numbers or the macros do not add up to the calories (a sign of a made-up answer). */
export function parseEstimate(text: string, query: string): FoodRef | null {
  let o: Record<string, unknown>;
  try { o = JSON.parse(text.replace(/^\s*```(?:json)?|```\s*$/g, '').trim()); } catch { return null; }
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null);
  const kcal = n(o.kcal), p = n(o.proteinG), c = n(o.carbsG), f = n(o.fatG), g = n(o.servingGrams);
  if (kcal === null || p === null || c === null || f === null || kcal <= 0 || kcal > 3000) return null;
  const fromMacros = 4 * p + 4 * c + 9 * f;
  if (fromMacros < kcal * 0.6 || fromMacros > kcal * 1.5) return null;
  const k = Math.round(kcal);
  const name = typeof o.name === 'string' && o.name.trim() ? o.name.trim().slice(0, 80) : query;
  return {
    key: 'ai-' + query.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40), name, aliases: [],
    serving: typeof o.serving === 'string' && o.serving.trim() ? o.serving.trim().slice(0, 80) : '1 serving',
    kcal: k, proteinG: Math.round(p * 10) / 10, carbsG: Math.round(c * 10) / 10, fatG: Math.round(f * 10) / 10,
    kcalLow: Math.round(k * 0.75), kcalHigh: Math.round(k * 1.25), servingG: g && g > 0 && g < 3000 ? Math.round(g) : undefined,
    note: 'AI estimate of a typical serving (no database had it). Check the numbers and edit if you know better.', source: 'ai',
  };
}

/** Last resort when no database has the food: ask Gemini for a typical serving. Needs the user's key. null = no key or no sane answer. */
export async function estimateFood(query: string, signal?: AbortSignal): Promise<FoodRef | null> {
  const key = getKey('gemini');
  if (!key) return null;
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${await modelFor(key, signal)}:generateContent`, {
    method: 'POST', signal, headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({
      contents: [{ parts: [{ text: `Estimate the nutrition of one typical serving of this food as eaten in Malaysia: "${query.slice(0, 80)}". Use realistic values for a standard serving. serving = short description like "1 plate" or "1 piece"; servingGrams = grams in that serving.` }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: { type: 'OBJECT', properties: { name: { type: 'STRING' }, serving: { type: 'STRING' }, servingGrams: { type: 'NUMBER' }, kcal: { type: 'NUMBER' }, proteinG: { type: 'NUMBER' }, carbsG: { type: 'NUMBER' }, fatG: { type: 'NUMBER' } }, required: ['kcal', 'proteinG', 'carbsG', 'fatG'] },
      },
    }),
  });
  if (!res.ok) throw await googleError(res);
  return parseEstimate((await res.json())?.candidates?.[0]?.content?.parts?.[0]?.text ?? '', query);
}
