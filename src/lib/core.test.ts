import { describe, expect, it } from 'vitest';
import { formatRM, parseToSen } from './money';
import { dayKey, fromFormFields, toFormFields, weekStart, zonedToEpoch } from './time';
import { parseQuickLog } from './parser';
import {
  commitDrafts, deleteExpense, deleteMeal, emptyState, loadState, markEaten, saveState, sanitize, updateExpense, updateMeal, toCSV,
} from './store';
import { averageIntake, calorieTrend, insights, nutritionOnDay, spendInMonth, spendOnDay } from './stats';

const TZ = 'Asia/Kuala_Lumpur';
const NOW = Date.UTC(2026, 9, 22, 3, 55); // 2026-10-22 11:55 KL
const TODAY = '2026-10-22';
const opts = { now: NOW, tz: TZ };

function save(state = emptyState(), text: string, key = 'k' + Math.random()) {
  const drafts = parseQuickLog(text, opts);
  return { state: commitDrafts(state, drafts, key, { source: 'text', transcript: text }), drafts };
}

describe('money', () => {
  it('formats and parses without float drift', () => {
    expect(formatRM(350)).toBe('RM3.50');
    expect(formatRM(123456)).toBe('RM1,234.56');
    expect(parseToSen('3.5')).toBe(350);
    expect(parseToSen('RM 5')).toBe(500);
    expect(parseToSen('0.1')).toBe(10);
    expect(parseToSen('abc')).toBeNull();
    // classic float trap: 0.1 + 0.2
    expect(parseToSen('0.10')! + parseToSen('0.20')!).toBe(30);
  });
});

describe('timezone', () => {
  it('uses Asia/Kuala_Lumpur day boundaries, not UTC', () => {
    const t = Date.UTC(2026, 9, 21, 17, 0); // 01:00 on the 22nd in KL
    expect(dayKey(t, TZ)).toBe('2026-10-22');
    expect(dayKey(t, 'UTC')).toBe('2026-10-21');
  });
  it('round-trips form fields', () => {
    const ts = zonedToEpoch('2026-10-22', 8, 15, TZ);
    expect(toFormFields(ts, TZ)).toEqual({ date: '2026-10-22', time: '08:15' });
    expect(fromFormFields('2026-10-22', '08:15', TZ)).toBe(ts);
  });
  it('weeks start on Monday', () => {
    expect(weekStart('2026-10-22')).toBe('2026-10-19');
  });
});

describe('parser', () => {
  it('A: "Nasi Lemak RM5" -> expense RM5 Food & Drinks + estimated meal', () => {
    const d = parseQuickLog('Nasi Lemak RM5', opts);
    expect(d).toHaveLength(1);
    expect(d[0].expense).toMatchObject({ amountSen: 500, category: 'Food & Drinks' });
    expect(d[0].meal?.foodName).toBe('Nasi lemak');
    expect(d[0].meal?.kcal).toBeGreaterThan(0);
    expect(d[0].meal?.nutritionSource).toBe('reference-estimate');
  });
  it('B: two purchases, bought-only is NOT counted as eaten', () => {
    const d = parseQuickLog('I bought chicken rice for RM8 and iced Milo for RM3.50', opts);
    expect(d).toHaveLength(2);
    expect(d.map((x) => x.expense?.amountSen)).toEqual([800, 350]);
    expect(d.every((x) => x.meal && !x.meal.eaten)).toBe(true);
  });
  it('C: "Petrol RM50" -> Transport, no meal', () => {
    const d = parseQuickLog('Petrol RM50', opts);
    expect(d[0].expense).toMatchObject({ amountSen: 5000, category: 'Transport' });
    expect(d[0].meal).toBeNull();
  });
  it('D: food without a price -> meal only, no invented expense; quantities parsed', () => {
    const d = parseQuickLog('I ate two boiled eggs and a banana', opts);
    expect(d).toHaveLength(2);
    expect(d.every((x) => x.expense === null)).toBe(true);
    expect(d[0].meal).toMatchObject({ quantity: 2, eaten: true });
    expect(d[0].meal?.kcal).toBe(156);
    expect(d[1].meal?.foodName).toBe('Banana');
  });
  it('E: "Bought lunch for RM12" -> expense only, no calories invented', () => {
    const d = parseQuickLog('Bought lunch for RM12', opts);
    expect(d).toHaveLength(1);
    expect(d[0].expense).toMatchObject({ amountSen: 1200, category: 'Food & Drinks' });
    expect(d[0].meal).toBeNull();
    expect(d[0].warnings.join(' ')).toMatch(/no calories/i);
  });
  it('voice example with number words and per-clause intent', () => {
    const d = parseQuickLog(
      'I had nasi lemak for five ringgit this morning, then bought chicken rice for eight ringgit at lunch.',
      opts,
    );
    expect(d).toHaveLength(2);
    expect(d[0].expense?.amountSen).toBe(500);
    expect(d[0].meal?.eaten).toBe(true);
    expect(d[0].meal?.mealType).toBe('Breakfast');
    expect(d[1].expense?.amountSen).toBe(800);
    expect(d[1].meal?.eaten).toBe(false);
  });
  it('supports Bahasa Melayu', () => {
    const d = parseQuickLog('Beli roti canai RM2.50', opts);
    expect(d[0].expense?.amountSen).toBe(250);
    expect(d[0].meal?.foodName).toBe('Roti canai');
  });
  it('never fabricates a price', () => {
    const d = parseQuickLog('I ate satay', opts);
    expect(d[0].expense).toBeNull();
  });
  it('unknown food keeps calories null instead of guessing', () => {
    const d = parseQuickLog('I ate kuih bahulu', opts);
    expect(d[0].meal?.kcal).toBeNull();
    expect(d[0].meal?.nutritionSource).toBe('unknown');
  });
  it('no price and no food -> nothing saved', () => {
    expect(parseQuickLog('hello there', opts)).toHaveLength(0);
  });
});

describe('store and totals', () => {
  it('1. Nasi Lemak RM5 records expense and nutrition', () => {
    const { state } = save(emptyState(), 'Nasi Lemak RM5');
    expect(state.expenses).toHaveLength(1);
    expect(state.meals).toHaveLength(1);
    expect(state.meals[0].expenseId).toBe(state.expenses[0].id);
    expect(spendOnDay(state, TODAY)).toBe(500);
    expect(nutritionOnDay(state, TODAY).kcal).toBe(600);
  });
  it('2. Petrol adds no calories', () => {
    const { state } = save(emptyState(), 'Petrol RM50');
    expect(state.meals).toHaveLength(0);
    expect(nutritionOnDay(state, TODAY).kcal).toBe(0);
    expect(spendOnDay(state, TODAY)).toBe(5000);
  });
  it('3. purchased-but-not-eaten leaves calories unchanged', () => {
    const { state } = save(emptyState(), 'I bought chicken rice for RM8');
    expect(spendOnDay(state, TODAY)).toBe(800);
    expect(nutritionOnDay(state, TODAY).kcal).toBe(0);
  });
  it('4. several items in one sentence -> separate records', () => {
    const { state } = save(emptyState(), 'I had chicken rice for RM8 and teh tarik for RM2.50');
    expect(state.expenses).toHaveLength(2);
    expect(state.meals).toHaveLength(2);
    expect(spendOnDay(state, TODAY)).toBe(1050);
  });
  it('5. editing meal calories updates totals', () => {
    let { state } = save(emptyState(), 'Nasi Lemak RM5');
    state = updateMeal(state, state.meals[0].id, { kcal: 450, nutritionSource: 'manual' });
    expect(nutritionOnDay(state, TODAY).kcal).toBe(450);
  });
  it('6. editing an expense updates financial totals', () => {
    let { state } = save(emptyState(), 'Nasi Lemak RM5');
    state = updateExpense(state, state.expenses[0].id, { amountSen: 650 });
    expect(spendOnDay(state, TODAY)).toBe(650);
    expect(spendInMonth(state, '2026-10')).toBe(650);
  });
  it('7. deleting linked records stays consistent', () => {
    const base = save(emptyState(), 'Nasi Lemak RM5').state;
    const a = deleteExpense(base, base.expenses[0].id);
    expect(a.expenses).toHaveLength(0);
    expect(a.meals).toHaveLength(1);
    expect(a.meals[0].expenseId).toBeUndefined();
    const b = deleteExpense(base, base.expenses[0].id, true);
    expect(b.meals).toHaveLength(0);
    const c = deleteMeal(base, base.meals[0].id);
    expect(c.expenses).toHaveLength(1);
    expect(nutritionOnDay(c, TODAY).kcal).toBe(0);
    const dd = deleteMeal(base, base.meals[0].id, true);
    expect(dd.expenses).toHaveLength(0);
  });
  it('16. linked meals never double count spending', () => {
    const { state } = save(emptyState(), 'Nasi Lemak RM5');
    expect(state.meals[0].expenseId).toBeTruthy();
    expect(spendOnDay(state, TODAY)).toBe(500);
  });
  it('17. calories include only confirmed consumption', () => {
    let { state } = save(emptyState(), 'I bought chicken rice for RM8');
    expect(nutritionOnDay(state, TODAY).kcal).toBe(0);
    const draft = parseQuickLog('chicken rice', opts)[0].meal!;
    state = markEaten(state, state.expenses[0].id, {
      ts: NOW, mealType: 'Lunch', foodName: draft.foodName, servingLabel: draft.servingLabel, quantity: 1, portion: 'regular',
      kcal: draft.kcal, proteinG: draft.proteinG, carbsG: draft.carbsG, fatG: draft.fatG,
      nutritionSource: 'reference-estimate', confidence: 'medium', source: 'manual',
    });
    expect(nutritionOnDay(state, TODAY).kcal).toBe(600);
    expect(spendOnDay(state, TODAY)).toBe(800); // still not double counted
    // cannot mark eaten twice
    const again = markEaten(state, state.expenses[0].id, state.meals[0]);
    expect(again.meals).toHaveLength(1);
  });
  it('18. late-night record lands on the KL day', () => {
    const late = Date.UTC(2026, 9, 21, 17, 30); // 01:30 on 22nd in KL
    let s = emptyState();
    s = { ...s, expenses: [{ id: 'x', ts: late, item: 'Supper', category: 'Food & Drinks', amountSen: 700, currency: 'MYR', source: 'manual' }] };
    expect(spendOnDay(s, '2026-10-22')).toBe(700);
    expect(spendOnDay(s, '2026-10-21')).toBe(0);
  });
  it('retrying the same submission does not duplicate', () => {
    const drafts = parseQuickLog('Nasi Lemak RM5', opts);
    let s = commitDrafts(emptyState(), drafts, 'same-key', { source: 'text' });
    s = commitDrafts(s, drafts, 'same-key', { source: 'text' });
    expect(s.expenses).toHaveLength(1);
    expect(s.meals).toHaveLength(1);
  });
  it('persists and reloads; bad storage never throws', () => {
    const mem: Record<string, string> = {};
    const storage = { getItem: (k: string) => mem[k] ?? null, setItem: (k: string, v: string) => void (mem[k] = v) };
    const { state } = save(emptyState(), 'Nasi Lemak RM5');
    expect(saveState(state, storage)).toBe(true);
    expect(loadState(storage).expenses).toHaveLength(1);
    mem['daywell:v1'] = '{not json';
    expect(loadState(storage).expenses).toHaveLength(0);
    expect(saveState(state, { setItem: () => { throw new Error('quota'); } })).toBe(false);
    expect(sanitize(null).expenses).toEqual([]);
  });
  it('trend leaves empty days as null and averages only logged days', () => {
    const { state } = save(emptyState(), 'Nasi Lemak RM5');
    const t = calorieTrend(state, TODAY);
    expect(t).toHaveLength(7);
    expect(t.filter((x) => x.kcal === null)).toHaveLength(6);
    expect(averageIntake(t)).toEqual({ avg: 600, days: 1 });
  });
  it('insights only appear when records support them', () => {
    expect(insights(emptyState(), TODAY)).toEqual([]);
  });
  it('CSV export escapes commas', () => {
    let s = emptyState();
    s = { ...s, expenses: [{ id: 'a', ts: NOW, item: 'Nasi, ayam', category: 'Food & Drinks', amountSen: 500, currency: 'MYR', source: 'manual' }] };
    expect(toCSV(s)).toContain('"Nasi, ayam"');
  });
});
