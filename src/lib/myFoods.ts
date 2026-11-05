import { findFood, foodByKey } from './foods';
import type { Draft, FoodRef } from './types';

/**
 * Foods worth remembering from what was just logged, so the next time they are found instantly and offline
 * (like "My foods" in MyFitnessPal): online/AI foods as found, and foods whose macros you typed yourself.
 */
export function foodsToRemember(drafts: Draft[], known: FoodRef[]): FoodRef[] {
  const out: FoodRef[] = [];
  const has = (key: string) => known.some((k) => k.key === key) || out.some((o) => o.key === key);
  for (const d of drafts) {
    const m = d.meal;
    if (!m?.eaten || m.kcal === null) continue;
    if (m.baseKey && (m.nutritionSource === 'web' || m.nutritionSource === 'ai')) {
      const f = foodByKey(m.baseKey, known);
      if (f && !has(f.key)) out.push({ ...f, mine: true });
    } else if (!m.baseKey && m.nutritionSource === 'manual' && (!m.unit || m.unit === 'serving') && m.quantity > 0) {
      const name = m.foodName.trim();
      const key = 'mine-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
      if (!name || has(key) || findFood(name, known)) continue;
      const per = (v: number | null) => Math.round(((v ?? 0) / m.quantity) * 10) / 10;
      const kcal = Math.round(m.kcal / m.quantity);
      out.push({ key, name, aliases: [], serving: m.servingLabel || '1 serving', kcal, proteinG: per(m.proteinG), carbsG: per(m.carbsG), fatG: per(m.fatG),
        kcalLow: Math.round(kcal * 0.8), kcalHigh: Math.round(kcal * 1.2), note: 'Saved from what you logged.', mine: true });
    }
  }
  return out;
}
