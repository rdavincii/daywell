import { DEFAULT_SETTINGS } from './types';
import { dayKey, addDays } from './time';

export function touchStreak(state: AppState, ts: number): AppState {
  const today = dayKey(ts, state.settings.timezone);
  if (state.lastActiveDay === today) return state;
  
  const yesterday = addDays(today, -1);
  let streak = state.streak || 0;
  if (state.lastActiveDay === yesterday) {
    streak += 1;
  } else {
    streak = 1;
  }
  return { ...state, streak, lastActiveDay: today };
}

import type { AppState, Draft, Expense, Meal } from './types';

export const STORAGE_KEY = 'daywell:v1';
const MAX_SAVED_KEYS = 200;

export function emptyState(): AppState {
  return { version: 1, expenses: [], meals: [], settings: { ...DEFAULT_SETTINGS }, savedKeys: [], weightLogs: [], streak: 0, lastActiveDay: '', customFoods: [] };
}

export function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function commitDrafts(
  state: AppState,
  drafts: Draft[],
  submissionKey: string,
  meta: { source: Expense['source']; transcript?: string },
): AppState {
  if (state.savedKeys.includes(submissionKey)) return state;
  const expenses = [...state.expenses];
  const meals = [...state.meals];
  for (const d of drafts) {
    let expenseId: string | undefined;
    if (d.expense && Number.isSafeInteger(d.expense.amountSen) && d.expense.amountSen > 0) {
      expenseId = newId();
      expenses.push({
        id: expenseId,
        ts: d.ts,
        item: d.item.trim() || 'Expense',
        merchant: d.expense.merchant,
        category: d.expense.category,
        amountSen: d.expense.amountSen,
        currency: state.settings.currency,
        source: meta.source,
        transcript: meta.transcript,
      });
    }
    if (d.meal && d.meal.eaten) {
      meals.push({
        id: newId(),
        ts: d.ts,
        mealType: d.meal.mealType,
        foodName: d.meal.foodName.trim() || d.item,
        servingLabel: d.meal.servingLabel,
        quantity: d.meal.quantity,
        portion: d.meal.portion,
        kcal: d.meal.kcal,
        proteinG: d.meal.proteinG,
        carbsG: d.meal.carbsG,
        fatG: d.meal.fatG,
        nutritionSource: d.meal.nutritionSource,
        confidence: d.meal.confidence,
        note: d.meal.note,
        expenseId,
        source: meta.source,
        transcript: meta.transcript,
      });
    }
  }
  const savedKeys = [...state.savedKeys, submissionKey].slice(-MAX_SAVED_KEYS);
  return touchStreak({ ...state, expenses, meals, savedKeys }, Date.now());
}

export function updateExpense(state: AppState, id: string, patch: Partial<Expense>): AppState {
  return { ...state, expenses: state.expenses.map((e) => (e.id === id ? { ...e, ...patch, id } : e)) };
}

export function updateMeal(state: AppState, id: string, patch: Partial<Meal>): AppState {
  return { ...state, meals: state.meals.map((m) => (m.id === id ? { ...m, ...patch, id } : m)) };
}

export function deleteExpense(state: AppState, id: string, alsoDeleteMeal = false): AppState {
  return {
    ...state,
    expenses: state.expenses.filter((e) => e.id !== id),
    meals: alsoDeleteMeal
      ? state.meals.filter((m) => m.expenseId !== id)
      : state.meals.map((m) => (m.expenseId === id ? { ...m, expenseId: undefined } : m)),
  };
}

export function deleteMeal(state: AppState, id: string, alsoDeleteExpense = false): AppState {
  const meal = state.meals.find((m) => m.id === id);
  const next = { ...state, meals: state.meals.filter((m) => m.id !== id) };
  if (alsoDeleteExpense && meal?.expenseId) {
    return { ...next, expenses: next.expenses.filter((e) => e.id !== meal.expenseId) };
  }
  return next;
}

export function markEaten(state: AppState, expenseId: string, meal: Omit<Meal, 'id' | 'expenseId'>): AppState {
  const exp = state.expenses.find((e) => e.id === expenseId);
  if (!exp || state.meals.some((m) => m.expenseId === expenseId)) return state;
  return touchStreak({ ...state, meals: [...state.meals, { ...meal, id: newId(), expenseId }] }, meal.ts);
}

export function addExpenseToMeal(state: AppState, mealId: string, expense: Omit<Expense, 'id'>): AppState {
  const newExpId = newId();
  const exp: Expense = { ...expense, id: newExpId };
  return touchStreak({
    ...state,
    expenses: [...state.expenses, exp],
    meals: state.meals.map((m) => m.id === mealId ? { ...m, expenseId: newExpId } : m)
  }, expense.ts);
}

export function sanitize(raw: unknown): AppState {
  const base = emptyState();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<AppState>;
  return {
    version: 1,
    expenses: Array.isArray(r.expenses) ? r.expenses.filter((e) => e && typeof e.id === 'string' && Number.isSafeInteger(e.amountSen)) : [],
    meals: Array.isArray(r.meals) ? r.meals.filter((m) => m && typeof m.id === 'string') : [],
    settings: { ...DEFAULT_SETTINGS, ...(r.settings ?? {}) },
    savedKeys: Array.isArray(r.savedKeys) ? r.savedKeys.filter((k) => typeof k === 'string') : [],
    weightLogs: Array.isArray(r.weightLogs) ? r.weightLogs.filter((w) => w && typeof w.ts === 'number' && typeof w.weightKg === 'number') : [],
    streak: typeof r.streak === 'number' ? r.streak : 0,
    lastActiveDay: typeof r.lastActiveDay === 'string' ? r.lastActiveDay : '',
    customFoods: Array.isArray(r.customFoods) ? r.customFoods : [],
  };
}

export function loadState(storage: Pick<Storage, 'getItem'> | null = safeStorage()): AppState {
  try {
    const s = storage?.getItem(STORAGE_KEY);
    return s ? sanitize(JSON.parse(s)) : emptyState();
  } catch {
    return emptyState();
  }
}

export function saveState(state: AppState, storage: Pick<Storage, 'setItem'> | null = safeStorage()): boolean {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(state));
    return !!storage;
  } catch {
    return false;
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

export function toCSV(state: AppState): string {
  const esc = (v: string | number | undefined) => {
    const s = v === undefined ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = ['type,iso_time,item,category_or_meal,amount_rm,kcal,protein_g,carbs_g,fat_g,linked'];
  for (const e of state.expenses) {
    rows.push(['expense', new Date(e.ts).toISOString(), e.item, e.category, (e.amountSen / 100).toFixed(2), '', '', '', '', ''].map(esc).join(','));
  }
  for (const m of state.meals) {
    rows.push(['meal', new Date(m.ts).toISOString(), m.foodName, m.mealType, '', m.kcal ?? '', m.proteinG ?? '', m.carbsG ?? '', m.fatG ?? '', m.expenseId ? 'yes' : ''].map(esc).join(','));
  }
  return rows.join('\n');
}

export function duplicateEntry(state: AppState, expense?: Expense, meal?: Meal): AppState {
  const now = Date.now();
  let newExpenseId: string | undefined;
  const expenses = [...state.expenses];
  const meals = [...state.meals];

  if (expense) {
    newExpenseId = newId();
    expenses.unshift({
      ...expense,
      id: newExpenseId,
      ts: now,
    });
  }

  if (meal) {
    meals.unshift({
      ...meal,
      id: newId(),
      ts: now,
      expenseId: newExpenseId,
    });
  }

  return { ...state, expenses, meals };
}

export function logWeight(state: AppState, weightKg: number, ts: number): AppState {
  const latest = state.weightLogs.length > 0 ? state.weightLogs[state.weightLogs.length - 1] : null;
  if (latest && latest.weightKg === weightKg && (ts - latest.ts) < 86400000) {
    return state;
  }
  const logs = [...state.weightLogs, { ts, weightKg }].sort((a, b) => a.ts - b.ts);
  return touchStreak({ ...state, weightLogs: logs, settings: { ...state.settings, currentWeightKg: weightKg } }, ts);
}
