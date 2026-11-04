import type { FoodRef, RecipeIngredient } from './types';

export interface RecipeLine { food: FoodRef; qty: number }

/** Totals for the whole pot and for one serving. qty is in multiples of the food's own serving (e.g. 2 eggs, 1.5 x 100 g). */
export function sumRecipe(lines: RecipeLine[], servings: number) {
  const n = servings > 0 ? servings : 1;
  const t = lines.reduce(
    (a, { food, qty }) => ({ kcal: a.kcal + food.kcal * qty, p: a.p + food.proteinG * qty, c: a.c + food.carbsG * qty, f: a.f + food.fatG * qty }),
    { kcal: 0, p: 0, c: 0, f: 0 },
  );
  const r1 = (x: number) => Math.round(x * 10) / 10;
  return {
    total: { kcal: Math.round(t.kcal), proteinG: r1(t.p), carbsG: r1(t.c), fatG: r1(t.f) },
    perServing: { kcal: Math.round(t.kcal / n), proteinG: r1(t.p / n), carbsG: r1(t.c / n), fatG: r1(t.f / n) },
  };
}

/** A recipe is stored as a custom food (1 serving) so the quick-log parser and macro scaling work unchanged. */
export function recipeToFood(key: string, name: string, lines: RecipeLine[], servings: number): FoodRef {
  const { perServing: s } = sumRecipe(lines, servings);
  const ingredients: RecipeIngredient[] = lines.map(({ food, qty }) => ({
    name: food.name, qty, serving: food.serving,
    kcal: Math.round(food.kcal * qty), proteinG: Math.round(food.proteinG * qty * 10) / 10,
    carbsG: Math.round(food.carbsG * qty * 10) / 10, fatG: Math.round(food.fatG * qty * 10) / 10,
  }));
  return {
    key, name: name.trim(), aliases: [], serving: '1 serving',
    kcal: s.kcal, proteinG: s.proteinG, carbsG: s.carbsG, fatG: s.fatG,
    kcalLow: Math.round(s.kcal * 0.85), kcalHigh: Math.round(s.kcal * 1.15),
    note: `Recipe: ${lines.length} ingredients, makes ${servings} serving${servings === 1 ? '' : 's'}. Estimated from ingredient macros.`,
    ingredients,
  };
}
