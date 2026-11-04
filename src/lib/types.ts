export const CATEGORIES = [
  'Food & Drinks',
  'Groceries',
  'Transport',
  'Shopping',
  'Housing',
  'Bills & Utilities',
  'Healthcare',
  'Entertainment',
  'Subscriptions',
  'Education',
  'Personal Care',
  'Travel',
  'Other',
] as const;
export type Category = (typeof CATEGORIES)[number];

export type MealType = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snack';
export const MEAL_TYPES: MealType[] = ['Breakfast', 'Lunch', 'Dinner', 'Snack'];

export type InputSource = 'manual' | 'text' | 'voice' | 'image' | 'receipt';
export type Portion = 'small' | 'regular' | 'large';
export type Confidence = 'high' | 'medium' | 'low' | 'none';
export type WeightGoal = 'lose' | 'maintain' | 'gain';
export type Gender = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active';

export interface WeightLog {
  ts: number;
  weightKg: number;
}

export interface Expense {
  id: string;
  ts: number; // epoch ms
  item: string;
  merchant?: string;
  category: Category;
  amountSen: number;
  currency: string;
  notes?: string;
  source: InputSource;
  transcript?: string;
}

export interface FoodRef {
  key: string;
  name: string;
  aliases: string[];
  serving: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  kcalLow: number;
  kcalHigh: number;
  drink?: boolean;
  note?: string;
  source?: 'web'; // came from Open Food Facts (per 100 g), not our own table
  ingredients?: RecipeIngredient[]; // present when this food is a saved recipe
}

/** One line of a recipe: the totals already include qty. */
export interface RecipeIngredient {
  name: string;
  qty: number; // multiples of `serving`
  serving: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
}

export interface Meal {
  id: string;
  ts: number;
  mealType: MealType;
  foodName: string;
  servingLabel: string; // e.g. "1 plate"
  quantity: number;
  portion: Portion;
  kcal: number | null; // null = no nutrition data yet (never invented)
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  nutritionSource: 'reference-estimate' | 'web' | 'manual' | 'unknown';
  confidence: Confidence;
  note?: string;
  expenseId?: string; // optional link; meals can exist without an expense
  source: InputSource;
  transcript?: string;
}

export interface Settings {
  displayName: string;
  currency: string;
  timezone: string;
  kcalTarget: number;
  proteinTarget: number;
  carbsTarget: number;
  fatTarget: number;
  dailyBudgetSen: number;
  monthlyBudgetSen: number;
  categoryBudgetsSen: Partial<Record<Category, number>>;
  theme: 'system' | 'light' | 'dark';
  aiEnabled: boolean;
  voiceLang: 'en-MY' | 'ms-MY';
  currentWeightKg?: number;
  targetWeightKg?: number;
  targetWeightDate?: string;
  weightGoal?: 'maintain' | 'lose' | 'gain';
  age?: number;
  heightCm?: number;
  gender?: Gender;
  activityLevel?: ActivityLevel;
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}

export interface AppState {
  version: 1;
  expenses: Expense[];
  meals: Meal[];
  settings: Settings;
  /** Idempotency keys of already-saved submissions, so a retry never duplicates records. */
  savedKeys: string[];
  weightLogs: WeightLog[];
  streak: number;
  lastActiveDay: string;
  customFoods?: FoodRef[];
}

/** A parsed, not-yet-saved entry shown on the review screen. */
export interface Draft {
  draftId: string;
  text: string; // original clause
  item: string;
  expense: null | { amountSen: number; category: Category; merchant?: string };
  meal: null | {
    eaten: boolean; // user confirmation that this was consumed
    foodName: string;
    servingLabel: string;
    quantity: number;
    portion: Portion;
    kcal: number | null;
    proteinG: number | null;
    carbsG: number | null;
    fatG: number | null;
    nutritionSource: Meal['nutritionSource'];
    confidence: Confidence;
    mealType: MealType;
    note?: string;
    baseKey?: string; // food table key, for re-scaling on portion change
  };
  ts: number;
  tsInferred: boolean;
  warnings: string[];
}

export const DEFAULT_SETTINGS: Settings = {
  displayName: '',
  currency: 'MYR',
  timezone: 'Asia/Kuala_Lumpur',
  kcalTarget: 2000,
  proteinTarget: 75,
  carbsTarget: 250,
  fatTarget: 65,
  dailyBudgetSen: 4000,
  monthlyBudgetSen: 100000,
  categoryBudgetsSen: {},
  theme: 'system',
  aiEnabled: false,
  voiceLang: 'en-MY',
  currentWeightKg: 70,
  targetWeightKg: 65,
  weightGoal: 'maintain',
};
