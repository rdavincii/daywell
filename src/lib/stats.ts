import { addDays, dayKey, daysInMonth, monthKey, weekStart } from './time';
import type { AppState, Category } from './types';

// Every number on every dashboard comes from these functions, from saved records only.

export function spendOnDay(s: AppState, day: string): number {
  return s.expenses.reduce((t, e) => (dayKey(e.ts, s.settings.timezone) === day ? t + e.amountSen : t), 0);
}

export function spendInRange(s: AppState, fromDay: string, toDay: string): number {
  return s.expenses.reduce((t, e) => {
    const k = dayKey(e.ts, s.settings.timezone);
    return k >= fromDay && k <= toDay ? t + e.amountSen : t;
  }, 0);
}

export function spendInMonth(s: AppState, mKey: string): number {
  return s.expenses.reduce((t, e) => (monthKey(e.ts, s.settings.timezone) === mKey ? t + e.amountSen : t), 0);
}

export function categoryTotals(s: AppState, fromDay: string, toDay: string): { category: Category; sen: number }[] {
  const m = new Map<Category, number>();
  for (const e of s.expenses) {
    const k = dayKey(e.ts, s.settings.timezone);
    if (k >= fromDay && k <= toDay) m.set(e.category, (m.get(e.category) ?? 0) + e.amountSen);
  }
  return [...m.entries()].map(([category, sen]) => ({ category, sen })).sort((a, b) => b.sen - a.sen);
}

export interface DayNutrition {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  meals: number;
  /** meals that have no calorie value (counted as 0, but flagged so totals are not overstated) */
  mealsWithoutKcal: number;
}

export function nutritionOnDay(s: AppState, day: string): DayNutrition {
  const out: DayNutrition = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, meals: 0, mealsWithoutKcal: 0 };
  for (const m of s.meals) {
    if (dayKey(m.ts, s.settings.timezone) !== day) continue;
    out.meals += 1;
    if (m.kcal === null) out.mealsWithoutKcal += 1;
    out.kcal += m.kcal ?? 0;
    out.proteinG += m.proteinG ?? 0;
    out.carbsG += m.carbsG ?? 0;
    out.fatG += m.fatG ?? 0;
  }
  const r1 = (n: number) => Math.round(n * 10) / 10;
  out.proteinG = r1(out.proteinG);
  out.carbsG = r1(out.carbsG);
  out.fatG = r1(out.fatG);
  return out;
}

export function lastNDays(today: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => addDays(today, i - (n - 1)));
}

/** 7-day trend. Days with no meals are `null` (no data), never a made-up 0 or average. */
export function calorieTrend(s: AppState, today: string, n = 7): { day: string; kcal: number | null }[] {
  return lastNDays(today, n).map((day) => {
    const nut = nutritionOnDay(s, day);
    return { day, kcal: nut.meals > 0 ? nut.kcal : null };
  });
}

/** Average over days that actually have logged meals. */
export function averageIntake(trend: { kcal: number | null }[]): { avg: number; days: number } | null {
  const logged = trend.filter((t) => t.kcal !== null) as { kcal: number }[];
  if (!logged.length) return null;
  return { avg: Math.round(logged.reduce((t, x) => t + x.kcal, 0) / logged.length), days: logged.length };
}

export function topFoods(s: AppState, limit = 5): { name: string; count: number }[] {
  const m = new Map<string, number>();
  for (const x of s.meals) m.set(x.foodName, (m.get(x.foodName) ?? 0) + 1);
  return [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, limit);
}

export function budgetStatus(s: AppState, today: string) {
  const mKey = today.slice(0, 7);
  const spentToday = spendOnDay(s, today);
  const spentMonth = spendInMonth(s, mKey);
  return {
    spentToday,
    spentMonth,
    dailyBudget: s.settings.dailyBudgetSen,
    monthlyBudget: s.settings.monthlyBudgetSen,
    dailyRemaining: s.settings.dailyBudgetSen - spentToday,
    monthlyRemaining: s.settings.monthlyBudgetSen - spentMonth,
    daysInMonth: daysInMonth(mKey),
  };
}

export function weekRange(today: string) {
  const start = weekStart(today);
  return { start, end: addDays(start, 6) };
}

/** Insights are only returned when the saved records genuinely support them. */
export function insights(s: AppState, today: string): string[] {
  const out: string[] = [];
  const thisW = weekRange(today);
  const lastW = { start: addDays(thisW.start, -7), end: addDays(thisW.start, -1) };
  const eatOut = (from: string, to: string) =>
    categoryTotals(s, from, to).find((c) => c.category === 'Food & Drinks')?.sen ?? 0;
  const hasLast = s.expenses.some((e) => {
    const k = dayKey(e.ts, s.settings.timezone);
    return e.category === 'Food & Drinks' && k >= lastW.start && k <= lastW.end;
  });
  if (hasLast) {
    const elapsed = Math.round((Date.parse(today) - Date.parse(thisW.start)) / 86400000);
    const thisSpend = eatOut(thisW.start, today);
    const lastSpend = eatOut(lastW.start, addDays(lastW.start, elapsed));
    const diff = lastSpend - thisSpend;
    if (diff > 0) out.push(`Food & Drinks spending is RM${(diff / 100).toFixed(2)} lower than the same days last week.`);
    else if (diff < 0) out.push(`Food & Drinks spending is RM${(-diff / 100).toFixed(2)} higher than the same days last week.`);
  }
  const b = budgetStatus(s, today);
  if (b.dailyBudget > 0 && b.spentToday >= b.dailyBudget * 0.8) {
    const pct = Math.round((b.spentToday / b.dailyBudget) * 100);
    out.push(`You have used ${pct}% of today's budget.`);
  }
  const n = nutritionOnDay(s, today);
  if (s.settings.kcalTarget > 0 && n.meals > 0 && n.kcal >= s.settings.kcalTarget * 0.9) {
    out.push(n.kcal > s.settings.kcalTarget ? 'You are over your calorie target today.' : "You're approaching your calorie target.");
  }
  return out;
}

export function calculateSavings(s: AppState, today: string): number {
  if (s.settings.dailyBudgetSen <= 0) return 0;
  
  const dailySpend = new Map<string, number>();
  for (const e of s.expenses) {
    const k = dayKey(e.ts, s.settings.timezone);
    if (k >= today) continue;
    dailySpend.set(k, (dailySpend.get(k) || 0) + e.amountSen);
  }

  let totalSavings = 0;
  if (s.expenses.length === 0) return 0;
  
  let earliest = today;
  for (const e of s.expenses) {
    const k = dayKey(e.ts, s.settings.timezone);
    if (k < earliest) earliest = k;
  }

  let curr = earliest;
  while (curr < today) {
    const spent = dailySpend.get(curr) || 0;
    const remaining = s.settings.dailyBudgetSen - spent;
    if (remaining > 0) {
      totalSavings += remaining;
    }
    curr = addDays(curr, 1);
  }
  
  return totalSavings;
}

export function suggestMacros(targetKcal: number, weightKg: number) {
  // Protein: 1.8g per kg body weight (floor 60g)
  const pG = Math.round(Math.max(60, weightKg * 1.8));
  // Fat: 0.9g per kg body weight (floor 45g)
  const fG = Math.round(Math.max(45, weightKg * 0.9));
  // Carbs: remainder of calories (4 kcal per g)
  const rem = Math.max(0, targetKcal - (pG * 4 + fG * 9));
  const cG = Math.round(rem / 4);
  return { proteinTarget: pG, fatTarget: fG, carbsTarget: cG };
}

export function calculateSuggestedTargetDate(currentKg: number, targetKg: number, todayStr: string): string {
  const delta = Math.abs(currentKg - targetKg);
  if (delta === 0) return todayStr;
  // Realistic safe adjustment: 0.5 kg per week
  const weeks = Math.ceil(delta / 0.5);
  return addDays(todayStr, weeks * 7);
}
