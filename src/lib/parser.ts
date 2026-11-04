import { findFood, scaleNutrition } from './foods';
import { dayKey, addDays, hourOf, zonedToEpoch } from './time';
import type { Category, Draft, MealType, FoodRef } from './types';

const ONES: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19,
  satu: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, lapan: 8, sembilan: 9, sepuluh: 10,
};
const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70, eighty: 80, ninety: 90,
};
const NUM_WORD = `(?:(?:${Object.keys(TENS).join('|')})(?:[\\s-](?:one|two|three|four|five|six|seven|eight|nine))?|${Object.keys(ONES).join('|')})`;

function wordsToNumber(s: string): number | null {
  const parts = s.toLowerCase().split(/[\s-]+/);
  let total = 0;
  for (const p of parts) {
    if (p in TENS) total += TENS[p];
    else if (p in ONES) total += ONES[p];
    else return null;
  }
  return total;
}

const PRICE_RES: { re: RegExp; kind: 'digits' | 'words' }[] = [
  { re: /\b(?:rm|myr)\s*(\d[\d,]*(?:\.\d{1,2})?)/i, kind: 'digits' },
  { re: /(\d+(?:\.\d{1,2})?)\s*(?:ringgit|rm|myr)\b/i, kind: 'digits' },
  { re: new RegExp(`\b(${NUM_WORD})\s+ringgit\b`, 'i'), kind: 'words' },
];

export function extractPrice(clause: string): { sen: number; rest: string } | null {
  for (const { re, kind } of PRICE_RES) {
    const m = re.exec(clause);
    if (!m) continue;
    let sen: number | null = null;
    if (kind === 'digits') {
      const raw = m[1].replace(/,/g, '');
      const [w, f = ''] = raw.split('.');
      sen = parseInt(w, 10) * 100 + (f ? parseInt(f.padEnd(2, '0'), 10) : 0);
    } else {
      const n = wordsToNumber(m[1]);
      sen = n === null ? null : n * 100;
    }
    if (sen === null || !Number.isSafeInteger(sen) || sen <= 0) continue;
    return { sen, rest: (clause.slice(0, m.index) + ' ' + clause.slice(m.index + m[0].length)).replace(/\s+/g, ' ').trim() };
  }
  return null;
}

const NON_FOOD_RULES: [RegExp, Category][] = [
  [/\b(petrol|fuel|minyak|diesel|ron\s?9[57]|parking|parkir|toll|tol|grab|bolt|taxi|lrt|mrt|ktm|bus|bas|touch\s?n\s?go|tng|ev charging|charging)\b/i, 'Transport'],
  [/\b(netflix|spotify|youtube premium|disney|icloud|subscription|langganan|chatgpt|claude)\b/i, 'Subscriptions'],
  [/\b(groceries|grocery|tesco|giant|lotus'?s?|mydin|aeon|jaya grocer|econsave|99 speedmart|speedmart|kk mart|pasar|barang dapur)\b/i, 'Groceries'],
  [/\b(electric|electricity|tnb|water bill|bil air|bil|internet|unifi|maxis|celcom|digi|umobile|prepaid|top ?up|reload|astro|syabas)\b/i, 'Bills & Utilities'],
  [/\b(clinic|klinik|pharmacy|farmasi|guardian|watsons|doctor|ubat|medicine|hospital|dentist)\b/i, 'Healthcare'],
  [/\b(movie|cinema|wayang|tgv|gsc|concert|game|steam|karaoke|bowling)\b/i, 'Entertainment'],
  [/\b(book|buku|tuition|tuisyen|course|kursus|yuran|fees|school|sekolah|stationery|alat tulis|exam)\b/i, 'Education'],
  [/\b(haircut|potong rambut|salon|barber|spa|skincare|makeup|shampoo|massage|urut)\b/i, 'Personal Care'],
  [/\b(rent|sewa|mortgage|furniture|ikea|maintenance fee)\b/i, 'Housing'],
  [/\b(hotel|flight|airasia|batik air|mas|agoda|booking\.com|airbnb|ticket tiket|tiket)\b/i, 'Travel'],
  [/\b(shirt|baju|shoes|kasut|shopee|lazada|tiktok shop|uniqlo|gift|hadiah|watch|bag|beg|clothes|pakaian)\b/i, 'Shopping'],
];
const FOOD_DELIVERY = /\b(grab\s?food|foodpanda|shopee\s?food|delivery makan)\b/i;
const GENERIC_MEAL = /\b(breakfast|lunch|dinner|supper|makan|makanan|food|sarapan|snack|brunch|meal|minum|drink|minuman)\b/i;

const EAT_VERB = /\b(ate|eat|eaten|eating|had|drank|drink|drinking|makan|minum|dah makan|telah makan|sarapan|finished)\b/i;
const BUY_VERB = /\b(bought|buy|buying|beli|membeli|purchased|paid|pay|spent|spend|bayar|ordered|order)\b/i;

type Intent = 'eaten' | 'bought' | 'none';

function intentOf(clause: string): Intent {
  if (EAT_VERB.test(clause)) return 'eaten';
  if (BUY_VERB.test(clause)) return 'bought';
  return 'none';
}

const MEAL_WORDS: [RegExp, MealType, number, number][] = [
  [/\b(breakfast|pagi|morning|sarapan)\b/i, 'Breakfast', 8, 0],
  [/\b(lunch|tengah ?hari|noon|midday)\b/i, 'Lunch', 13, 0],
  [/\b(dinner|malam|tonight|night|evening|petang)\b/i, 'Dinner', 19, 30],
  [/\b(snack|supper|tea ?time|brunch)\b/i, 'Snack', 16, 0],
];

const FILLERS =
  /\b(i|i'm|im|saya|aku|just|a|an|the|some|for|at|on|in|of|with|this|today|tadi|hari ini|yesterday|semalam|morning|pagi|noon|lunch|dinner|breakfast|malam|night|tonight|evening|petang|then|ate|eat|eaten|had|drank|drink|bought|buy|beli|purchased|paid|spent|ordered|order|makan|minum|dah|telah|tengah ?hari|rm|myr|ringgit|from|dekat|di|untuk)\b/gi;

function cleanItem(clause: string): string {
  const s = clause.replace(FILLERS, ' ').replace(/[^\p{L}\p{N}\s'&-]/gu, ' ').replace(/\s+/g, ' ').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

function uid(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function quantityBefore(clause: string, alias: string): number {
  const idx = clause.toLowerCase().indexOf(alias.toLowerCase());
  if (idx < 0) return 1;
  const before = clause.slice(0, idx).trim().split(/\s+/).slice(-2).join(' ').toLowerCase();
  const m = new RegExp(`(?:^|\\s)(\\d+(?:\\.\\d+)?|${NUM_WORD}|a|an)\\s*(?:x\\s*)?$`, 'i').exec(before);
  if (!m) return 1;
  const tok = m[1].toLowerCase();
  if (tok === 'a' || tok === 'an') return 1;
  const n = /^\d/.test(tok) ? parseFloat(tok) : wordsToNumber(tok);
  return n && n > 0 && n <= 20 ? n : 1;
}

export function splitClauses(text: string): string[] {
  return text
    .split(/\s*(?:,|;|\bthen\b|\band\b|\bdan\b|\bplus\b|&|\.(?=\s|$))\s*/i)
    .map((c) => c.trim())
    .filter(Boolean);
}

export interface ParseOptions {
  now: number;
  tz: string;
  customFoods?: FoodRef[];
}

export function parseQuickLog(text: string, { now, tz, customFoods = [] }: ParseOptions): Draft[] {
  const drafts: Draft[] = [];
  const clauses = splitClauses(text);
  let carry: Intent = 'none';
  const dayShift = /\b(yesterday|semalam)\b/i.test(text) ? -1 : 0;

  for (const clause of clauses) {
    const own = intentOf(clause);
    const intent: Intent = own !== 'none' ? own : carry;
    if (own !== 'none') carry = own;

    const priceHit = extractPrice(clause);
    const rest = priceHit ? priceHit.rest : clause;
    const warnings: string[] = [];

    const foodHit = findFood(rest, customFoods);
    const delivery = FOOD_DELIVERY.test(rest);
    const nonFoodCat = delivery ? null : NON_FOOD_RULES.find(([re]) => re.test(rest))?.[1] ?? null;
    const isFoodClause = !nonFoodCat && (!!foodHit || delivery || GENERIC_MEAL.test(rest) || intent === 'eaten');

    let ts = now;
    let tsInferred = true;
    let mealType: MealType | null = null;
    const baseDay = addDays(dayKey(now, tz), dayShift);
    for (const [re, type, h, mi] of MEAL_WORDS) {
      if (re.test(clause)) {
        mealType = type;
        const t = zonedToEpoch(baseDay, h, mi, tz);
        ts = dayShift === 0 ? Math.min(t, now) : t;
        tsInferred = false;
        break;
      }
    }
    if (tsInferred && dayShift !== 0) {
      ts = zonedToEpoch(baseDay, 12, 0, tz);
      tsInferred = false;
      warnings.push('Time of day not given; set to 12:00. Edit if needed.');
    }
    if (!mealType) {
      const h = hourOf(ts, tz);
      mealType = h < 11 ? 'Breakfast' : h < 15 ? 'Lunch' : h < 18 ? 'Snack' : 'Dinner';
    }

    if (!isFoodClause) {
      if (!priceHit) continue;
      const item = cleanItem(rest) || 'Expense';
      const category: Category = nonFoodCat ?? 'Other';
      if (!nonFoodCat) warnings.push('Could not tell what category this is. Please check.');
      drafts.push({ draftId: uid(), text: clause, item, expense: { amountSen: priceHit.sen, category }, meal: null, ts, tsInferred, warnings });
      continue;
    }

    const eaten = intent !== 'bought';
    if (foodHit) {
      const qty = quantityBefore(rest, foodHit.alias);
      const portion = 'regular' as const;
      const n = scaleNutrition(foodHit.food, qty, portion);
      if (intent === 'bought') warnings.push('Marked as bought only. Tick "I ate this" to count calories.');
      if (foodHit.food.note) warnings.push(foodHit.food.note);
      drafts.push({
        draftId: uid(),
        text: clause,
        item: foodHit.food.name,
        expense: priceHit ? { amountSen: priceHit.sen, category: 'Food & Drinks' } : null,
        meal: {
          eaten: priceHit ? eaten : true,
          foodName: foodHit.food.name,
          servingLabel: foodHit.food.serving,
          quantity: qty,
          portion,
          kcal: n.kcal,
          proteinG: n.proteinG,
          carbsG: n.carbsG,
          fatG: n.fatG,
          nutritionSource: 'reference-estimate',
          confidence: 'medium',
          mealType,
          note: `Approximate: typically ${foodHit.food.kcalLow}-${foodHit.food.kcalHigh} kcal per serving.`,
          baseKey: foodHit.food.key,
        },
        ts,
        tsInferred,
        warnings,
      });
      continue;
    }

    const item = cleanItem(rest);
    if (priceHit && !item) {
      const gm = GENERIC_MEAL.exec(rest);
      drafts.push({
        draftId: uid(),
        text: clause,
        item: gm ? gm[0].charAt(0).toUpperCase() + gm[0].slice(1).toLowerCase() : 'Food',
        expense: { amountSen: priceHit.sen, category: 'Food & Drinks' },
        meal: null,
        ts,
        tsInferred,
        warnings: ['Food not specified, so no calories were logged. Add the food on the Activity tab to count calories.'],
      });
      continue;
    }
    if (!item && !priceHit) continue;
    const generic = GENERIC_MEAL.exec(item.toLowerCase());
    const itemOnlyGeneric = generic && item.toLowerCase() === generic[0];
    if (priceHit && itemOnlyGeneric) {
      drafts.push({
        draftId: uid(),
        text: clause,
        item,
        expense: { amountSen: priceHit.sen, category: 'Food & Drinks' },
        meal: null,
        ts,
        tsInferred,
        warnings: ['Food not specified, so no calories were logged.'],
      });
      continue;
    }
    drafts.push({
      draftId: uid(),
      text: clause,
      item,
      expense: priceHit ? { amountSen: priceHit.sen, category: 'Food & Drinks' } : null,
      meal: {
        eaten: priceHit ? eaten : intent !== 'bought',
        foodName: item,
        servingLabel: '1 serving',
        quantity: 1,
        portion: 'regular',
        kcal: null,
        proteinG: null,
        carbsG: null,
        fatG: null,
        nutritionSource: 'unknown',
        confidence: 'none',
        mealType,
      },
      ts,
      tsInferred,
      warnings,
    });
  }
  return drafts;
}
