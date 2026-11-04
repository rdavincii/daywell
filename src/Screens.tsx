import { monotonePath } from './lib/chart';
import { useState, useEffect } from 'react';
import { EntryRow, buildEntries } from './Timeline';
import type { Entry } from './Timeline';
import { formatRM, parseToSen, senToInput } from './lib/money';
import {
  averageIntake,
  budgetStatus,
  calorieTrend,
  categoryTotals,
  insights,
  nutritionOnDay,
  spendInRange,
  spendOnDay,
  topFoods,
  weekRange,
  calculateSavings,
  suggestMacros,
  calculateSuggestedTargetDate,
} from './lib/stats';
import { dayKey, longDate, fromFormFields, addDays } from './lib/time';
import { toCSV } from './lib/store';
import { getKey, setKey } from './lib/keys';
import { exportBackupJSON, mergeStates } from './lib/sync';
import { CATEGORIES, MEAL_TYPES } from './lib/types';
import type { AppState, Category, Settings, WeightGoal } from './lib/types';
import { Field, ProgressBar, Ring, Icons, Segmented } from './ui';

const nf = new Intl.NumberFormat('en-MY');

function greeting(hour: number) {
  return hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
}

function StreakLine({ state, today }: { state: AppState; today: string }) {
  const daysOfWeek = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  const wk = weekRange(today);
  const activeDays = new Set<string>();

  for (const e of state.expenses) activeDays.add(dayKey(e.ts, state.settings.timezone));
  for (const m of state.meals) activeDays.add(dayKey(m.ts, state.settings.timezone));
  for (const w of state.weightLogs) activeDays.add(dayKey(w.ts, state.settings.timezone));

  return (
    <div className="card" style={{ padding: '12px 16px' }}>
      <div className="row between" style={{ marginBottom: 8 }}>
        <span className="label">Weekly Streak</span>
        <span className="sub" style={{ fontWeight: 600, color: 'var(--blue)' }}>
          {state.streak} {state.streak === 1 ? 'day' : 'days'} active 🔥
        </span>
      </div>
      <div className="streak-line">
        {daysOfWeek.map((label, idx) => {
          const dStr = addDays(wk.start, idx);
          const isActive = activeDays.has(dStr);
          const isToday = dStr === today;
          return (
            <div key={dStr} className={`streak-node ${isActive ? 'active' : ''} ${isToday ? 'today' : ''}`}>
              <span className="streak-dot">{isActive ? '✓' : ''}</span>
              <span className="streak-lbl">{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HomeWeightLog({
  state,
  today,
  onLogWeight,
  tz,
}: {
  state: AppState;
  today: string;
  onLogWeight: (kg: number, ts: number) => void;
  tz: string;
}) {
  const initial = state.settings.currentWeightKg || 70.0;
  const [val, setVal] = useState<number>(initial);
  const [d, setD] = useState(today);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (state.settings.currentWeightKg) setVal(state.settings.currentWeightKg);
  }, [state.settings.currentWeightKg]);

  const step = (delta: number) => {
    setVal((prev) => Math.round((prev + delta) * 10) / 10);
    setSaved(false);
  };

  return (
    <div className="card stack">
      <div className="row between">
        <span className="label">Log Weight</span>
        {state.settings.targetWeightKg ? <span className="sub">Target: {state.settings.targetWeightKg} kg</span> : null}
      </div>

      <div className="weight-scroll-box">
        <button type="button" className="step-btn" onClick={() => step(-0.1)} aria-label="Decrease weight">
          −
        </button>
        <div className="weight-display">
          <span className="weight-num">{val.toFixed(1)}</span>
          <span className="weight-unit">kg</span>
        </div>
        <button type="button" className="step-btn" onClick={() => step(0.1)} aria-label="Increase weight">
          +
        </button>
      </div>

      <input
        type="range"
        min="30"
        max="180"
        step="0.1"
        value={val}
        onChange={(e) => {
          setVal(parseFloat(e.target.value));
          setSaved(false);
        }}
        className="weight-slider"
      />

      <div className="row" style={{ marginTop: 4 }}>
        <input
          className="input"
          type="date"
          value={d}
          onChange={(e) => {
            setD(e.target.value);
            setSaved(false);
          }}
          style={{ flex: 1 }}
        />
        <button
          className="btn small"
          style={{ minWidth: 78 }}
          onClick={() => {
            const ts = fromFormFields(d, '12:00', tz) || Date.now();
            onLogWeight(val, ts);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
          }}
        >
          {saved ? 'Saved ✓' : 'Save'}
        </button>
      </div>
    </div>
  );
}

export function HomeScreen({
  state,
  now,
  today,
  onOpen,
  onDuplicate,
  onDelete,
  onLogWeight,
  goto,
}: {
  state: AppState;
  now: number;
  today: string;
  onOpen: (e: Entry) => void;
  onDuplicate?: (e: Entry) => void;
  onDelete?: (e: Entry) => void;
  onLogWeight: (kg: number, ts: number) => void;
  goto: (t: 'activity' | 'settings' | 'log') => void;
}) {
  const s = state.settings;
  const b = budgetStatus(state, today);
  const n = nutritionOnDay(state, today);
  const tips = insights(state, today);
  const recent = buildEntries(state).slice(0, 4);
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: s.timezone, hour: 'numeric', hourCycle: 'h23' }).format(new Date(now))
  );

  const loggedWeightToday = state.weightLogs.some(w => dayKey(w.ts, s.timezone) === today);

  return (
    <div className="page" style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <header className="row between" style={{ alignItems: 'flex-start' }}>
        <div>
          <h1>
            {greeting(hour)}
            {s.displayName ? ', ' + s.displayName : ''}
          </h1>
          <div className="sub">{longDate(now, s.timezone)}</div>
        </div>
        <button
          className="icon-btn"
          onClick={() => goto('settings')}
          aria-label="Settings"
          title="Settings"
          style={{ width: 40, height: 40, background: 'transparent' }}
        >
          {Icons.gear}
        </button>
      </header>

      <StreakLine state={state} today={today} />

      <div className="grid2">
        <div className="card stack">
          <span className="label">Spending</span>
          <div className="big">{formatRM(b.spentToday, s.currency)}</div>
          <ProgressBar id="home-spend" value={b.spentToday} max={b.dailyBudget} />
          <span className="sub">
            {b.dailyBudget > 0
              ? b.dailyRemaining >= 0
                ? `${formatRM(b.dailyRemaining, s.currency)} left of ${formatRM(b.dailyBudget, s.currency)}`
                : `${formatRM(-b.dailyRemaining, s.currency)} over budget`
              : 'No daily budget set'}
          </span>
        </div>
        <div className="card stack">
          <span className="label">Calories</span>
          <div className="big">{nf.format(n.kcal)}</div>
          <ProgressBar id="home-kcal" value={n.kcal} max={s.kcalTarget} tone={n.kcal > s.kcalTarget ? 'orange' : 'green'} />
          <span className="sub">{n.meals === 0 ? 'No meals logged yet' : `of ${nf.format(s.kcalTarget)} kcal`}</span>
        </div>
      </div>

      {!loggedWeightToday && <HomeWeightLog state={state} today={today} onLogWeight={onLogWeight} tz={s.timezone} />}

      {n.mealsWithoutKcal > 0 && (
        <div className="notice warn">
          {n.mealsWithoutKcal} meal{n.mealsWithoutKcal > 1 ? 's have' : ' has'} no calorie value, so today's calories may be understated.
        </div>
      )}

      {tips.map((t) => (
        <div className="notice" key={t}>
          {t}
        </div>
      ))}

      <div>
        <div className="row between" style={{ marginBottom: 6 }}>
          <span className="label">Recent Activity</span>
          {recent.length > 0 && (
            <button className="btn secondary small" onClick={() => goto('activity')}>
              See all
            </button>
          )}
        </div>
        {recent.length === 0 ? (
          <div className="card empty">
            <strong>No activity today</strong>
            Head over to the Log tab to record your first meal or expense.
            <button className="btn secondary" style={{ marginTop: 12 }} onClick={() => goto('log')}>
              Open Logger
            </button>
          </div>
        ) : (
          recent.map((e) => (
            <EntryRow
              key={e.id}
              entry={e}
              tz={s.timezone}
              onOpen={onOpen}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
            />
          ))
        )}
      </div>
    </div>
  );
}

export function HealthScreen({ state, today, onLogWeight }: { state: AppState; today: string; onLogWeight: (kg: number, ts: number) => void }) {
  const s = state.settings;
  const n = nutritionOnDay(state, today);
  const trend = calorieTrend(state, today);
  const avg = averageIntake(trend);
  const foods = topFoods(state);
  const maxK = Math.max(s.kcalTarget, ...trend.map((t) => t.kcal ?? 0), 1);
  const remaining = s.kcalTarget - n.kcal;
  const byMeal = MEAL_TYPES.map((t) => ({
    t,
    kcal: state.meals
      .filter((m) => m.mealType === t && dayKey(m.ts, s.timezone) === today)
      .reduce((x, m) => x + (m.kcal ?? 0), 0),
    count: state.meals.filter((m) => m.mealType === t && dayKey(m.ts, s.timezone) === today).length,
  })).filter((x) => x.count > 0);

  const [graphPeriod, setGraphPeriod] = useState<'weekly' | 'monthly'>('weekly');
  const [hoveredNode, setHoveredNode] = useState<{x: number, y: number, date: string, weight: number} | null>(null);

  const macro = (label: string, v: number, t: number) => (
    <div className="stack" key={label} style={{ gap: 4 }}>
      <div className="row between">
        <span>{label}</span>
        <span className="sub">
          {v} / {t} g
        </span>
      </div>
      <ProgressBar id={`macro-${label}`} value={v} max={t} tone="green" />
    </div>
  );

  const healthIndication = () => {
    if (n.meals === 0) return 'Log meals to see health indications.';
    if (n.proteinG > s.proteinTarget) return 'Great protein intake today! 💪';
    if (n.kcal > s.kcalTarget + 300) return 'Calorie intake is quite high today. ⚠️';
    if (n.fatG > s.fatTarget + 20) return 'Fat intake is a bit high. 🥑';
    return 'Looking balanced today! 🥗';
  };

  const AppleHealthWeightChart = () => {
    const allLogs = state.weightLogs || [];
    const windowDays = graphPeriod === 'weekly' ? 7 : 30;
    const cutoff = Date.now() - windowDays * 86400000;
    const logs = allLogs.filter((l) => l.ts >= cutoff);

    if (logs.length === 0 && !s.currentWeightKg) {
      return <div className="sub">No weight entries recorded in this window.</div>;
    }

    const effectiveLogs =
      logs.length === 0 ? [{ ts: Date.now(), weightKg: s.currentWeightKg || 70 }] : logs;
    const weights = effectiveLogs.map((l) => l.weightKg);
    const avgWeight = weights.reduce((a, b) => a + b, 0) / weights.length;
    const targetW = s.targetWeightKg;

    const bounds = [...weights];
    if (targetW) bounds.push(targetW);

    const minW = Math.min(...bounds) - 1.5;
    const maxW = Math.max(...bounds) + 1.5;
    const dw = maxW - minW || 1;

    const minT = effectiveLogs[0].ts;
    const maxT = effectiveLogs[effectiveLogs.length - 1].ts;
    const dt = Math.max(maxT - minT, 86400000);

    // Fixed coordinate space scaled uniformly, so dots stay round and dashes keep their rhythm.
    const W = 320, H = 140, PX = 10, PY = 12;
    const X = (ts: number) => (effectiveLogs.length === 1 ? W / 2 : PX + ((ts - minT) / dt) * (W - 2 * PX));
    const Y = (kg: number) => PY + (1 - (kg - minW) / dw) * (H - 2 * PY);
    const nodes = effectiveLogs.map((l) => ({ x: X(l.ts), y: Y(l.weightKg), date: new Date(l.ts).toLocaleDateString(), weight: l.weightKg }));
    const targetY = targetW ? Y(targetW) : null;
    const avgY = Y(avgWeight);
    const pin = (n: (typeof nodes)[0]) => setHoveredNode({ x: (n.x / W) * 100, y: (n.y / H) * 100, date: n.date, weight: n.weight });

    return (
      <div className="stack" style={{ gap: 8 }}>
        <div className="row between">
          <span className="sub">
            Average: <strong>{avgWeight.toFixed(1)} kg</strong>
          </span>
          {targetW && (
            <span className="sub">
              Target: <strong>{targetW.toFixed(1)} kg</strong>
            </span>
          )}
        </div>
        <div style={{ aspectRatio: '320 / 140', position: 'relative', width: '100%' }} onMouseLeave={() => setHoveredNode(null)}>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Weight over time" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
            <line x1={PX} y1={avgY} x2={W - PX} y2={avgY} stroke="var(--green)" strokeWidth="1.5" strokeDasharray="5 4" />
            {targetY !== null && (
              <line x1={PX} y1={targetY} x2={W - PX} y2={targetY} stroke="var(--orange)" strokeWidth="1.5" strokeDasharray="2 4" strokeLinecap="round" />
            )}
            <path d={monotonePath(nodes)} fill="none" stroke="var(--blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            {nodes.map((n, i) => (
              <g key={i} onMouseEnter={() => pin(n)} onClick={() => pin(n)} style={{ cursor: 'pointer' }}>
                <circle cx={n.x} cy={n.y} r="10" fill="transparent" />
                <circle cx={n.x} cy={n.y} r="2.5" fill="var(--blue)" />
              </g>
            ))}
          </svg>
          
          {hoveredNode && (
            <div style={{
               position: 'absolute',
               left: `${hoveredNode.x}%`,
               top: `${hoveredNode.y}%`,
               transform: 'translate(-50%, -130%)',
               background: 'var(--text)',
               color: 'var(--bg)',
               padding: '4px 8px',
               borderRadius: '6px',
               fontSize: '12px',
               pointerEvents: 'none',
               whiteSpace: 'nowrap',
               zIndex: 10,
               boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
               textAlign: 'center'
            }}>
              <strong>{hoveredNode.weight.toFixed(1)} kg</strong><br/>
              <span style={{ opacity: 0.8, fontSize: '10px' }}>{hoveredNode.date}</span>
            </div>
          )}
        </div>
        <div className="chart-legend">
          <span className="legend-item">
            <span className="legend-line blue" /> Logged
          </span>
          <span className="legend-item">
            <span className="legend-line green dashed" /> Average ({avgWeight.toFixed(1)} kg)
          </span>
          {targetW && (
            <span className="legend-item">
              <span className="legend-line orange dashed" /> Target ({targetW.toFixed(1)} kg)
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="page">
      <h1>Health</h1>

      <div className="notice" style={{ background: 'var(--green-soft)', color: 'var(--green)', fontWeight: 500 }}>
        {healthIndication()}
      </div>

      <div className="card row">
        <Ring id="health-kcal" value={n.kcal} max={s.kcalTarget}>
          <div className="big" style={{ fontSize: 24 }}>
            {nf.format(n.kcal)}
          </div>
          <div className="sub">kcal</div>
        </Ring>
        <div className="stack" style={{ gap: 4 }}>
          <span className="label">Today</span>
          <div>
            <strong>{nf.format(s.kcalTarget)}</strong> <span className="sub">target ({s.weightGoal})</span>
          </div>
          <div className={remaining < 0 ? 'warn' : 'good'}>
            <strong>{nf.format(Math.abs(remaining))}</strong>{' '}
            <span className="sub">{remaining < 0 ? 'over target' : 'remaining'}</span>
          </div>
          <div className="sub">Weight: {s.currentWeightKg} kg</div>
        </div>
      </div>

      <div className="card stack">
        <div className="row between">
          <span className="label">Weight History</span>
          <Segmented
            label="Weight period"
            value={graphPeriod}
            options={['weekly', 'monthly'] as const}
            onChange={(v) => setGraphPeriod(v)}
          />
        </div>
        <AppleHealthWeightChart />
      </div>
      
      <HomeWeightLog state={state} today={today} onLogWeight={onLogWeight} tz={s.timezone} />

      <div className="card stack">
        <span className="label">Macros today</span>
        {macro('Protein', n.proteinG, s.proteinTarget)}
        {macro('Carbohydrates', n.carbsG, s.carbsTarget)}
        {macro('Fat', n.fatG, s.fatTarget)}
      </div>

      {byMeal.length > 0 && (
        <div className="card stack">
          <span className="label">Meal breakdown</span>
          {byMeal.map((x) => (
            <div className="row between" key={x.t}>
              <span>{x.t}</span>
              <span className="sub">{nf.format(x.kcal)} kcal</span>
            </div>
          ))}
        </div>
      )}

      <div className="card stack">
        <span className="label">Last 7 days</span>
        <div className="trend" role="img" aria-label="Calories for the last 7 days">
          {trend.map((t) => (
            <div key={t.day}>
              <span>{t.kcal === null ? '–' : nf.format(t.kcal)}</span>
              <div
                className={'b' + (t.kcal === null ? ' none' : '')}
                style={{ height: t.kcal === null ? 3 : Math.max(3, (t.kcal / maxK) * 80) }}
              />
              <span>
                {new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'narrow' }).format(new Date(t.day))}
              </span>
            </div>
          ))}
        </div>
        <div className="sub">
          {avg
            ? `Average ${nf.format(avg.avg)} kcal across ${avg.days} logged day${avg.days > 1 ? 's' : ''}.`
            : 'No logged days in the last week.'}
        </div>
      </div>

      {foods.length > 0 && (
        <div className="card stack">
          <span className="label">Common foods</span>
          {foods.map((f) => (
            <div className="row between" key={f.name}>
              <span>{f.name}</span>
              <span className="sub">{f.count}×</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DonutChart({ cats, total }: { cats: { category: string; sen: number }[]; total: number }) {
  if (total === 0) return null;
  let acc = 0;
  const r = 15.91549430918954;
  const c = 100;
  const colors = ['#0a6cdc', '#1f9d4c', '#c25e00', '#d70015', '#5856d6', '#ff2d55', '#ff9f0a', '#34c759', '#8e8e93', '#af52de'];
  return (
    <div style={{ position: 'relative', width: 140, height: 140, margin: '0 auto 16px' }}>
      <svg viewBox="0 0 32 32" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)', borderRadius: '50%' }}>
        {cats.map((cat, i) => {
          const pct = (cat.sen / total) * 100;
          const dasharray = `${pct} ${c}`;
          const dashoffset = -acc;
          acc += pct;
          return (
            <circle
              key={cat.category}
              r={r}
              cx="16"
              cy="16"
              fill="none"
              stroke={colors[i % colors.length]}
              strokeWidth="4"
              strokeDasharray={dasharray}
              strokeDashoffset={dashoffset}
            />
          );
        })}
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <span className="label" style={{ fontSize: 10 }}>
          Total
        </span>
        <strong style={{ fontSize: 13, marginTop: -2 }}>{formatRM(total, '')}</strong>
      </div>
    </div>
  );
}

export function FinanceScreen({ state, today }: { state: AppState; today: string }) {
  const s = state.settings;
  const cur = s.currency;
  const wk = weekRange(today);
  const mKey = today.slice(0, 7);
  const b = budgetStatus(state, today);
  const dayOfMonth = Number(today.slice(8));
  const cats = categoryTotals(state, mKey + '-01', today);
  const catTotal = cats.reduce((t, c) => t + c.sen, 0);
  const savings = calculateSavings(state, today);
  const colors = ['#0a6cdc', '#1f9d4c', '#c25e00', '#d70015', '#5856d6', '#ff2d55', '#ff9f0a', '#34c759', '#8e8e93', '#af52de'];

  return (
    <div className="page">
      <h1>Finance</h1>
      <div className="grid2">
        <div className="card stack">
          <span className="label">Today</span>
          <div className="big">{formatRM(spendOnDay(state, today), cur)}</div>
        </div>
        <div className="card stack">
          <span className="label">This week</span>
          <div className="big">{formatRM(spendInRange(state, wk.start, today), cur)}</div>
        </div>
      </div>

      <div className="card row between" style={{ padding: '16px' }}>
        <div className="stack" style={{ gap: 2 }}>
          <span className="label">Accumulated Savings</span>
          <div className="sub">Unspent daily budgets.</div>
        </div>
        <div className="big good">{formatRM(savings, cur)}</div>
      </div>

      <div className="card stack">
        <div className="row between">
          <span className="label">This month</span>
          <span className="sub">{b.monthlyBudget > 0 ? `Budget ${formatRM(b.monthlyBudget, cur)}` : 'No budget set'}</span>
        </div>
        <div className="big">{formatRM(b.spentMonth, cur)}</div>
        <ProgressBar id="fin-month" value={b.spentMonth} max={b.monthlyBudget} />
        {b.monthlyBudget > 0 && (
          <div className={'sub ' + (b.monthlyRemaining < 0 ? 'bad' : '')}>
            {b.monthlyRemaining >= 0
              ? `${formatRM(b.monthlyRemaining, cur)} remaining`
              : `${formatRM(-b.monthlyRemaining, cur)} over budget`}
          </div>
        )}
        <div className="sub">Average per day: {formatRM(Math.round(b.spentMonth / dayOfMonth), cur)}</div>
      </div>

      {cats.length > 0 && (
        <div className="card stack">
          <span className="label">By category</span>
          <DonutChart cats={cats} total={catTotal} />
          {cats.map((c, i) => {
            const limit = s.categoryBudgetsSen[c.category];
            const over = limit ? c.sen > limit : false;
            const near = limit ? c.sen > limit * 0.8 : false;
            const chartColor = colors[i % colors.length];
            return (
              <div className="stack" style={{ gap: 4 }} key={c.category}>
                <div className="row between">
                  <div className="row" style={{ gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: chartColor }} />
                    <span style={{ fontWeight: over ? 700 : 400, color: over ? 'var(--red)' : 'inherit' }}>
                      {c.category}
                    </span>
                  </div>
                  <span className="sub" style={{ color: over ? 'var(--red)' : 'inherit' }}>
                    {formatRM(c.sen, cur)} {limit ? `/ ${formatRM(limit, cur)}` : ''}
                  </span>
                </div>
                <ProgressBar
                  id={`cat-${c.category}`}
                  value={c.sen}
                  max={limit || catTotal}
                  tone={over ? 'red' : near ? 'orange' : ('blue' as any)}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RMField({ label, sen, onCommit }: { label: string; sen: number; onCommit: (sen: number) => void }) {
  const [t, setT] = useState(senToInput(sen));
  useEffect(() => {
    setT(senToInput(sen));
  }, [sen]);
  const [bad, setBad] = useState(false);
  return (
    <Field label={label}>
      <input
        className="input"
        inputMode="decimal"
        value={t}
        aria-invalid={bad}
        onChange={(e) => setT(e.target.value)}
        onBlur={() => {
          const v = parseToSen(t);
          if (v === null) setBad(true);
          else {
            setBad(false);
            onCommit(v);
            setT(senToInput(v));
          }
        }}
      />
    </Field>
  );
}

function IntField({ label, value, onCommit }: { label: string; value: number; onCommit: (n: number) => void }) {
  const [t, setT] = useState(String(value));
  useEffect(() => {
    setT(String(value));
  }, [value]);
  return (
    <Field label={label}>
      <input
        className="input"
        inputMode="numeric"
        value={t}
        onChange={(e) => setT(e.target.value)}
        onBlur={() => {
          const n = Math.round(Number(t));
          if (Number.isFinite(n) && n >= 0) onCommit(n);
          else setT(String(value));
        }}
      />
    </Field>
  );
}

const TIMEZONES = ['Asia/Kuala_Lumpur', 'Asia/Singapore', 'Asia/Jakarta', 'Asia/Bangkok', 'Asia/Brunei', 'UTC'];

function KeysCard() {
  const [fdc, setFdc] = useState(getKey('fdc'));
  const [gem, setGem] = useState(getKey('gemini'));
  return (
    <div className="card stack">
      <span className="label">Scan & food databases</span>
      <div className="sub">Keys stay in this browser only. They are not in backups or sync. Both are free.</div>
      <Field label="Google AI (Gemini) key: needed to scan meals" full>
        <input className="input" type="password" autoComplete="off" value={gem} onChange={(e) => { setGem(e.target.value); setKey('gemini', e.target.value); }} placeholder="Get one at aistudio.google.com" />
      </Field>
      <Field label="USDA FoodData Central key: optional, avoids the shared limit" full>
        <input className="input" type="password" autoComplete="off" value={fdc} onChange={(e) => { setFdc(e.target.value); setKey('fdc', e.target.value); }} placeholder="Get one at fdc.nal.usda.gov/api-key-signup" />
      </Field>
    </div>
  );
}

export function SettingsScreen({
  state,
  persisted,
  onChange,
  onReset,
  onBack,
  onMergeState,
}: {
  state: AppState;
  persisted: boolean;
  onChange: (p: Partial<Settings>) => void;
  onReset: () => void;
  onBack: () => void;
  onMergeState: (imported: AppState) => void;
}) {
  const s = state.settings;
  const [tab, setTab] = useState<'profile' | 'budgets' | 'data'>('profile');
  const [selectedCat, setSelectedCat] = useState<Category>('Food & Drinks');
  const [confirm, setConfirm] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);


  function exportCSV() {
    const blob = new Blob([toCSV(state)], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `daywell-export-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function handleFileImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        const merged = mergeStates(state, parsed);
        onMergeState(merged);
        setSyncStatus('Backup imported and merged successfully! ✓');
      } catch {
        setSyncStatus('Invalid backup file. Please choose a valid JSON backup.');
      }
    };
    reader.readAsText(file);
  }

  function handleGoalChange(goal: WeightGoal) {
    let newTarget = s.kcalTarget;
    if (goal === 'lose') newTarget = Math.max(1200, s.kcalTarget - 500);
    else if (goal === 'gain') newTarget = s.kcalTarget + 350;
    else if (goal === 'maintain') newTarget = 2000;
    onChange({ weightGoal: goal, kcalTarget: newTarget });
  }

  function getSuggestedCalories(st: Settings) {
    if (!st.age || !st.heightCm || !st.currentWeightKg || !st.gender || !st.activityLevel) return null;
    let bmr = 10 * st.currentWeightKg + 6.25 * st.heightCm - 5 * st.age;
    bmr += st.gender === 'male' ? 5 : -161;

    const multipliers = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 };
    const tdee = bmr * (multipliers[st.activityLevel] || 1.2);

    if (st.weightGoal === 'lose') return Math.round(tdee - 500);
    if (st.weightGoal === 'gain') return Math.round(tdee + 350);
    return Math.round(tdee);
  }

  const sugKcal = getSuggestedCalories(s) || s.kcalTarget;
  const baseWeightForMacros = s.targetWeightKg || s.currentWeightKg || 70;
  const suggestedMacros = suggestMacros(sugKcal, baseWeightForMacros);


  return (
    <div className="page">
      <header className="row">
        <button
          className="icon-btn"
          style={{ width: 40, height: 40, background: 'transparent', marginLeft: -12 }}
          onClick={onBack}
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <h1 style={{ margin: 0 }}>Settings</h1>
      </header>

      {!persisted && (
        <div className="notice err" role="alert">
          Storage is restricted in this window. Export regularly to keep data safe.
        </div>
      )}

      <div className="seg" role="group" aria-label="Settings section">
        <button type="button" aria-pressed={tab === 'profile'} onClick={() => setTab('profile')}>
          Profile
        </button>
        <button type="button" aria-pressed={tab === 'budgets'} onClick={() => setTab('budgets')}>
          Budgets
        </button>
        <button type="button" aria-pressed={tab === 'data'} onClick={() => setTab('data')}>
          Data & Sync
        </button>
      </div>

      {tab === 'profile' && (
        <>
          <div className="card fields">
            <div className="label full">User Profile & Body Targets</div>
            <Field label="Display name" full>
              <input
                className="input"
                value={s.displayName}
                onChange={(e) => onChange({ displayName: e.target.value.slice(0, 40) })}
                placeholder="Your name"
              />
            </Field>
            <Field label="Current Weight (kg)">
              <input
                className="input"
                type="number"
                inputMode="decimal"
                step="0.1"
                value={s.currentWeightKg || ''}
                onChange={(e) => onChange({ currentWeightKg: parseFloat(e.target.value) || 0 })}
              />
            </Field>
            <Field label="Target Weight (kg) [Optional]">
              <input
                className="input"
                type="number"
                inputMode="decimal"
                step="0.1"
                value={s.targetWeightKg || ''}
                onChange={(e) => {
                  const tw = parseFloat(e.target.value) || undefined;
                  const autoDate = tw && s.currentWeightKg
                    ? calculateSuggestedTargetDate(s.currentWeightKg, tw, dayKey(Date.now(), s.timezone))
                    : s.targetWeightDate;
                  onChange({ targetWeightKg: tw, targetWeightDate: autoDate });
                }}
              />
            </Field>
            <Field label="Target Date [Optional]">
              <input
                className="input"
                type="date"
                value={s.targetWeightDate || ''}
                onChange={(e) => onChange({ targetWeightDate: e.target.value || undefined })}
              />
            </Field>
            <Field label="Age">
              <input
                className="input"
                type="number"
                inputMode="numeric"
                value={s.age || ''}
                onChange={(e) => onChange({ age: parseInt(e.target.value) || undefined })}
              />
            </Field>
            <Field label="Height (cm)">
              <input
                className="input"
                type="number"
                inputMode="numeric"
                value={s.heightCm || ''}
                onChange={(e) => onChange({ heightCm: parseInt(e.target.value) || undefined })}
              />
            </Field>
            <Field label="Gender">
              <select className="input" value={s.gender || ''} onChange={(e) => onChange({ gender: e.target.value as any })}>
                <option value="">Select...</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
            </Field>
            <Field label="Activity Level">
              <select className="input" value={s.activityLevel || ''} onChange={(e) => onChange({ activityLevel: e.target.value as any })}>
                <option value="">Select...</option>
                <option value="sedentary">Sedentary (Little exercise)</option>
                <option value="light">Light (1-3 days/week)</option>
                <option value="moderate">Moderate (3-5 days/week)</option>
                <option value="active">Active (6-7 days/week)</option>
              </select>
            </Field>
            <Field label="Weight Goal">
              <select
                className="input"
                value={s.weightGoal}
                onChange={(e) => handleGoalChange(e.target.value as WeightGoal)}
              >
                <option value="lose">Lose Weight (-500 kcal)</option>
                <option value="maintain">Maintain Weight</option>
                <option value="gain">Gain Weight (+350 kcal)</option>
              </select>
            </Field>

            <div className="full">
              {(() => {
                const sug = getSuggestedCalories(s);
                if (sug) {
                  return (
                    <div className="notice" style={{ marginTop: 8 }}>
                      Suggested intake: <strong>{sug} kcal</strong> to {s.weightGoal} weight.
                      {s.targetWeightDate && (
                        <div>
                          Realistic goal date: <strong>{s.targetWeightDate}</strong>
                        </div>
                      )}
                      <div className="row" style={{ marginTop: 8 }}>
                        <button
                          type="button"
                          className="btn small secondary"
                          onClick={() => onChange({ kcalTarget: sug, ...suggestedMacros })}
                        >
                          Apply Target & Suggested Macros
                        </button>
                      </div>
                    </div>
                  );
                }
                return (
                  <div className="sub" style={{ marginTop: 8 }}>
                    Fill in Age, Height, Gender, and Activity Level to receive tailored target suggestions.
                  </div>
                );
              })()}
            </div>

            <Field label="Voice Language">
              <select className="input" value={s.voiceLang} onChange={(e) => onChange({ voiceLang: e.target.value as any })}>
                <option value="en-MY">English (Malaysia)</option>
                <option value="ms-MY">Bahasa Melayu</option>
              </select>
            </Field>
            <Field label="Currency">
              <select className="input" value={s.currency} onChange={(e) => onChange({ currency: e.target.value })}>
                {['MYR', 'SGD', 'USD', 'IDR', 'THB'].map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            <Field label="Timezone">
              <select className="input" value={s.timezone} onChange={(e) => onChange({ timezone: e.target.value })}>
                {TIMEZONES.map((z) => (
                  <option key={z}>{z}</option>
                ))}
              </select>
            </Field>
            <Field label="Appearance">
              <select className="input" value={s.theme} onChange={(e) => onChange({ theme: e.target.value as Settings['theme'] })}>
                <option value="system">System (Match Device)</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </Field>
          </div>

          <div className="card fields">
            <div className="row between full">
              <span className="label">Daily Nutrition Targets ({s.weightGoal} goal)</span>
              <button
                type="button"
                className="btn small secondary"
                onClick={() => onChange(suggestedMacros)}
              >
                Auto-Fill Macros
              </button>
            </div>
            <IntField label="Calories (kcal)" value={s.kcalTarget} onCommit={(n) => onChange({ kcalTarget: n })} />
            <IntField label="Protein (g)" value={s.proteinTarget} onCommit={(n) => onChange({ proteinTarget: n })} />
            <IntField label="Carbs (g)" value={s.carbsTarget} onCommit={(n) => onChange({ carbsTarget: n })} />
            <IntField label="Fat (g)" value={s.fatTarget} onCommit={(n) => onChange({ fatTarget: n })} />
          </div>

          <button
            className="btn green"
            style={{ marginTop: 8 }}
            onClick={() => {
              setSavedToast(true);
              setTimeout(() => setSavedToast(false), 2500);
            }}
          >
            Save Profile
          </button>
          {savedToast && (
            <div className="notice" style={{ background: 'var(--green-soft)', color: 'var(--green)' }}>
              <strong>Saved:</strong> Your profile targets and weight goals have been updated.
            </div>
          )}
        </>
      )}
      
      {tab === 'budgets' && (
        <div className="card fields">
          <div className="label full">Spending Limits ({s.currency})</div>
          <RMField label="Daily Budget" sen={s.dailyBudgetSen} onCommit={(v) => onChange({ dailyBudgetSen: v })} />
          <RMField label="Monthly Budget" sen={s.monthlyBudgetSen} onCommit={(v) => onChange({ monthlyBudgetSen: v })} />
          <div className="divider full" style={{ margin: '8px 0' }} />
          <div className="label full">Category Budget Selector</div>
          <Field label="Category" full>
            <select className="input" value={selectedCat} onChange={(e) => setSelectedCat(e.target.value as Category)}>
              {CATEGORIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <div className="full">
            <RMField
              label={`Monthly limit for ${selectedCat} (0 = unlimited)`}
              sen={s.categoryBudgetsSen[selectedCat] ?? 0}
              onCommit={(v) => {
                const next = { ...s.categoryBudgetsSen };
                if (v > 0) next[selectedCat] = v;
                else delete next[selectedCat];
                onChange({ categoryBudgetsSen: next });
              }}
            />
          </div>
        </div>
      )}

      {tab === 'data' && <KeysCard />}
      {tab === 'data' && (
        <div className="card stack">
          <span className="label">Multi-Device Sync & Backup</span>
          <div className="sub">Export full backup or import a backup file from another device to sync progress without data loss.</div>

          <div className="row" style={{ gap: 8, marginTop: 4 }}>
            <button className="btn secondary small" onClick={() => exportBackupJSON(state)}>
              Export Full Backup (.json)
            </button>
            <label className="btn secondary small" style={{ margin: 0, cursor: 'pointer', textAlign: 'center' }}>
              Import Backup (.json)
              <input type="file" accept=".json" onChange={handleFileImport} style={{ display: 'none' }} />
            </label>
          </div>

          <button className="btn secondary small" onClick={exportCSV}>
            Export to CSV
          </button>

          {syncStatus && <div className="notice">{syncStatus}</div>}

          <div className="divider" style={{ margin: '12px 0' }} />
          <span className="label">Cloud Database Sync (Supabase)</span>
          <div className="sub">Optional: Connect your free Supabase database (`0001_init.sql`) to automatically sync in real-time.</div>
          <Field label="Supabase Project URL" full>
            <input
              className="input"
              value={s.supabaseUrl || ''}
              onChange={(e) => onChange({ supabaseUrl: e.target.value.trim() })}
              placeholder="https://xyzcompany.supabase.co"
            />
          </Field>
          <Field label="Supabase Anon Key" full>
            <input
              className="input"
              value={s.supabaseAnonKey || ''}
              onChange={(e) => onChange({ supabaseAnonKey: e.target.value.trim() })}
              placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6..."
            />
          </Field>

          <div className="divider" style={{ margin: '12px 0' }} />
          <span className="label">Reset Data</span>
          {!confirm ? (
            <button className="btn danger" onClick={() => setConfirm(true)}>
              Delete all data…
            </button>
          ) : (
            <div className="stack">
              <div className="notice err">This permanently deletes all your saved entries.</div>
              <button
                className="btn danger"
                onClick={() => {
                  onReset();
                  setConfirm(false);
                }}
              >
                Yes, delete everything
              </button>
              <button className="btn secondary" onClick={() => setConfirm(false)}>
                Cancel
              </button>
            </div>
          )}
        </div>
      )}

      <div className="sub" style={{ textAlign: 'center', marginTop: 12 }}>
        <strong>Version 1.7.0</strong>
        <br />
        <span style={{ fontSize: 12 }}>
          <em>What's new: meal-photo scan picks a working Gemini model automatically and shows clear errors.</em>
        </span>
        <br />
        <br />
        Daywell · Apple Health Ready
      </div>
    </div>
  );
}
