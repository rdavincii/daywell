// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { lookupBarcode, mapFdcFoods, offToFood, searchWebFoods } from './lib/webFood';
import { parseDetected } from './lib/vision';
import { foodToDraft } from './lib/scanDrafts';
import { setKey } from './lib/keys';
import { ScanSheet } from './Scan';

beforeEach(() => localStorage.clear());
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const fdcEgg = { foods: [{ fdcId: 1, description: 'Egg, whole, raw, fresh', foodNutrients: [
  { nutrientNumber: '208', value: 143 }, { nutrientNumber: '203', value: 12.6 }, { nutrientNumber: '205', value: 0.7 }, { nutrientNumber: '204', value: 9.5 }] }] };
const offBar = { status: 1, product: { product_name: 'Milo', brands: 'Nestle', serving_size: '27 g', serving_quantity: 27, nutriments: { 'energy-kcal_100g': 400, proteins_100g: 8, carbohydrates_100g: 70, fat_100g: 10 } } };

describe('USDA mapping', () => {
  it('reads kcal and macros per 100 g and drops non-matches', () => {
    const r = mapFdcFoods({ foods: [...fdcEgg.foods, { fdcId: 2, description: 'Cabbage', foodNutrients: [{ nutrientNumber: '208', value: 25 }] }] }, 'egg');
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ name: 'Egg, whole, raw, fresh', kcal: 143, proteinG: 12.6, carbsG: 0.7, fatG: 9.5, serving: '100 g' });
  });
  it('uses the Atwater energy id when plain energy is missing, and skips foods with no energy', () => {
    const f = { fdcId: 3, description: 'Rice, white', foodNutrients: [{ nutrientId: 2047, value: 130 }] };
    expect(mapFdcFoods({ foods: [f, { fdcId: 4, description: 'Rice, brown', foodNutrients: [] }] }, 'rice')).toHaveLength(1);
  });
});

describe('Open Food Facts per-serving', () => {
  it('scales to the pack serving when asked', () => {
    expect(offToFood(offBar.product, true)).toMatchObject({ serving: '27 g', kcal: 108, proteinG: 2.2 });
    expect(offToFood(offBar.product)).toMatchObject({ serving: '100 g', kcal: 400 });
  });
});

describe('searchWebFoods', () => {
  it('still returns USDA results when Open Food Facts is down', async () => {
    vi.stubGlobal('fetch', vi.fn((u: string) => (u.includes('openfoodfacts') ? Promise.reject(new Error('down')) : Promise.resolve(ok(fdcEgg)))));
    expect((await searchWebFoods('egg'))[0].name).toMatch(/^Egg/);
  });
  it('throws only when both are down; empty array when reachable but nothing close', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    await expect(searchWebFoods('qwerty one')).rejects.toThrow();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({})));
    expect(await searchWebFoods('qwerty two')).toEqual([]);
  });
  it('sends the user key instead of DEMO_KEY', async () => {
    setKey('fdc', 'MYKEY');
    const f = vi.fn().mockResolvedValue(ok({}));
    vi.stubGlobal('fetch', f);
    await searchWebFoods('banana');
    expect(f.mock.calls.some(([u]) => String(u).includes('api_key=MYKEY'))).toBe(true);
  });
});

describe('lookupBarcode', () => {
  it('finds a pack on Open Food Facts', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok(offBar)));
    expect((await lookupBarcode('9556001234567'))?.kcal).toBe(108);
  });
  it('falls back to an exact USDA GTIN match, and returns null when neither has it', async () => {
    const usda = { foods: [{ fdcId: 9, description: 'GRANOLA BAR', gtinUpc: '012345678905', foodNutrients: [{ nutrientNumber: '208', value: 450 }] }] };
    vi.stubGlobal('fetch', vi.fn((u: string) => Promise.resolve(ok(u.includes('openfoodfacts') ? { status: 0 } : usda))));
    expect((await lookupBarcode('12345678905'))?.kcal).toBe(450);
    vi.stubGlobal('fetch', vi.fn((u: string) => Promise.resolve(ok(u.includes('openfoodfacts') ? { status: 0 } : { foods: [] }))));
    expect(await lookupBarcode('12345678905')).toBeNull();
  });
  it('rejects junk before any network call, and reports offline', async () => {
    const f = vi.fn().mockRejectedValue(new Error('offline'));
    vi.stubGlobal('fetch', f);
    await expect(lookupBarcode('12')).rejects.toThrow(/8 to 14/);
    expect(f).not.toHaveBeenCalled();
    await expect(lookupBarcode('12345678905')).rejects.toThrow();
  });
});

describe('parseDetected', () => {
  it('cleans model output: fences, dupes, bad servings', () => {
    const t = '```json\n[{"name":"Nasi lemak","servings":1},{"name":"nasi lemak"},{"name":"Teh tarik","servings":-3},{"name":""},{"servings":2}]\n```';
    expect(parseDetected(t)).toEqual([{ name: 'Nasi lemak', servings: 1 }, { name: 'Teh tarik', servings: 1 }]);
  });
  it('never throws on garbage', () => {
    expect(parseDetected('not json')).toEqual([]);
    expect(parseDetected('{"a":1}')).toEqual([]);
  });
});

describe('foodToDraft', () => {
  it('scales by servings and flags a miss', () => {
    const food = { ...offToFood(offBar.product)!, kcal: 100, proteinG: 5, carbsG: 10, fatG: 2 };
    // per-100 g database foods start at 100 g (a plate has no weight there)
    expect(foodToDraft('x', food, 2, Date.now(), 'Asia/Kuala_Lumpur').meal).toMatchObject({ kcal: 100, quantity: 100, unit: 'g', nutritionSource: 'web', eaten: true });
    const miss = foodToDraft('mystery', null, 1, Date.now(), 'Asia/Kuala_Lumpur');
    expect(miss.meal?.kcal).toBeNull();
    expect(miss.warnings).toHaveLength(1);
  });
});

describe('ScanSheet', () => {
  const setup = (onDrafts = vi.fn()) => { render(<ScanSheet now={Date.now()} tz="Asia/Kuala_Lumpur" customFoods={[]} onDrafts={onDrafts} onClose={() => {}} />); return onDrafts; };
  it('typed barcode becomes a reviewable draft with macros', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok(offBar)));
    const onDrafts = setup();
    const u = userEvent.setup();
    await u.type(screen.getByLabelText('Barcode number'), '9556001234567');
    await u.click(screen.getByRole('button', { name: 'Look up' }));
    await waitFor(() => expect(onDrafts).toHaveBeenCalled());
    expect(onDrafts.mock.calls[0][0][0].meal.kcal).toBe(108);
  });
  it('says so for an unknown barcode and when offline', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({ status: 0, foods: [] })));
    const u = userEvent.setup();
    setup();
    await u.type(screen.getByLabelText('Barcode number'), '9556001234567');
    await u.click(screen.getByRole('button', { name: 'Look up' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/not in Open Food Facts/);
  });
  it('meal scan without a key explains how to add one', async () => {
    setup();
    const file = new File(['x'], 'm.jpg', { type: 'image/jpeg' });
    const input = document.querySelectorAll('input[type=file]')[1] as HTMLInputElement;
    await userEvent.setup().upload(input, file);
    expect(await screen.findByRole('alert')).toHaveTextContent(/Gemini/);
  });
});

import { pickModel, detectFoods } from './lib/vision';
describe('Gemini model choice', () => {
  const m = (name: string, methods = ['generateContent']) => ({ name: 'models/' + name, supportedGenerationMethods: methods });
  it('picks the newest stable flash, skipping lite/embedding/preview', () => {
    expect(pickModel([m('gemini-2.0-flash'), m('gemini-2.5-flash'), m('gemini-2.5-flash-lite'), m('gemini-3-flash-preview'), m('text-embedding-004', ['embedContent'])])).toBe('gemini-2.5-flash');
  });
  it('falls back to a preview, and to null when nothing fits', () => {
    expect(pickModel([m('gemini-3-flash-preview')])).toBe('gemini-3-flash-preview');
    expect(pickModel([m('gemini-pro', ['embedContent'])])).toBeNull();
  });
  it('detectFoods asks the key for models, then uses the chosen one and surfaces Google errors', async () => {
    setKey('gemini', 'K');
    const f = vi.fn((u: string) => Promise.resolve(u.includes(':generateContent')
      ? ok({ candidates: [{ content: { parts: [{ text: '[{"name":"Roti canai","servings":2}]' }] } }] })
      : ok({ models: [m('gemini-9-flash')] })));
    vi.stubGlobal('fetch', f);
    expect(await detectFoods('AAAA')).toEqual([{ name: 'Roti canai', servings: 2 }]);
    expect(String(f.mock.calls[1][0])).toContain('models/gemini-9-flash:generateContent');
  });
});
