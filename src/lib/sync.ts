import type { AppState, Expense, Meal, WeightLog, FoodRef } from './types';
import { sanitize } from './store';

export function mergeStates(local: AppState, remote: Partial<AppState>): AppState {
  const cleanRemote = sanitize(remote);

  // Deduplicate expenses by ID
  const expMap = new Map<string, Expense>();
  for (const e of local.expenses) expMap.set(e.id, e);
  for (const e of cleanRemote.expenses) expMap.set(e.id, e);
  const expenses = Array.from(expMap.values()).sort((a, b) => b.ts - a.ts);

  // Deduplicate meals by ID
  const mealMap = new Map<string, Meal>();
  for (const m of local.meals) mealMap.set(m.id, m);
  for (const m of cleanRemote.meals) mealMap.set(m.id, m);
  const meals = Array.from(mealMap.values()).sort((a, b) => b.ts - a.ts);

  // Deduplicate weight logs by timestamp
  const wMap = new Map<number, WeightLog>();
  for (const w of local.weightLogs) wMap.set(w.ts, w);
  for (const w of cleanRemote.weightLogs) wMap.set(w.ts, w);
  const weightLogs = Array.from(wMap.values()).sort((a, b) => a.ts - b.ts);


  // Deduplicate custom recipes by key
  const foodMap = new Map<string, FoodRef>();
  for (const f of local.customFoods || []) foodMap.set(f.key, f);
  for (const f of cleanRemote.customFoods || []) foodMap.set(f.key, f);
  const customFoods = Array.from(foodMap.values());

  // Merge saved idempotency keys
  const savedKeys = Array.from(new Set([...local.savedKeys, ...cleanRemote.savedKeys])).slice(-200);

  // Merge streaks and timestamps
  const streak = Math.max(local.streak || 0, cleanRemote.streak || 0);
  const lastActiveDay = (local.lastActiveDay || '') > (cleanRemote.lastActiveDay || '')
    ? local.lastActiveDay
    : cleanRemote.lastActiveDay;

  return {
    version: 1,
    expenses,
    meals,
    weightLogs,
    savedKeys,
    streak,
    lastActiveDay,
    customFoods,
    settings: {
      ...local.settings,
      ...cleanRemote.settings,
      categoryBudgetsSen: {
        ...local.settings.categoryBudgetsSen,
        ...cleanRemote.settings.categoryBudgetsSen,
      },
    },
  };
}

export function exportBackupJSON(state: AppState): void {
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(state, null, 2));
  const a = document.createElement('a');
  a.setAttribute('href', dataStr);
  a.setAttribute('download', `daywell-backup-${new Date().toISOString().slice(0, 10)}.json`);
  document.body.appendChild(a);
  a.click();
  a.remove();
}
