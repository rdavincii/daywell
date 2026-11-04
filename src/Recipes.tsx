import { useState } from 'react';
import { useFoodSuggestions } from './foodSearch';
import { recipeToFood, sumRecipe } from './lib/recipe';
import type { RecipeLine } from './lib/recipe';
import { newId } from './lib/store';
import type { FoodRef } from './lib/types';
import { Field, Sheet } from './ui';

/** Log tab card: saved recipes (log or remove) and a button to build a new one. */
export function RecipesCard({ customFoods, onSave, onLog }: { customFoods: FoodRef[]; onSave: (foods: FoodRef[]) => void; onLog: (name: string) => void }) {
  const [building, setBuilding] = useState(false);
  return (
    <div className="card stack" style={{ marginTop: 16 }}>
      <div className="row between">
        <strong>Recipes</strong>
        <button className="btn secondary small" onClick={() => setBuilding(true)}>+ New recipe</button>
      </div>
      {customFoods.length === 0 && <div className="sub">Combine foods into one meal. Macros are added up for you.</div>}
      {customFoods.map((f) => (
        <div key={f.key} className="row between">
          <div>
            <strong>{f.name}</strong> <span className="sub">{f.kcal} kcal</span>
            <div className="sub">P {f.proteinG} g · C {f.carbsG} g · F {f.fatG} g{f.ingredients ? ` · ${f.ingredients.length} ingredients` : ''}</div>
          </div>
          <div className="row">
            <button className="btn small" onClick={() => onLog(f.name)}>Log</button>
            <button className="btn danger small" aria-label={`Remove ${f.name}`} onClick={() => onSave(customFoods.filter((x) => x.key !== f.key))}>Remove</button>
          </div>
        </div>
      ))}
      {building && <RecipeBuilder onClose={() => setBuilding(false)} onSave={(f) => { onSave([...customFoods, f]); setBuilding(false); }} />}
    </div>
  );
}

function RecipeBuilder({ onClose, onSave }: { onClose: () => void; onSave: (f: FoodRef) => void }) {
  const [name, setName] = useState('');
  const [servings, setServings] = useState('1');
  const [lines, setLines] = useState<RecipeLine[]>([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState<string | null>(null);
  const sug = useFoodSuggestions(q, []);
  const n = parseFloat(servings);
  const sums = sumRecipe(lines, n > 0 ? n : 1);

  function save() {
    if (!name.trim()) return setError('Give the recipe a name.');
    if (!lines.length) return setError('Add at least one ingredient.');
    if (!(n > 0 && n <= 50)) return setError('Servings must be between 1 and 50.');
    onSave(recipeToFood(newId(), name, lines, n));
  }

  return (
    <Sheet title="New recipe" onClose={onClose}>
      <div className="stack">
        <div className="fields">
          <Field label="Recipe name" full><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Egg sandwich" /></Field>
          <Field label="Makes (servings)"><input className="input" inputMode="decimal" value={servings} onChange={(e) => setServings(e.target.value)} /></Field>
        </div>
        {lines.map((l, i) => (
          <div key={i} className="row between">
            <div style={{ flex: 1 }}>
              <strong>{l.food.name}</strong>
              <div className="sub">{Math.round(l.food.kcal * l.qty)} kcal · × {l.food.serving}</div>
            </div>
            <input className="input" style={{ width: 70 }} inputMode="decimal" aria-label={`Amount of ${l.food.name} in ${l.food.serving}`} value={l.qty}
              onChange={(e) => { const v = parseFloat(e.target.value); if (v > 0 && v <= 100) setLines(lines.map((x, j) => (j === i ? { ...x, qty: v } : x))); }} />
            <button className="btn danger small" aria-label={`Remove ${l.food.name}`} onClick={() => setLines(lines.filter((_, j) => j !== i))}>×</button>
          </div>
        ))}
        <Field label="Add ingredient" full>
          <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Type a food, e.g. telur" />
        </Field>
        {(sug.local.length > 0 || sug.web.length > 0) && (
          <div className="sug-scroll">
            {[...sug.local.map((x) => x.food), ...sug.web].map((f) => (
              <button key={f.key} type="button" className="sug-chip" onClick={() => { setLines([...lines, { food: f, qty: 1 }]); setQ(''); }}>{f.name} · {f.serving}</button>
            ))}
          </div>
        )}
        {sug.status === 'searching' && <div className="sub" role="status">Searching online…</div>}
        {sug.status === 'error' && <div className="sub" role="status">Couldn't reach the food database.</div>}
        {lines.length > 0 && (
          <div className="notice" role="status">
            Per serving: <strong>{sums.perServing.kcal} kcal</strong> · P {sums.perServing.proteinG} g · C {sums.perServing.carbsG} g · F {sums.perServing.fatG} g
            <div className="sub">Whole recipe: {sums.total.kcal} kcal</div>
          </div>
        )}
        {error && <div className="notice err" role="alert">{error}</div>}
        <button className="btn" onClick={save}>Save recipe</button>
      </div>
    </Sheet>
  );
}
