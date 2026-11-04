import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { findFood, scaleNutrition } from './lib/foods';
import { formatRM, parseToSen, senToInput } from './lib/money';
import { dayHeading, dayKey, fromFormFields, timeLabel, toFormFields } from './lib/time';
import { CATEGORIES, MEAL_TYPES } from './lib/types';
import type { AppState, Category, Expense, Meal, MealType } from './lib/types';
import { Field, Sheet } from './ui';
import { FreshIds, prefersReducedMotion } from './motion';

export interface Entry {
  id: string;
  ts: number;
  title: string;
  expense?: Expense;
  meal?: Meal;
}

export function buildEntries(s: AppState): Entry[] {
  const mealByExpense = new Map<string, Meal>();
  for (const m of s.meals) if (m.expenseId) mealByExpense.set(m.expenseId, m);
  const used = new Set<string>();
  const out: Entry[] = [];
  for (const e of s.expenses) {
    const m = mealByExpense.get(e.id);
    if (m) used.add(m.id);
    out.push({ id: 'e-' + e.id, ts: e.ts, title: e.item, expense: e, meal: m });
  }
  for (const m of s.meals) if (!used.has(m.id)) out.push({ id: 'm-' + m.id, ts: m.ts, title: m.foodName, meal: m });
  return out.sort((a, b) => b.ts - a.ts);
}

const OPEN_PX = 130; // how far the row slides to reveal Copy and Delete

export function EntryRow({
  entry,
  tz,
  onOpen,
  onDuplicate,
  onDelete,
}: {
  entry: Entry;
  tz: string;
  onOpen: (e: Entry) => void;
  onDuplicate?: (e: Entry) => void;
  onDelete?: (e: Entry) => void;
}) {
  const { expense: e, meal: m } = entry;
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const drag = useRef({ x: 0, y: 0, from: 0, axis: null as null | 'x' | 'y', lastX: 0, lastT: 0, v: 0 });
  const leaveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(leaveTimer.current), []);

  // New rows (just logged or duplicated) open up and fade in; the delay staggers several at once.
  const fresh = useContext(FreshIds);
  const freshIdx = fresh.findIndex((id) => id === e?.id || id === m?.id);

  const handleTouchStart = (ev: React.TouchEvent) => {
    const t = ev.touches[0];
    drag.current = { x: t.clientX, y: t.clientY, from: offset, axis: null, lastX: t.clientX, lastT: performance.now(), v: 0 };
  };

  const handleTouchMove = (ev: React.TouchEvent) => {
    const d = drag.current;
    const t = ev.touches[0];
    const dx = t.clientX - d.x;
    const dy = t.clientY - d.y;
    if (d.axis === null) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      d.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
      if (d.axis === 'x') setDragging(true);
    }
    if (d.axis !== 'x') return;
    // velocity in px/ms, smoothed. The 8ms floor stops two events in the same instant from faking a huge flick.
    const now = performance.now();
    const dt = Math.max(8, now - d.lastT);
    d.v = 0.5 * d.v + 0.5 * ((t.clientX - d.lastX) / dt);
    d.lastX = t.clientX;
    d.lastT = now;
    const raw = d.from + dx;
    // 1:1 inside the range, resistance beyond it (never to the right of closed)
    const next = raw > 0 ? raw * 0.2 : raw < -OPEN_PX ? -OPEN_PX + (raw + OPEN_PX) * 0.25 : raw;
    setOffset(next);
  };

  const handleTouchEnd = () => {
    const d = drag.current;
    if (d.axis !== 'x') return;
    setDragging(false);
    // Project where the flick would land, so a quick short flick still opens or closes the row.
    const projected = offset + d.v * 120;
    setOffset(projected < -OPEN_PX / 2 ? -OPEN_PX : 0);
    d.axis = null;
  };

  const handleRowClick = () => {
    if (offset < 0) {
      setOffset(0);
    } else {
      onOpen(entry);
    }
  };

  const handleDelete = (ev: React.MouseEvent) => {
    ev.stopPropagation();
    if (leaving) return;
    if (!onDelete) { setOffset(0); return; }
    setLeaving(true); // fade and collapse first, then remove the record
    leaveTimer.current = setTimeout(() => onDelete?.(entry), prefersReducedMotion() ? 120 : 220);
  };

  return (
    <div
      className="swipe-collapse"
      data-leaving={leaving || undefined}
      data-fresh={freshIdx >= 0 || undefined}
      style={freshIdx > 0 ? { animationDelay: `${Math.min(freshIdx, 5) * 50}ms` } : undefined}
    >
    <div className="swipe-wrap">
      <div className="swipe-actions">
        <button
          type="button"
          className="swipe-btn duplicate"
          onClick={(ev) => {
            ev.stopPropagation();
            setOffset(0);
            onDuplicate?.(entry);
          }}
          aria-label={`Duplicate ${entry.title}`}
          title="Duplicate"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          <span>Copy</span>
        </button>
        <button
          type="button"
          className="swipe-btn delete"
          onClick={handleDelete}
          aria-label={`Delete ${entry.title}`}
          title="Delete"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
          </svg>
          <span>Delete</span>
        </button>
      </div>

      <button
        type="button"
        className="tl-item swipe-content"
        data-dragging={dragging || undefined}
        style={{ transform: `translateX(${offset}px)` }}
        onClick={handleRowClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchEnd}
        aria-label={`Edit ${entry.title}`}
      >
        <div className="tl-time">{timeLabel(entry.ts, tz)}</div>
        <div className="tl-main">
          <div className="tl-title">{entry.title}</div>
          {e && <div className="tl-price">{formatRM(e.amountSen, e.currency)}</div>}
          <div className="chips">
            {m && m.kcal !== null && (
              <span className="chip cal">
                {m.kcal} kcal
                {m.nutritionSource === 'reference-estimate' ? ' (est.)' : m.nutritionSource === 'web' ? ' (web)' : ''}
              </span>
            )}
            {m && <span className="chip">{m.mealType}</span>}
            {e && <span className="chip">{e.category}</span>}
            {e && !m && e.category === 'Food & Drinks' && <span className="chip">Not eaten</span>}
          </div>
        </div>
      </button>
    </div>
    </div>
  );
}

export function EntryList({
  entries,
  tz,
  today,
  onOpen,
  onDuplicate,
  onDelete,
}: {
  entries: Entry[];
  tz: string;
  today: string;
  onOpen: (e: Entry) => void;
  onDuplicate?: (e: Entry) => void;
  onDelete?: (e: Entry) => void;
}) {
  const groups = useMemo(() => {
    const m = new Map<string, Entry[]>();
    for (const e of entries) {
      const k = dayKey(e.ts, tz);
      m.set(k, [...(m.get(k) ?? []), e]);
    }
    return [...m.entries()];
  }, [entries, tz]);

  return (
    <div>
      {groups.map(([day, list]) => (
        <section key={day}>
          <div className="label tl-day">{dayHeading(day, today)}</div>
          {list.map((e) => (
            <EntryRow
              key={e.id}
              entry={e}
              tz={tz}
              onOpen={onOpen}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
            />
          ))}
        </section>
      ))}
    </div>
  );
}

export function ActivityScreen({
  state,
  today,
  onOpen,
  onDuplicate,
  onDelete,
}: {
  state: AppState;
  today: string;
  onOpen: (e: Entry) => void;
  onDuplicate?: (e: Entry) => void;
  onDelete?: (e: Entry) => void;
}) {
  const hasFood = state.meals.length > 0 || state.expenses.some((e) => e.category === 'Food & Drinks');
  const [filter, setFilter] = useState<string>(hasFood ? 'food' : 'all');
  const [sortBy, setSortBy] = useState<'newest' | 'price' | 'calories'>('newest');
  const [q, setQ] = useState('');

  const entries = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = buildEntries(state).filter((e) => {
      if (filter === 'food' && !e.meal && e.expense?.category !== 'Food & Drinks') return false;
      if (filter === 'spending' && (!e.expense || e.expense.category === 'Food & Drinks')) return false;
      if (filter === 'meals' && !e.meal) return false;
      if (filter !== 'all' && filter !== 'food' && filter !== 'spending' && filter !== 'meals') {
        if (e.expense?.category !== filter) return false;
      }
      if (!needle) return true;
      const hay = [
        e.title,
        e.expense?.category,
        e.expense?.merchant,
        e.expense?.notes,
        e.meal?.mealType,
        e.meal?.foodName,
        e.expense?.transcript,
        e.meal?.transcript,
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(needle);
    });

    if (sortBy === 'price') {
      list = [...list].sort((a, b) => (b.expense?.amountSen ?? 0) - (a.expense?.amountSen ?? 0));
    } else if (sortBy === 'calories') {
      list = [...list].sort((a, b) => (b.meal?.kcal ?? 0) - (a.meal?.kcal ?? 0));
    } else {
      list = [...list].sort((a, b) => b.ts - a.ts);
    }
    return list;
  }, [state, filter, sortBy, q]);

  return (
    <div className="page">
      <h1>Activity</h1>
      <div className="search">
        <input
          className="input"
          type="search"
          placeholder="Search entries"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Search entries"
        />
      </div>

      <div className="seg" role="group" aria-label="Filter by type">
        <button
          type="button"
          aria-pressed={filter === 'food'}
          onClick={() => setFilter('food')}
        >
          Food & Drinks
        </button>
        <button
          type="button"
          aria-pressed={filter === 'all'}
          onClick={() => setFilter('all')}
        >
          All
        </button>
        <button
          type="button"
          aria-pressed={filter === 'spending'}
          onClick={() => setFilter('spending')}
        >
          Spending
        </button>
        <button
          type="button"
          aria-pressed={filter === 'meals'}
          onClick={() => setFilter('meals')}
        >
          Meals
        </button>
      </div>

      <div className="row between" style={{ fontSize: 13, color: 'var(--muted)', marginTop: -4 }}>
        <span>Slide row left to duplicate or delete</span>
        <div className="row" style={{ gap: 6 }}>
          <span>Sort:</span>
          <select
            className="input"
            style={{ minHeight: 32, padding: '4px 8px', fontSize: 12, width: 'auto' }}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
          >
            <option value="newest">Newest</option>
            <option value="price">Highest RM</option>
            <option value="calories">Highest kcal</option>
          </select>
        </div>
      </div>

      {entries.length === 0 ? (
        <div className="card empty">
          <strong>
            {state.expenses.length + state.meals.length === 0
              ? 'Nothing logged yet'
              : 'No matches'}
          </strong>
          {state.expenses.length + state.meals.length === 0
            ? 'Go to Home and log your first meal or purchase.'
            : 'Try selecting "All" or a different search query.'}
        </div>
      ) : (
        <EntryList
          entries={entries}
          tz={state.settings.timezone}
          today={today}
          onOpen={onOpen}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
      )}
    </div>
  );
}

interface EditProps {
  entry: Entry;
  state: AppState;
  onClose: () => void;
  onSaveExpense: (id: string, patch: Partial<Expense>) => void;
  onSaveMeal: (id: string, patch: Partial<Meal>) => void;
  onDeleteExpense: (id: string, alsoMeal: boolean) => void;
  onDeleteMeal: (id: string, alsoExpense: boolean) => void;
  onMarkEaten: (expenseId: string, meal: Omit<Meal, 'id' | 'expenseId'>) => void;
  onAddExpenseToMeal: (mealId: string, exp: Omit<Expense, 'id'>) => void;
  closing?: boolean;
}

export function EditSheet({
  entry,
  state,
  onClose,
  onSaveExpense,
  onSaveMeal,
  onDeleteExpense,
  onDeleteMeal,
  onMarkEaten,
  onAddExpenseToMeal,
  closing = false,
}: EditProps) {
  const tz = state.settings.timezone;
  const e = entry.expense;
  const m = entry.meal;
  const [addingPrice, setAddingPrice] = useState(false);
  const showSpending = !!e || addingPrice;
  
  const [item, setItem] = useState(e?.item ?? m?.foodName ?? '');
  const [amount, setAmount] = useState(e ? senToInput(e.amountSen) : '');
  const [cat, setCat] = useState<Category>(e?.category ?? 'Food & Drinks');
  const [notes, setNotes] = useState(e?.notes ?? '');
  const f0 = toFormFields(entry.ts, tz);
  const [date, setDate] = useState(f0.date);
  const [time, setTime] = useState(f0.time);
  const [food, setFood] = useState(m?.foodName ?? '');
  const [kcal, setKcal] = useState(m?.kcal != null ? String(m.kcal) : '');
  const [protein, setProtein] = useState(m?.proteinG != null ? String(m.proteinG) : '');
  const [carbs, setCarbs] = useState(m?.carbsG != null ? String(m.carbsG) : '');
  const [fat, setFat] = useState(m?.fatG != null ? String(m.fatG) : '');
  const [mealType, setMealType] = useState<MealType>(m?.mealType ?? 'Lunch');
  const [err, setErr] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);

  const num = (v: string): number | null | undefined => {
    if (v.trim() === '') return null;
    const n = Number(v);
    return Number.isFinite(n) && n >= 0 ? n : undefined;
  };

  function save() {
    const ts = fromFormFields(date, time, tz);
    if (ts === null) {
      setErr('Enter a valid date and time.');
      return;
    }
    if (showSpending) {
      const sen = parseToSen(amount);
      if (sen === null || sen <= 0) {
        setErr('Enter a valid price, e.g. 5.50.');
        return;
      }
      if (!item.trim()) {
        setErr('Give the item a name.');
        return;
      }
      if (e) {
        onSaveExpense(e.id, { item: item.trim(), amountSen: sen, category: cat, notes: notes.trim() || undefined, ts });
      } else if (addingPrice && m) {
        onAddExpenseToMeal(m.id, {
           item: item.trim(), amountSen: sen, category: cat, notes: notes.trim() || undefined, ts, currency: state.settings.currency, source: 'manual'
        });
      }
    }
    if (m) {
      const k = num(kcal),
        p = num(protein),
        c = num(carbs),
        ft = num(fat);
      if ([k, p, c, ft].some((x) => x === undefined)) {
        setErr('Calories and macros must be numbers of 0 or more.');
        return;
      }
      if (!food.trim()) {
        setErr('Give the food a name.');
        return;
      }
      const changed = k !== m.kcal || p !== m.proteinG || c !== m.carbsG || ft !== m.fatG;
      onSaveMeal(m.id, {
        foodName: food.trim(),
        mealType,
        ts,
        kcal: k === undefined ? null : k === null ? null : Math.round(k),
        proteinG: p ?? null,
        carbsG: c ?? null,
        fatG: ft ?? null,
        ...(changed ? { nutritionSource: 'manual' as const, confidence: 'high' as const, note: 'Edited by you.' } : {}),
      });
    }
    onClose();
  }

  function eatenNow() {
    if (!e) return;
    const hit = findFood(e.item, state.customFoods);
    const n = hit ? scaleNutrition(hit.food, 1, 'regular') : null;
    onMarkEaten(e.id, {
      ts: e.ts,
      mealType: 'Lunch',
      foodName: hit?.food.name ?? e.item,
      servingLabel: hit?.food.serving ?? '1 serving',
      quantity: 1,
      portion: 'regular',
      kcal: n?.kcal ?? null,
      proteinG: n?.proteinG ?? null,
      carbsG: n?.carbsG ?? null,
      fatG: n?.fatG ?? null,
      nutritionSource: hit ? 'reference-estimate' : 'unknown',
      confidence: hit ? 'medium' : 'none',
      source: 'manual',
      note: hit ? 'Approximate estimate.' : undefined,
    });
    onClose();
  }

  const transcript = e?.transcript ?? m?.transcript;

  return (
    <Sheet title="Edit entry" onClose={onClose} closing={closing}>
      <div className="stack">
        {showSpending && (
          <div className="card fields">
            <div className="label full">Spending</div>
            <Field label="Item" full>
              <input className="input" value={item} onChange={(x) => setItem(x.target.value)} />
            </Field>
            <Field label="Price (RM)">
              <input className="input" inputMode="decimal" value={amount} onChange={(x) => setAmount(x.target.value)} />
            </Field>
            <Field label="Category">
              <select className="input" value={cat} onChange={(x) => setCat(x.target.value as Category)}>
                {CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Notes" full>
              <input className="input" value={notes} onChange={(x) => setNotes(x.target.value)} />
            </Field>
          </div>
        )}
        {m && (
          <div className="card fields">
            <div className="label full">Meal</div>
            <Field label="Food" full>
              <input className="input" value={food} onChange={(x) => setFood(x.target.value)} />
            </Field>
            <Field label="Meal type">
              <select className="input" value={mealType} onChange={(x) => setMealType(x.target.value as MealType)}>
                {MEAL_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </Field>
            <Field label="Calories (kcal)">
              <input className="input" inputMode="numeric" value={kcal} onChange={(x) => setKcal(x.target.value)} placeholder="Unknown" />
            </Field>
            <Field label="Protein (g)">
              <input className="input" inputMode="decimal" value={protein} onChange={(x) => setProtein(x.target.value)} />
            </Field>
            <Field label="Carbs (g)">
              <input className="input" inputMode="decimal" value={carbs} onChange={(x) => setCarbs(x.target.value)} />
            </Field>
            <Field label="Fat (g)">
              <input className="input" inputMode="decimal" value={fat} onChange={(x) => setFat(x.target.value)} />
            </Field>
            <div className="sub full">
              {m.servingLabel} × {m.quantity}, {m.portion} portion.{' '}
              {m.nutritionSource === 'reference-estimate'
                ? 'Approximate estimate, not verified.'
                : m.nutritionSource === 'web'
                ? 'Found online (Open Food Facts), not verified.'
                : m.nutritionSource === 'manual'
                ? 'Entered by you.'
                : 'No data source.'}{' '}
              {m.note && m.nutritionSource !== 'manual' && m.nutritionSource !== 'unknown' ? m.note : ''}
            </div>
          </div>
        )}
        
        {!e && m && !addingPrice && (
           <button className="btn secondary small" onClick={() => setAddingPrice(true)}>+ Add a price</button>
        )}

        <div className="card fields date-time-fix">
          <div className="label full">When</div>
          <Field label="Date">
            <input className="input" type="date" value={date} onChange={(x) => setDate(x.target.value)} />
          </Field>
          <Field label="Time">
            <input className="input" type="time" value={time} onChange={(x) => setTime(x.target.value)} />
          </Field>
        </div>
        {e && !m && e.category === 'Food & Drinks' && (
          <button className="btn secondary" onClick={eatenNow}>
            I ate this (add to calories)
          </button>
        )}
        {transcript && <div className="sub">Original entry: “{transcript}”</div>}
        {err && <div className="notice err" role="alert">{err}</div>}
        <button className="btn" onClick={save}>
          Save changes
        </button>
        {!confirmDel ? (
          <button className="btn danger" onClick={() => setConfirmDel(true)}>
            Delete…
          </button>
        ) : (
          <div className="card stack" role="alertdialog" aria-label="Confirm delete">
            <strong>Delete this entry?</strong>
            {e && m ? (
              <>
                <div className="sub">This purchase is linked to a meal.</div>
                <button
                  className="btn danger"
                  onClick={() => {
                    onDeleteExpense(e.id, true);
                    onClose();
                  }}
                >
                  Delete spending and meal
                </button>
                <button
                  className="btn danger"
                  onClick={() => {
                    onDeleteExpense(e.id, false);
                    onClose();
                  }}
                >
                  Delete spending only (keep calories)
                </button>
                <button
                  className="btn danger"
                  onClick={() => {
                    onDeleteMeal(m.id, false);
                    onClose();
                  }}
                >
                  Delete meal only (keep spending)
                </button>
              </>
            ) : e ? (
              <button
                className="btn danger"
                onClick={() => {
                  onDeleteExpense(e.id, false);
                  onClose();
                }}
              >
                Delete spending
              </button>
            ) : m ? (
              <button
                className="btn danger"
                onClick={() => {
                  onDeleteMeal(m.id, false);
                  onClose();
                }}
              >
                Delete meal
              </button>
            ) : null}
            <button className="btn secondary" onClick={() => setConfirmDel(false)}>
              Cancel
            </button>
          </div>
        )}
      </div>
    </Sheet>
  );
}
