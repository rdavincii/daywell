import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FinanceScreen, HealthScreen, HomeScreen, SettingsScreen } from './Screens';
import { ActivityScreen, EditSheet } from './Timeline';
import type { Entry } from './Timeline';
import { logWeight, commitDrafts, deleteExpense, deleteMeal, emptyState, loadState, markEaten, saveState, updateExpense, updateMeal, newId, addExpenseToMeal } from './lib/store';
import { dayKey } from './lib/time';
import type { AppState, Draft, InputSource, Settings, FoodRef } from './lib/types';
import { topFoods } from './lib/stats';
import { Icons, Toast } from './ui';
import { FreshIds, usePresence } from './motion';
import { QuickLog } from './QuickLog';
import { RecipesCard } from './Recipes';

type Tab = 'home' | 'activity' | 'log' | 'health' | 'finance';

const TABS: { id: Tab; label: string; icon: JSX.Element }[] = [
  { id: 'home', label: 'Home', icon: Icons.home },
  { id: 'activity', label: 'Activity', icon: Icons.list },
  { id: 'log', label: 'Log', icon: Icons.plus },
  { id: 'health', label: 'Health', icon: Icons.heart },
  { id: 'finance', label: 'Finance', icon: Icons.wallet },
];

export default function App() {
  const [state, setState] = useState<AppState>(() => loadState());
  const [persisted, setPersisted] = useState(true);
  const [tab, setTab] = useState<Tab | 'settings'>('home');
  const [editing, setEditing] = useState<Entry | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [toast, setToast] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [fresh, setFresh] = useState<string[]>([]);
  const shownEdit = usePresence(editing, 240); // keeps the edit sheet mounted while it slides out
  const shownCelebration = usePresence(showCelebration ? true : null, 180);
  const celebrateTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const prevIds = useRef<Set<string> | null>(null);
  const freshTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Which records were just added? Their rows open up and fade in. Not on first load.
  useEffect(() => {
    const ids = new Set<string>([...state.expenses.map((e) => e.id), ...state.meals.map((m) => m.id)]);
    const prev = prevIds.current;
    prevIds.current = ids;
    if (!prev) return;
    const added = [...ids].filter((id) => !prev.has(id));
    if (added.length === 0 || added.length > 6) return; // a big sync merge should not animate
    setFresh(added);
    clearTimeout(freshTimer.current);
    freshTimer.current = setTimeout(() => setFresh([]), 1800);
  }, [state.expenses, state.meals]);
  useEffect(() => () => { clearTimeout(freshTimer.current); celebrateTimers.current.forEach(clearTimeout); }, []);

  /** Shows the check badge briefly. Optionally goes Home once the review sheet has slid away. */
  const celebrate = (goHomeAfterMs?: number) => {
    celebrateTimers.current.forEach(clearTimeout);
    setShowCelebration(true);
    const t: ReturnType<typeof setTimeout>[] = [setTimeout(() => setShowCelebration(false), 900)];
    if (goHomeAfterMs !== undefined) t.push(setTimeout(() => setTab('home'), goHomeAfterMs));
    celebrateTimers.current = t;
  };

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setPersisted(saveState(state));
  }, [state]);

  useEffect(() => {
    const root = document.documentElement;
    const mq = typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    const dark = state.settings.theme === 'dark' || (state.settings.theme === 'system' && !!mq?.matches);
    root.dataset.theme = dark ? 'dark' : 'light';
    if (state.settings.theme !== 'system' || !mq) return;
    const h = () => { root.dataset.theme = mq.matches ? 'dark' : 'light'; };
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, [state.settings.theme]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const today = useMemo(() => dayKey(now, state.settings.timezone), [now, state.settings.timezone]);
  const apply = useCallback((fn: (s: AppState) => AppState) => setState((s) => fn(s)), []);

  const handleLogWeight = (kg: number, ts: number) => apply((s) => logWeight(s, kg, ts));

  const onCommit = (drafts: Draft[], key: string, meta: { source: InputSource; transcript?: string }) => {
    apply((s) => commitDrafts(s, drafts, key, meta));
    celebrate(450); // sheet exit (240ms) finishes, then Home shows the bars moving and the new row opening

    const expenses = drafts.filter((d) => d.expense).length;
    const meals = drafts.filter((d) => d.meal?.eaten).length;
    setToast(
      `Saved ${expenses ? expenses + ' expense' + (expenses > 1 ? 's' : '') : ''}${
        expenses && meals ? ' and ' : ''
      }${meals ? meals + ' meal' + (meals > 1 ? 's' : '') : ''}.`
    );
  };

  const handleDuplicate = (entry: Entry) => {
    apply((s) => {
      const ts = Date.now();
      let newExpId: string | undefined = undefined;
      const nextExp = [...s.expenses];
      const nextMeals = [...s.meals];

      if (entry.expense) {
        newExpId = newId();
        nextExp.unshift({
          ...entry.expense,
          id: newExpId,
          ts,
        });
      }

      if (entry.meal) {
        nextMeals.unshift({
          ...entry.meal,
          id: newId(),
          expenseId: newExpId,
          ts,
        });
      }

      return { ...s, expenses: nextExp, meals: nextMeals };
    });
    celebrate();
    setToast(`Duplicated "${entry.title}" successfully.`);
  };

  const handleDelete = (entry: Entry) => {
    apply((s) => {
      let next = s;
      if (entry.expense) next = deleteExpense(next, entry.expense.id, true);
      else if (entry.meal) next = deleteMeal(next, entry.meal.id, true);
      return next;
    });
    setToast(`Deleted "${entry.title}".`);
  };

  return (
    <FreshIds.Provider value={fresh}>
    <div className="app">
      {tab === 'home' && (
        <HomeScreen
          state={state}
          now={now}
          today={today}
          onOpen={setEditing}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
          onLogWeight={handleLogWeight}
          goto={(t) => setTab(t)}
        />
      )}
      {tab === 'activity' && (
        <ActivityScreen
          state={state}
          today={today}
          onOpen={setEditing}
          onDuplicate={handleDuplicate}
          onDelete={handleDelete}
        />
      )}
      {tab === 'log' && (
        <div className="page" style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <header>
            <span className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Record</span>
            <h1>Log Entry</h1>
            <div className="sub">Add expenses or food. Tap Scan for a barcode or meal photo.</div>
          </header>
          

          <RecipesCard
            customFoods={state.customFoods || []}
            onSave={(foods: FoodRef[]) => apply((s) => ({ ...s, customFoods: foods }))}
            onLog={(name) => setDraftText(name)}
          />

          <div style={{ marginTop: 'auto', paddingTop: 16 }}>
            <QuickLog
              now={now}
              tz={state.settings.timezone}
              onCommit={onCommit}
              lang={state.settings.voiceLang}
              suggestions={topFoods(state, 5).map((f) => f.name)}
              draftText={draftText}
              setDraftText={setDraftText}
              customFoods={state.customFoods || []}
            />
          </div>
        </div>
      )}
      {tab === 'health' && <HealthScreen state={state} today={today} onLogWeight={handleLogWeight} />}
      {tab === 'finance' && <FinanceScreen state={state} today={today} />}
      {tab === 'settings' && (
        <SettingsScreen
          state={state}
          persisted={persisted}
          onChange={(p: Partial<Settings>) => apply((s) => {
            let nextLogs = s.weightLogs || [];
            if (p.currentWeightKg !== undefined && p.currentWeightKg !== s.settings.currentWeightKg) {
              const lastTs = nextLogs.length > 0 ? nextLogs[nextLogs.length - 1].ts : 0;
              if (Date.now() - lastTs > 3000 || nextLogs.length === 0) {
                 nextLogs = [...nextLogs, { ts: Date.now(), weightKg: p.currentWeightKg }].sort((a, b) => a.ts - b.ts);
              }
            }
            return { ...s, settings: { ...s.settings, ...p }, weightLogs: nextLogs };
          })}
          onMergeState={(merged: AppState) => {
            setState(merged);
            setToast('Synced and updated all device data successfully!');
          }}
          onReset={() => {
            setState(emptyState());
            setToast('All data deleted.');
            setTab('home');
          }}
          onBack={() => setTab('home')}
        />
      )}

      {/* Check badge: pops in, check draws, fades out */}
      {shownCelebration.value && (
        <CelebrationBadge exiting={shownCelebration.exiting} />
      )}
      {shownEdit.value && (
        <EditSheet
          key={shownEdit.value.id}
          closing={shownEdit.exiting}
          entry={shownEdit.value}
          state={state}
          onClose={() => setEditing(null)}
          onSaveExpense={(id, patch) => apply((s) => updateExpense(s, id, patch))}
          onSaveMeal={(id, patch) => apply((s) => updateMeal(s, id, patch))}
          onDeleteExpense={(id, also) => apply((s) => deleteExpense(s, id, also))}
          onDeleteMeal={(id, also) => apply((s) => deleteMeal(s, id, also))}
          onMarkEaten={(id, meal) => apply((s) => markEaten(s, id, meal))}
          onAddExpenseToMeal={(id, exp) => apply((s) => addExpenseToMeal(s, id, exp))}
        />
      )}

      <Toast message={toast} />

      <nav className="tabbar" aria-label="Main">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab ${t.id === 'log' ? 'tab-log' : ''}`}
            aria-current={tab === t.id ? 'page' : undefined}
            onClick={() => setTab(t.id)}
            style={t.id === 'log' ? {} : {}}
          >
            {t.id === 'log' ? (
               <div className="log-circle">{t.icon}</div>
            ) : (
               <>
                 {t.icon}
                 <span>{t.label}</span>
               </>
            )}
          </button>
        ))}
      </nav>
    </div>
    </FreshIds.Provider>
  );
}

function CelebrationBadge({ exiting }: { exiting: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [entered, setEntered] = useState(false);
  useLayoutEffect(() => {
    void ref.current?.getBoundingClientRect(); // commit the closed styles first so the transition runs
    setEntered(true);
  }, []);
  return (
    <div className="celebration-overlay" ref={ref} data-state={entered && !exiting ? 'open' : 'closed'}>
      <div className="celebration-badge">
        <svg viewBox="0 0 52 52" className="checkmark-svg" aria-hidden="true">
          <circle cx="26" cy="26" r="24" fill="none" className="checkmark-circle" />
          <path fill="none" d="M14 27l7 7 16-16" className="checkmark-check" pathLength={1} />
        </svg>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>Logged</span>
      </div>
    </div>
  );
}
