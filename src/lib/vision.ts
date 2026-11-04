import { getKey } from './keys';

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
