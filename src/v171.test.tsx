// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FOODS, convertQty, findFood, scaleByUnit, suggestFoods, unitOptions } from './lib/foods';
import { parseEstimate } from './lib/vision';
import { foodsToRemember } from './lib/myFoods';
import { stateSig, syncOnce } from './lib/cloud';
import { emptyState } from './lib/store';
import { QuickLog } from './QuickLog';
import type { Draft, FoodRef } from './lib/types';

beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const f = (key: string) => FOODS.find((x) => x.key === key)!;
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });

describe('units', () => {
  const per100: FoodRef = { key: 'x', name: 'X', aliases: [], serving: '100 g', kcal: 200, proteinG: 10, carbsG: 20, fatG: 5, kcalLow: 200, kcalHigh: 200 };
  it('grams scale macros exactly', () => {
    expect(scaleByUnit(per100, 250, 'g', 'regular')).toMatchObject({ kcal: 500, proteinG: 25, carbsG: 50, fatG: 12.5 });
    expect(scaleByUnit(per100, 1, 'oz', 'regular').kcal).toBe(57);
  });
  it('pieces use the piece weight (3 eggs of 50 g)', () => {
    const egg = f('boiled-egg');
    expect(unitOptions(egg).map((u) => u.id)).toEqual(['serving', 'g', 'oz', 'piece']);
    expect(scaleByUnit(egg, 3, 'piece', 'regular').kcal).toBe(Math.round(egg.kcal * 3));
    expect(scaleByUnit(egg, 100, 'g', 'regular').kcal).toBe(Math.round(egg.kcal * 2));
  });
  it('a food with no known weight only offers its serving, and never changes the macros by unit', () => {
    const nl = f('nasi-lemak');
    expect(unitOptions(nl)).toEqual([{ id: 'serving', label: 'serving' }]);
    expect(scaleByUnit(nl, 2, 'g', 'regular').kcal).toBe(1100);
  });
  it('switching unit keeps the same amount of food', () => {
    expect(convertQty(per100, 1, 'serving', 'g')).toBe(100);
    expect(convertQty(per100, 250, 'g', 'serving')).toBe(2.5);
  });
});

describe('more Malaysian foods', () => {
  it('finds buttermilk chicken rice and the dish from typos', () => {
    expect(findFood('nasi buttermilk')?.food.key).toBe('nasi-ayam-butter');
    expect(findFood('ayam butter milk')?.food.key).toBe('ayam-butter');
    expect(suggestFoods('buttermilk', FOODS, 3).map((s) => s.food.key)).toContain('ayam-butter');
    expect(suggestFoods('mee kri', FOODS, 1)[0].food.key).toBe('mee-kari');
  });
  it('has unique keys', () => {
    expect(new Set(FOODS.map((x) => x.key)).size).toBe(FOODS.length);
  });
  it('existing foods still win over new short aliases', () => {
    expect(findFood('milo ais')?.food.key).toBe('milo-ais');
    expect(findFood('roti canai')?.food.key).toBe('roti-canai');
  });
});

describe('AI estimate sanity', () => {
  const good = JSON.stringify({ name: 'Nasi X', serving: '1 plate', servingGrams: 350, kcal: 600, proteinG: 25, carbsG: 75, fatG: 20 });
  it('accepts a consistent answer and labels it', () => {
    expect(parseEstimate(good, 'nasi x')).toMatchObject({ kcal: 600, source: 'ai', servingG: 350, kcalLow: 450, kcalHigh: 750 });
  });
  it('rejects made-up numbers: macros that do not add up, zero, absurd, junk', () => {
    expect(parseEstimate(JSON.stringify({ kcal: 600, proteinG: 1, carbsG: 1, fatG: 1 }), 'x')).toBeNull();
    expect(parseEstimate(JSON.stringify({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 }), 'x')).toBeNull();
    expect(parseEstimate(JSON.stringify({ kcal: 99999, proteinG: 9999, carbsG: 9999, fatG: 9999 }), 'x')).toBeNull();
    expect(parseEstimate('nope', 'x')).toBeNull();
  });
});

describe('My foods', () => {
  const meal = (o: Partial<NonNullable<Draft['meal']>>): Draft => ({ draftId: 'd', text: 't', item: 'i', expense: null, ts: 1, tsInferred: false, warnings: [],
    meal: { eaten: true, foodName: 'Kuih Mak Esah', servingLabel: '1 serving', quantity: 2, portion: 'regular', kcal: 800, proteinG: 20, carbsG: 100, fatG: 30, nutritionSource: 'manual', confidence: 'high', mealType: 'Lunch', ...o } });
  it('saves macros you typed, per one serving', () => {
    const [m] = foodsToRemember([meal({})], []);
    expect(m).toMatchObject({ name: 'Kuih Mak Esah', kcal: 400, proteinG: 10, mine: true });
  });
  it('skips foods we already know, unknown calories, uneaten, and duplicates', () => {
    expect(foodsToRemember([meal({ foodName: 'Nasi lemak' })], [])).toEqual([]);
    expect(foodsToRemember([meal({ kcal: null })], [])).toEqual([]);
    expect(foodsToRemember([meal({ eaten: false })], [])).toEqual([]);
    expect(foodsToRemember([meal({}), meal({})], [])).toHaveLength(1);
  });
});

describe('cloud sync', () => {
  const fakeDb = (row: unknown, onUpsert = vi.fn()) => ({
    from: () => ({
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }),
      upsert: async (v: unknown) => { onUpsert(v); return { error: null }; },
    }),
  }) as never;
  const withMeal = (id: string, kcal = 100) => ({ ...emptyState(), meals: [{ id, ts: 1, mealType: 'Lunch', foodName: 'a', servingLabel: 's', quantity: 1, portion: 'regular', kcal, proteinG: null, carbsG: null, fatG: null, nutritionSource: 'manual', confidence: 'high', source: 'manual' }] } as never);
  it('merges cloud and local records and uploads the union', async () => {
    const up = vi.fn();
    const merged = await syncOnce(fakeDb({ state: withMeal('cloud') }, up), 'u', withMeal('local'), true);
    expect(merged.meals.map((m) => m.id).sort()).toEqual(['cloud', 'local']);
    expect(up.mock.calls[0][0]).toMatchObject({ user_id: 'u' });
  });
  it('first sync: cloud settings win; later syncs: this device wins', async () => {
    const remote = { ...emptyState(), settings: { ...emptyState().settings, kcalTarget: 1800 } };
    const local = { ...emptyState(), settings: { ...emptyState().settings, kcalTarget: 2500 } };
    expect((await syncOnce(fakeDb({ state: remote }), 'u', local, true)).settings.kcalTarget).toBe(1800);
    expect((await syncOnce(fakeDb({ state: remote }), 'u', local, false)).settings.kcalTarget).toBe(2500);
  });
  it('an empty cloud just uploads local; a failing cloud throws', async () => {
    const up = vi.fn();
    expect((await syncOnce(fakeDb(null, up), 'u', withMeal('a'), true)).meals).toHaveLength(1);
    expect(up).toHaveBeenCalled();
    const bad = { from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: new Error('rls') }) }) }) }) } as never;
    await expect(syncOnce(bad, 'u', withMeal('a'), true)).rejects.toThrow('rls');
  });
  it('signature ignores order but notices additions', () => {
    expect(stateSig(withMeal('a'))).not.toBe(stateSig(emptyState()));
  });
});

describe('Log with a food we do not know', () => {
  const mount = () => {
    let text = 'zzgrain bar';
    render(<QuickLog now={Date.now()} tz="Asia/Kuala_Lumpur" onCommit={() => {}} draftText={text} setDraftText={(t) => { text = t; }} customFoods={[]} lang="en-MY" />);
  };
  it('opens the review with the typed name, not an empty box', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    mount();
    await userEvent.setup().click(screen.getByRole('button', { name: /^Log$/ }));
    expect(await screen.findByPlaceholderText(/Nasi lemak/)).toHaveValue('zzgrain bar'); // the Item field in the review sheet
    expect(screen.getByText(/Not in the food list/)).toBeInTheDocument();
  });
  it('then auto-fills macros, and changing the unit to grams rescales them', async () => {
    const fdc = { foods: [{ fdcId: 1, description: 'Zzgrain bar, chewy', foodNutrients: [{ nutrientNumber: '208', value: 40 }, { nutrientNumber: '203', value: 3.3 }, { nutrientNumber: '205', value: 4.8 }, { nutrientNumber: '204', value: 0.9 }] }] };
    vi.stubGlobal('fetch', vi.fn((u: string) => Promise.resolve(ok(String(u).includes('nal.usda.gov') ? fdc : { products: [] }))));
    mount();
    const u = userEvent.setup();
    await u.click(screen.getByRole('button', { name: /^Log$/ }));
    await waitFor(() => expect(screen.getByLabelText(/Calories/)).toHaveValue('40'), { timeout: 4000 });
    expect(screen.getByLabelText('Unit')).toHaveValue('g'); // per-100 g database food starts in grams
    const q = screen.getByLabelText('Quantity');
    await u.clear(q);
    await u.type(q, '250');
    await waitFor(() => expect(screen.getByLabelText(/Calories/)).toHaveValue('100'));
    await u.selectOptions(screen.getByLabelText('Unit'), 'oz');
    expect(screen.getByLabelText('Quantity')).toHaveValue('8.82'); // 250 g in oz, same food
    expect(screen.getByLabelText(/Calories/)).toHaveValue('100');
  }, 10000);
});
