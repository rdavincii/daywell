// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FOODS, suggestFoods } from './lib/foods';
import { monotonePath } from './lib/chart';
import { mapOffProducts } from './lib/webFood';
import { recipeToFood, sumRecipe } from './lib/recipe';
import { QuickLog } from './QuickLog';
import { RecipesCard } from './Recipes';

afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe('suggestFoods', () => {
  const top = (q: string) => suggestFoods(q, FOODS, 3)[0]?.food.name.toLowerCase() ?? '';
  it('finds the right food despite typos and partial words', () => {
    expect(top('nasi lemk')).toContain('nasi lemak');
    expect(top('nasi le')).toContain('nasi lemak');
    expect(top('chiken rice')).toContain('chicken rice');
  });
  it('returns nothing for gibberish or one letter', () => {
    expect(suggestFoods('qzxv wk', FOODS)).toEqual([]);
    expect(suggestFoods('n', FOODS)).toEqual([]);
  });
});

describe('monotonePath', () => {
  it('handles 0, 1 and duplicate-x points without NaN', () => {
    expect(monotonePath([])).toBe('');
    expect(monotonePath([{ x: 5, y: 5 }])).toBe('M5,5');
    expect(monotonePath([{ x: 0, y: 0 }, { x: 0, y: 9 }, { x: 10, y: 10 }])).not.toContain('NaN');
  });
  it('is a curve (C segments) and never leaves the data range', () => {
    const pts = [{ x: 0, y: 10 }, { x: 10, y: 10 }, { x: 20, y: 0 }, { x: 30, y: 0 }];
    const d = monotonePath(pts);
    expect(d).toMatch(/^M0,10C/);
    const ys = [...d.matchAll(/[\d.]+,([\d.]+)/g)].map((m) => +m[1]);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...ys)).toBeLessThanOrEqual(10);
  });
});

describe('mapOffProducts', () => {
  const data = { products: [
    { code: '1', product_name: 'Munchy Oat Crackers', brands: 'Munchy', nutriments: { 'energy-kcal_100g': '450', proteins_100g: 9, carbohydrates_100g: 70, fat_100g: 14 } },
    { code: '2', product_name: 'Munchy Oat Crackers', nutriments: {} }, // no kcal: dropped
    { code: '3', product_name: 'Totally unrelated', nutriments: { 'energy-kcal_100g': 10 } },
  ] };
  it('keeps close products with numeric kcal, per 100 g', () => {
    const r = mapOffProducts(data, 'munchy oat crackers');
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ kcal: 450, proteinG: 9, carbsG: 70, fatG: 14, serving: '100 g', source: 'web' });
  });
  it('survives an empty or malformed response', () => {
    expect(mapOffProducts({}, 'x')).toEqual([]);
  });
});

describe('recipe maths', () => {
  const egg = { ...FOODS[0], key: 'egg', name: 'Egg', serving: '1 egg', kcal: 70, proteinG: 6, carbsG: 0.5, fatG: 5 };
  const bread = { ...FOODS[0], key: 'bread', name: 'Bread', serving: '1 slice', kcal: 80, proteinG: 3, carbsG: 15, fatG: 1 };
  it('adds ingredients by quantity and divides by servings', () => {
    const lines = [{ food: egg, qty: 2 }, { food: bread, qty: 2 }];
    const s = sumRecipe(lines, 2);
    expect(s.total).toEqual({ kcal: 300, proteinG: 18, carbsG: 31, fatG: 12 });
    expect(s.perServing.kcal).toBe(150);
    const f = recipeToFood('r1', ' Sandwich ', lines, 2);
    expect(f).toMatchObject({ name: 'Sandwich', kcal: 150, serving: '1 serving' });
    expect(f.ingredients).toHaveLength(2);
  });
  it('zero servings does not divide by zero', () => {
    expect(sumRecipe([{ food: egg, qty: 1 }], 0).perServing.kcal).toBe(70);
  });
});

describe('Recipes card', () => {
  it('builds a recipe from ingredients and saves the summed macros', async () => {
    const onSave = vi.fn();
    const u = userEvent.setup();
    render(<RecipesCard customFoods={[]} onSave={onSave} onLog={() => {}} />);
    await u.click(screen.getByRole('button', { name: /new recipe/i }));
    await u.type(screen.getByPlaceholderText(/Egg sandwich/), 'Teh telur');
    await u.type(screen.getByPlaceholderText(/Type a food/), 'nasi lemak');
    await u.click((await screen.findAllByRole('button', { name: /nasi lemak/i }))[0]);
    expect(screen.getByText(/Per serving/)).toBeInTheDocument();
    await u.click(screen.getByRole('button', { name: /save recipe/i }));
    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0][0][0];
    expect(saved.name).toBe('Teh telur');
    expect(saved.kcal).toBeGreaterThan(0);
  });
  it('refuses to save without ingredients', async () => {
    const onSave = vi.fn();
    const u = userEvent.setup();
    render(<RecipesCard customFoods={[]} onSave={onSave} onLog={() => {}} />);
    await u.click(screen.getByRole('button', { name: /new recipe/i }));
    await u.type(screen.getByPlaceholderText(/Egg sandwich/), 'Empty');
    await u.click(screen.getByRole('button', { name: /save recipe/i }));
    expect(screen.getByRole('alert')).toHaveTextContent(/at least one ingredient/);
    expect(onSave).not.toHaveBeenCalled();
  });
});

describe('review editor auto-finds macros online (mocked fetch)', () => {
  it('fills calories and macros from the top online match', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ products: [
      { code: '9', product_name: 'Munchy Oat Crackers', nutriments: { 'energy-kcal_100g': 450, proteins_100g: 9, carbohydrates_100g: 70, fat_100g: 14 } },
    ] }) });
    vi.stubGlobal('fetch', fetchMock);
    const u = userEvent.setup();
    render(<QuickLog now={Date.now()} tz="Asia/Kuala_Lumpur" onCommit={() => {}} draftText="" setDraftText={() => {}} customFoods={[]} lang="en-MY" />);
    await u.click(screen.getByRole('button', { name: /add manually/i }));
    await u.type(screen.getByPlaceholderText(/Nasi lemak/), 'Munchy oat crackers');
    await u.click(screen.getByRole('button', { name: /I ate this/ }));
    await waitFor(() => expect(screen.getByLabelText(/Calories/)).toHaveValue('450'), { timeout: 3000 });
    expect(fetchMock).toHaveBeenCalledTimes(3); // one search = Open Food Facts + OFF Malaysia + USDA
    expect(screen.getByText(/Protein 9 g/)).toBeInTheDocument();
    vi.unstubAllGlobals();
  }, 8000);
  it('says so when the food database cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    const u = userEvent.setup();
    render(<QuickLog now={Date.now()} tz="Asia/Kuala_Lumpur" onCommit={() => {}} draftText="" setDraftText={() => {}} customFoods={[]} lang="en-MY" />);
    await u.click(screen.getByRole('button', { name: /add manually/i }));
    await u.type(screen.getByPlaceholderText(/Nasi lemak/), 'Kerepek pisang kosong');
    expect(await screen.findByText(/Couldn't reach the food database/, {}, { timeout: 3000 })).toBeInTheDocument();
    vi.unstubAllGlobals();
  }, 8000);
});
