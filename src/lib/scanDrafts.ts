import { FOODS, scaleByUnit, servingGrams, suggestFoods } from './foods';
import { newId } from './store';
import { hourOf } from './time';
import { searchWebFoods } from './webFood';
import type { Draft, FoodRef, MealType } from './types';

/** A reviewable "I ate this" draft from a found food, or an empty-macro one when nothing matched. */
export function foodToDraft(name: string, food: FoodRef | null, servings: number, now: number, tz: string): Draft {
  // Per-100 g database foods are logged in grams (100 g to start), since "1 plate" has no weight there.
  const grams = !!food?.source && servingGrams(food) === 100;
  const unit = grams ? 'g' : 'serving';
  const qty = grams ? 100 : servings;
  const n = food ? scaleByUnit(food, qty, unit, 'regular') : null;
  const h = hourOf(now, tz);
  const mealType: MealType = h < 11 ? 'Breakfast' : h < 16 ? 'Lunch' : h < 20 ? 'Snack' : 'Dinner';
  const shown = food?.name ?? name;
  return {
    draftId: newId(), text: name, item: shown, expense: null, ts: now, tsInferred: true, warnings: food ? [] : ['No macros found. Enter calories or search online.'],
    meal: {
      eaten: true, foodName: shown, servingLabel: food?.serving ?? '1 serving', quantity: qty, unit, portion: 'regular',
      kcal: n?.kcal ?? null, proteinG: n?.proteinG ?? null, carbsG: n?.carbsG ?? null, fatG: n?.fatG ?? null,
      nutritionSource: !food ? 'unknown' : food.source ?? 'reference-estimate',
      confidence: !food ? 'none' : 'medium', mealType, baseKey: food?.key,
      note: food?.note ?? (food ? `Approximate: typically ${food.kcalLow}-${food.kcalHigh} kcal per serving.` : undefined),
    } as Draft['meal'],
  };
}

/** Best food for a name: our table first, then online. Returns null when nothing is close (or offline). */
export async function resolveFood(name: string, customFoods: FoodRef[], signal?: AbortSignal): Promise<FoodRef | null> {
  const local = suggestFoods(name, [...customFoods, ...FOODS], 1, 0.7)[0];
  if (local) return local.food;
  try { return (await searchWebFoods(name, signal))[0] ?? null; } catch { return null; }
}
