import { rememberFood, similarity } from './foods';
import { getKey } from './keys';
import { estimateFood } from './vision';
import type { FoodRef } from './types';

// Online macro lookup: Open Food Facts (packaged products, barcodes) + USDA FoodData Central (generic and US branded foods).
// Both are free. FDC uses the shared DEMO_KEY (about 30 requests/hour) unless the user adds their own key in Settings.
// shortcut: no Malaysian-specific source, so hawker dishes often miss; add MyFCD or a curated table if the hit rate is poor.

interface OffProduct {
  code?: string;
  product_name?: string;
  brands?: string;
  serving_size?: string;
  serving_quantity?: number | string;
  nutriments?: Record<string, number | string | undefined>;
}

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 ? n : null;
};
const r1 = (n: number) => Math.round(n * 10) / 10;

/** One Open Food Facts product as a food. Per 100 g, or per serving when asked and the pack states one. */
export function offToFood(p: OffProduct, perServing = false): FoodRef | null {
  const name = p.product_name?.trim();
  const kcal100 = num(p.nutriments?.['energy-kcal_100g']);
  if (!name || kcal100 === null) return null;
  const grams = perServing ? num(p.serving_quantity) : null;
  const k = grams && grams > 0 ? grams / 100 : 1;
  const brand = p.brands?.split(',')[0]?.trim();
  const kcal = Math.round(kcal100 * k);
  return {
    key: 'off-' + (p.code ?? name),
    name: brand && !name.toLowerCase().includes(brand.toLowerCase()) ? `${name} (${brand})` : name,
    aliases: [],
    serving: k !== 1 ? (p.serving_size?.trim() || `${grams} g`) : '100 g',
    kcal,
    proteinG: r1((num(p.nutriments?.['proteins_100g']) ?? 0) * k),
    carbsG: r1((num(p.nutriments?.['carbohydrates_100g']) ?? 0) * k),
    fatG: r1((num(p.nutriments?.['fat_100g']) ?? 0) * k),
    kcalLow: kcal,
    kcalHigh: kcal,
    note: `From Open Food Facts, per ${k !== 1 ? 'serving' : '100 g'}. Packaged-product data, may differ from your dish.${k === 1 ? ' Set quantity 2 for 200 g.' : ''}`,
    source: 'web',
  };
}

/** Open Food Facts search response -> foods close to the query. Pure, so it can be tested offline. */
export function mapOffProducts(data: { products?: OffProduct[] }, query: string, limit = 5): FoodRef[] {
  return (data.products ?? [])
    .map((p) => ({ f: offToFood(p), score: similarity(query, p.product_name ?? '') }))
    .filter((x): x is { f: FoodRef; score: number } => x.f !== null && x.score >= 0.6)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.f);
}

interface FdcFood {
  fdcId?: number;
  description?: string;
  brandOwner?: string;
  gtinUpc?: string;
  foodNutrients?: { nutrientId?: number; nutrientNumber?: string; value?: number }[];
}

/** Value of a nutrient in a FDC search result. Energy has several ids (208 kcal, or Atwater 957/958 for Foundation foods). */
function fdcValue(f: FdcFood, numbers: string[], ids: number[]): number | null {
  const n = f.foodNutrients?.find((x) => (x.nutrientNumber && numbers.includes(x.nutrientNumber)) || (x.nutrientId && ids.includes(x.nutrientId)));
  return num(n?.value);
}

const title = (s: string) => (s === s.toUpperCase() ? s.toLowerCase().replace(/(^|[\s,(])([a-z])/g, (_, a, b) => a + b.toUpperCase()) : s);

/** USDA FoodData Central search response -> foods (per 100 g). */
export function mapFdcFoods(data: { foods?: FdcFood[] }, query: string, limit = 5): FoodRef[] {
  const out: { food: FoodRef; score: number }[] = [];
  for (const f of data.foods ?? []) {
    const kcal = fdcValue(f, ['208', '957', '958'], [1008, 2047, 2048]);
    const desc = f.description?.trim();
    if (!desc || kcal === null) continue;
    const score = Math.max(similarity(query, desc), similarity(query, desc.split(',')[0]));
    if (score < 0.6) continue;
    const k = Math.round(kcal);
    out.push({
      score,
      food: {
        key: 'fdc-' + f.fdcId,
        name: title(desc) + (f.brandOwner ? ` (${title(f.brandOwner)})` : ''),
        aliases: [],
        serving: '100 g',
        kcal: k,
        proteinG: r1(fdcValue(f, ['203'], [1003]) ?? 0),
        carbsG: r1(fdcValue(f, ['205'], [1005]) ?? 0),
        fatG: r1(fdcValue(f, ['204'], [1004]) ?? 0),
        kcalLow: k,
        kcalHigh: k,
        note: 'From USDA FoodData Central, per 100 g. US data, may differ from your dish. Set quantity 2 for 200 g.',
        source: 'web',
      },
    });
  }
  return out.sort((a, b) => b.score - a.score).slice(0, limit).map((x) => x.food);
}

const FDC = 'https://api.nal.usda.gov/fdc/v1/foods/search';
const fdcUrl = (query: string, types: string) =>
  `${FDC}?api_key=${encodeURIComponent(getKey('fdc') || 'DEMO_KEY')}&pageSize=10&dataType=${types}&query=${encodeURIComponent(query)}`;

async function getJson(url: string, signal?: AbortSignal) {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Food database returned ${res.status}`);
  return res.json();
}

const cache = new Map<string, FoodRef[]>();

/**
 * Searches both databases in parallel. Throws only when both fail (so the UI can say "offline");
 * an empty array means "reached them, no close match". Foundation/SR Legacy first for plain foods like "egg".
 */
export async function searchWebFoods(query: string, signal?: AbortSignal): Promise<FoodRef[]> {
  const q = query.trim().toLowerCase();
  if (cache.has(q)) return cache.get(q)!;
  const offUrl = 'https://world.openfoodfacts.org/cgi/search.pl?search_simple=1&action=process&json=1&page_size=12&fields=code,product_name,brands,nutriments&search_terms=' + encodeURIComponent(q);
  const [off, my, fdc] = await Promise.allSettled([
    getJson(offUrl, signal).then((d) => mapOffProducts(d, q)),
    // Malaysian products first-class: same search limited to products sold in Malaysia
    getJson(offUrl + '&tagtype_0=countries&tag_contains_0=contains&tag_0=malaysia', signal).then((d) => mapOffProducts(d, q)),
    getJson(fdcUrl(q, 'Foundation,SR%20Legacy,Branded'), signal).then((d) => mapFdcFoods(d, q)),
  ]);
  if (off.status === 'rejected' && fdc.status === 'rejected') throw off.reason;
  const ok = <T,>(r: PromiseSettledResult<T[]>) => (r.status === 'fulfilled' ? r.value : []);
  // Generic USDA foods first (plain food per 100 g), then Malaysian packaged products, then the rest; no duplicates.
  const seen = new Set<string>();
  let foods = [...ok(fdc), ...ok(my), ...ok(off)].filter((f) => !seen.has(f.key) && seen.add(f.key)).slice(0, 6);
  // shortcut: AI fallback only runs with the user's Gemini key; without it a miss stays a miss.
  if (!foods.length) { try { const e = await estimateFood(q, signal); if (e) foods = [e]; } catch { /* keep the miss */ } }
  foods.forEach(rememberFood);
  cache.set(q, foods);
  return foods;
}

/** Barcode -> food. Open Food Facts first, then USDA branded foods (exact GTIN match). null = not found; throws when offline. */
export async function lookupBarcode(code: string, signal?: AbortSignal): Promise<FoodRef | null> {
  const digits = code.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 14) throw new Error('A barcode has 8 to 14 digits.');
  let offErr: unknown = null;
  try {
    const d = await getJson(`https://world.openfoodfacts.org/api/v2/product/${digits}.json?fields=code,product_name,brands,nutriments,serving_size,serving_quantity`, signal);
    const f = d.status === 1 && d.product ? offToFood({ code: digits, ...d.product }, true) : null;
    if (f) { rememberFood(f); return f; }
  } catch (e) { offErr = e; }
  try {
    const d = await getJson(fdcUrl(digits, 'Branded'), signal);
    const hit = (d.foods ?? []).find((x: FdcFood) => x.gtinUpc && x.gtinUpc.replace(/^0+/, '') === digits.replace(/^0+/, ''));
    const f = hit ? mapFdcFoods({ foods: [hit] }, hit.description, 1)[0] ?? null : null;
    if (f) { rememberFood(f); return f; }
    if (offErr) throw offErr;
    return null;
  } catch (e) { throw offErr ?? e; }
}
