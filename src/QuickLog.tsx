import { useEffect, useMemo, useRef, useState } from 'react';
import { FOODS, foodByKey, scaleNutrition, suggestFoods } from './lib/foods';
import { useFoodSuggestions } from './foodSearch';
import { formatRM, parseToSen, senToInput } from './lib/money';
import { parseQuickLog } from './lib/parser';
import { newId } from './lib/store';
import { fromFormFields, toFormFields } from './lib/time';
import { CATEGORIES, MEAL_TYPES } from './lib/types';
import type { Category, Draft, InputSource, MealType, Portion, FoodRef } from './lib/types';
import { Field, Icons, Segmented, Sheet } from './ui';
import { usePresence } from './motion';
import { ScanSheet } from './Scan';

interface Props {
  now: number;
  tz: string;
  onCommit: (drafts: Draft[], key: string, meta: { source: InputSource; transcript?: string }) => void;
}

type SpeechRec = {
  lang: string; interimResults: boolean; continuous: boolean;
  start(): void; stop(): void; abort(): void;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function getSR(): (new () => SpeechRec) | null {
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition || w.webkitSpeechRecognition || null) as (new () => SpeechRec) | null;
}

function blankDraft(now: number, text = ''): Draft {
  return { draftId: newId(), text, item: text, expense: { amountSen: 0, category: 'Food & Drinks' }, meal: null, ts: now, tsInferred: true, warnings: [] };
}


interface EnhancedProps extends Props {
  lang: 'en-MY' | 'ms-MY';
  suggestions?: string[];
  draftText: string;
  setDraftText: (t: string) => void;
  customFoods: FoodRef[];
}

export function QuickLog({ now, tz, onCommit, lang = 'en-MY', suggestions = [], draftText, setDraftText, customFoods }: EnhancedProps) {
  
  const [fromVoice, setFromVoice] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceMsg, setVoiceMsg] = useState<string | null>(null);
  const [needAck, setNeedAck] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [review, setReview] = useState<null | { drafts: Draft[]; key: string; source: InputSource; transcript?: string; empty?: boolean }>(null);
  const rec = useRef<SpeechRec | null>(null);
  const shownReview = usePresence(review, 240); // keeps the sheet mounted while it slides out

  useEffect(() => () => { rec.current?.abort(); }, []);

  // Suggest foods for the last 1-3 words being typed (not a price), best match wins.
  const { tail, tailLen } = useMemo(() => {
    const words = draftText.trimEnd().split(/\s+/);
    if (!draftText.trim() || /\d/.test(words[words.length - 1]) || draftText.endsWith(' ')) return { tail: [] as FoodRef[], tailLen: 0 };
    const all = [...customFoods, ...FOODS];
    for (const n of [3, 2, 1]) {
      if (words.length < n) continue;
      const frag = words.slice(-n).join(' ');
      const hits = suggestFoods(frag, all, 3).filter((h) => h.food.name.toLowerCase() !== frag.toLowerCase());
      if (hits.length) return { tail: hits.map((h) => h.food), tailLen: frag.length };
    }
    return { tail: [] as FoodRef[], tailLen: 0 };
  }, [draftText, customFoods]);

  function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const t = draftText.trim();
    if (!t) return;
    const drafts = parseQuickLog(t, { now, tz, customFoods });
    setReview({ drafts, key: newId(), source: fromVoice ? 'voice' : 'text', transcript: t, empty: drafts.length === 0 });
  }

  function startListening() {
    const SR = getSR();
    if (!SR) {
      setVoiceMsg("Voice input is not supported in this browser. Please type or use Chrome/Safari.");
      return;
    }
    let ack = false;
    try { ack = localStorage.getItem('daywell:voiceAck') === '1'; } catch { /* private mode */ }
    if (!ack) { setNeedAck(true); return; }
    
    setNeedAck(false);
    setVoiceMsg(null);
    try {
      rec.current?.abort();
      const r = new SR();
      r.lang = lang;
      r.interimResults = true;
      r.continuous = false;

      r.onresult = (ev) => {
        let full = '';
        for (let i = 0; i < ev.results.length; i++) {
          full += ev.results[i][0].transcript;
        }
        if (full.trim()) {
          setDraftText(full.trim());
          setFromVoice(true);
        }
      };

      r.onerror = (ev) => {
        if (ev.error === 'not-allowed' || ev.error === 'service-not-allowed') {
          setVoiceMsg('Microphone permission was denied. Please allow microphone access in your browser settings.');
        } else if (ev.error === 'no-speech') {
          setVoiceMsg("No speech detected. Tap the microphone and try again.");
        } else if (ev.error === 'network') {
          setVoiceMsg('Network issue during voice recognition. Type instead for now.');
        } else if (ev.error !== 'aborted') {
          setVoiceMsg(`Voice error (${ev.error}). You can type your entry instead.`);
        }
        setListening(false);
      };

      r.onend = () => setListening(false);
      rec.current = r;
      r.start();
      setListening(true);
    } catch {
      setVoiceMsg('Could not initialize microphone. Please type instead.');
      setListening(false);
    }
  }

  function toggleMic() {
    if (listening) {
      rec.current?.stop();
      setListening(false);
      return;
    }
    startListening();
  }

  function ackAndStart() {
    try { localStorage.setItem('daywell:voiceAck', '1'); } catch { /* ignore */ }
    setNeedAck(false);
    startListening();
  }

  return (
    <div className="quick">
      <form className="quick-input" onSubmit={submit}>
        <input
          value={draftText}
          onChange={(e) => { setDraftText(e.target.value); setFromVoice(false); }}
          placeholder="Tell me what you bought or ate..."
          aria-label="Quick log"
          enterKeyHint="done"
          autoComplete="off"
          maxLength={500}
        />
        <button
          type="button"
          className={'icon-btn' + (listening ? ' rec' : '')}
          onClick={toggleMic}
          aria-label={listening ? 'Stop recording' : 'Speak your entry'}
        >
          {listening ? Icons.stop : Icons.mic}
        </button>
        <button type="submit" className="btn" disabled={!draftText.trim()}>Log</button>
      </form>
      {tail.length > 0 && (
        <div className="sug-scroll" aria-label="Food suggestions">
          {tail.map((f) => (
            <button key={f.key} type="button" className="sug-chip" onClick={() => setDraftText(draftText.slice(0, draftText.length - tailLen) + f.name + ' ')}>{f.name}</button>
          ))}
        </div>
      )}
      <div className="row between">
        {suggestions.length > 0 && !listening && !draftText ? (
          <div className="sug-scroll">
            {suggestions.map((s) => (
              <button key={s} type="button" className="sug-chip" onClick={() => { setDraftText(s + ' RM'); setFromVoice(false); }}>
                {s}
              </button>
            ))}
          </div>
        ) : <div />}
        <button type="button" className="btn secondary small" style={{ flexShrink: 0 }} onClick={() => setScanning(true)}>Scan</button>
        <button
          type="button"
          className="btn secondary small"
          style={{ flexShrink: 0 }}
          onClick={() => setReview({ drafts: [{ ...blankDraft(now), item: draftText, text: draftText }], key: newId(), source: 'manual' })}
        >
          Add manually
        </button>
      </div>
      {listening && <div className="notice" role="status">Listening… speak now, then review above.</div>}
      {needAck && (
        <div className="notice warn" role="alert">
          <strong>Voice Privacy:</strong> Your browser turns speech into text using its native system service. Audio is never stored.
          <div className="row" style={{ marginTop: 8 }}>
            <button type="button" className="btn small" onClick={ackAndStart}>Continue</button>
            <button type="button" className="btn secondary small" onClick={() => setNeedAck(false)}>Cancel</button>
          </div>
        </div>
      )}
      {voiceMsg && <div className="notice err" role="alert">{voiceMsg}</div>}
      {scanning && (
        <ScanSheet now={now} tz={tz} customFoods={customFoods} onClose={() => setScanning(false)}
          onDrafts={(drafts) => { setScanning(false); setReview({ drafts, key: newId(), source: 'manual' }); }} />
      )}
      {shownReview.value && (
        <ReviewSheet
          key={shownReview.value.key}
          closing={shownReview.exiting}
          initial={shownReview.value.drafts}
          empty={shownReview.value.empty}
          tz={tz}
          now={now}
          customFoods={customFoods}
          onClose={() => setReview(null)}
          onSave={(drafts) => {
            const r = shownReview.value!;
            onCommit(drafts, r.key, { source: r.source, transcript: r.transcript });
            setReview(null);
            setDraftText('');
            setFromVoice(false);
          }}
        />
      )}
    </div>
  );
}

function ReviewSheet({ initial, empty, tz, now, customFoods, closing, onClose, onSave }: { initial: Draft[]; empty?: boolean; tz: string; now: number; customFoods: FoodRef[]; closing: boolean; onClose: () => void; onSave: (d: Draft[]) => void }) {
  const [drafts, setDrafts] = useState<Draft[]>(initial);
  const [error, setError] = useState<string | null>(null);
  const set = (i: number, d: Draft) => setDrafts((all) => all.map((x, j) => (j === i ? d : x)));

  function getHealthReview() {
    let p = 0, c = 0, f = 0, k = 0;
    drafts.forEach(d => {
      if (d.meal && d.meal.eaten) {
        p += d.meal.proteinG || 0; c += d.meal.carbsG || 0; f += d.meal.fatG || 0; k += d.meal.kcal || 0;
      }
    });
    if (k === 0) return null;
    let msg = "Balanced meal.";
    if (p >= 25) msg = "Great high-protein meal! 💪";
    if (f >= 30) msg = "A bit high in fat, watch your daily limit. ⚠️";
    if (c >= 80) msg = "High carbohydrate content, good for energy! ⚡";
    if (k >= 800) msg = "Heavy meal, high in calories. 🍔";
    return { msg };
  }

  const health = getHealthReview();

  function save() {
    const kept = drafts.filter((d) => d.expense || (d.meal && d.meal.eaten));
    if (!kept.length) { setError('Nothing to save yet. Add a price, or tick "I ate this".'); return; }
    for (const d of kept) {
      if (d.expense && !(d.expense.amountSen > 0)) { setError('Enter a price greater than RM0.00, or remove the price.'); return; }
      if (!d.item.trim() && !(d.meal?.foodName.trim())) { setError('Give each entry a name.'); return; }
    }
    setError(null);
    onSave(kept);
  }

  return (
    <Sheet title="Review before saving" onClose={onClose} closing={closing}>
      <div className="stack">
        {health && (
           <div className="notice health-notice" style={{ background: 'var(--green-soft)', color: 'var(--green)' }}>
             <strong>Health Check:</strong> {health.msg}
           </div>
        )}
        {empty && drafts.length === 0 && (
          <div className="notice warn">I couldn't find a price or a food in that. Add the details below.</div>
        )}
        {drafts.map((d, i) => (
          <DraftEditor key={d.draftId} d={d} tz={tz} customFoods={customFoods} onChange={(x) => set(i, x)} onRemove={() => setDrafts((all) => all.filter((_, j) => j !== i))} />
        ))}
        <button className="btn secondary" onClick={() => {
           const lastItem = drafts[drafts.length - 1]?.item || '';
           setDrafts((all) => [...all, { ...blankDraft(now), item: lastItem }]);
        }}>+ Add another entry</button>
        {error && <div className="notice err" role="alert">{error}</div>}
        <button className="btn" onClick={save}>Save {drafts.length > 1 ? 'all' : ''}</button>
      </div>
    </Sheet>
  );
}

function DraftEditor({ d, tz, customFoods, onChange, onRemove }: { d: Draft; tz: string; customFoods: FoodRef[]; onChange: (d: Draft) => void; onRemove: () => void }) {
  const [amountText, setAmountText] = useState(d.expense && d.expense.amountSen > 0 ? senToInput(d.expense.amountSen) : '');
  const [kcalText, setKcalText] = useState(d.meal?.kcal != null ? String(d.meal.kcal) : '');
  const when = toFormFields(d.ts, tz);

  function setAmount(v: string) {
    setAmountText(v);
    const sen = parseToSen(v);
    onChange({ ...d, expense: d.expense ? { ...d.expense, amountSen: sen ?? 0 } : d.expense });
  }
  function rescale(portion: Portion, quantity: number) {
    if (!d.meal) return;
    const food = d.meal.baseKey ? foodByKey(d.meal.baseKey, customFoods) : undefined;
    if (food) {
      const n = scaleNutrition(food, quantity, portion);
      setKcalText(String(n.kcal));
      onChange({ ...d, meal: { ...d.meal, portion, quantity, kcal: n.kcal, proteinG: n.proteinG, carbsG: n.carbsG, fatG: n.fatG } });
    } else onChange({ ...d, meal: { ...d.meal, portion, quantity } });
  }
  function setKcal(v: string) {
    setKcalText(v);
    if (!d.meal) return;
    const n = v.trim() === '' ? null : Math.max(0, Math.round(Number(v)));
    onChange({ ...d, meal: { ...d.meal, kcal: n !== null && Number.isFinite(n) ? n : null, nutritionSource: 'manual', confidence: 'high', note: 'Edited by you.' } });
  }
  function setWhen(date: string, time: string) {
    const ts = fromFormFields(date, time, tz);
    if (ts !== null) onChange({ ...d, ts, tsInferred: false });
  }
  function addMeal() {
    onChange({ ...d, meal: { eaten: true, foodName: d.item, servingLabel: '1 serving', quantity: 1, portion: 'regular', kcal: null, proteinG: null, carbsG: null, fatG: null, nutritionSource: 'unknown', confidence: 'none', mealType: 'Lunch' } });
  }

  function applyFood(f: FoodRef) {
    const qty = d.meal?.quantity || 1;
    const portion = d.meal?.portion || 'regular';
    const n = scaleNutrition(f, qty, portion);
    setKcalText(String(n.kcal));
    onChange({
      ...d,
      item: f.name,
      meal: {
        ...(d.meal || {
          eaten: true, mealType: 'Lunch', confidence: 'none'
        }),
        foodName: f.name,
        servingLabel: f.serving,
        quantity: qty,
        portion,
        kcal: n.kcal,
        proteinG: n.proteinG,
        carbsG: n.carbsG,
        fatG: n.fatG,
        baseKey: f.key,
        nutritionSource: f.source === 'web' ? 'web' : 'reference-estimate',
        confidence: f.source === 'web' ? 'medium' : 'high',
        note: f.note ?? `Approximate: typically ${f.kcalLow}-${f.kcalHigh} kcal per serving.`
      } as Draft['meal']
    });
  }

  // Once a food is applied and the name is untouched, stop suggesting; editing the name suggests again.
  const applied = !!d.meal && d.meal.nutritionSource !== 'unknown' && d.item === d.meal.foodName;
  const sug = useFoodSuggestions(applied ? '' : d.item, customFoods);
  const top = sug.local[0]?.score >= 0.85 ? sug.local[0].food : sug.web[0];
  useEffect(() => {
    if (top && d.meal?.eaten && d.meal.nutritionSource === 'unknown' && !applied) applyFood(top);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [top?.key, applied]);

  return (
    <div className="card stack">
      <div className="row between">
        <span className="label">{d.text ? '“' + d.text + '”' : 'Manual entry'}</span>
        <button className="btn danger small" onClick={onRemove} aria-label="Remove this entry">Remove</button>
      </div>
      {d.warnings.map((w) => <div key={w} className="notice warn">{w}</div>)}
      <div className="fields">
        <div className="full">
          <Field label="Item" full>
            <div className="row">
              <input className="input" value={d.item} onChange={(e) => onChange({ ...d, item: e.target.value, meal: d.meal && d.meal.nutritionSource === 'unknown' ? { ...d.meal, foodName: e.target.value } : d.meal })} placeholder="e.g. Nasi lemak" />
              {!applied && d.item.trim().length >= 3 && (
                <button type="button" className="btn small secondary" style={{ minWidth: 100 }} onClick={sug.searchOnline} disabled={sug.status === 'searching'}>
                  {sug.status === 'searching' ? 'Searching…' : 'Search online'}
                </button>
              )}
            </div>
          </Field>
          {(sug.local.length > 0 || sug.web.length > 0) && (
            <div className="sug-scroll" style={{ marginTop: 8 }}>
              {sug.local.map(({ food: f }) => (
                <button key={f.key} type="button" className="sug-chip" onClick={() => applyFood(f)}>{f.name}</button>
              ))}
              {sug.web.map((f) => (
                <button key={f.key} type="button" className="sug-chip" onClick={() => applyFood(f)} style={{ background: 'var(--blue-soft)', color: 'var(--blue)' }}>{f.name}</button>
              ))}
            </div>
          )}
          {!applied && sug.status === 'searching' && <div className="sub" role="status">Searching online for macros…</div>}
          {!applied && sug.status === 'error' && <div className="sub" role="status">Couldn't reach the food database. Check your connection and tap Search online.</div>}
          {!applied && sug.status === 'done' && sug.web.length === 0 && <div className="sub" role="status">No close match online. Enter calories yourself.</div>}
        </div>
        {d.expense ? (
          <>
            <Field label="Price (RM)">
              <input className="input" inputMode="decimal" value={amountText} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" />
            </Field>
            <Field label="Category">
              <select className="input" value={d.expense.category} onChange={(e) => onChange({ ...d, expense: { ...d.expense!, category: e.target.value as Category } })}>
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
          </>
        ) : (
          <div className="full"><button className="btn secondary small" onClick={() => onChange({ ...d, expense: { amountSen: 0, category: 'Food & Drinks' } })}>+ Add a price</button></div>
        )}
        <Field label="Date">
          <input className="input" type="date" value={when.date} onChange={(e) => setWhen(e.target.value, when.time)} />
        </Field>
        <Field label="Time">
          <input className="input" type="time" value={when.time} onChange={(e) => setWhen(when.date, e.target.value)} />
        </Field>
      </div>
      {d.tsInferred && <div className="sub">Date and time default to now because you didn't say.</div>}

      {d.meal ? (
        <>
          <div className="divider" />
          <label className="switch">
            <span><strong>I ate this</strong><br /><span className="sub">Only eaten food counts toward calories.</span></span>
            <input type="checkbox" role="switch" checked={d.meal.eaten} onChange={(e) => onChange({ ...d, meal: { ...d.meal!, eaten: e.target.checked } })} />
          </label>
          {d.meal.eaten && (
            <div className="stack">
              <div className="fields">
                <Field label="Meal">
                  <select className="input" value={d.meal.mealType} onChange={(e) => onChange({ ...d, meal: { ...d.meal!, mealType: e.target.value as MealType } })}>
                    {MEAL_TYPES.map((m) => <option key={m}>{m}</option>)}
                  </select>
                </Field>
                <Field label="Calories (kcal)">
                  <input className="input" inputMode="numeric" value={kcalText} onChange={(e) => setKcal(e.target.value)} placeholder="Unknown" />
                </Field>
                <Field label="Quantity">
                  <input className="input" inputMode="decimal" value={d.meal.quantity} onChange={(e) => { const q = parseFloat(e.target.value); if (q > 0 && q <= 20) rescale(d.meal!.portion, q); }} />
                </Field>
                <Field label="Portion">
                  <Segmented label="Portion" value={d.meal.portion} options={['small', 'regular', 'large'] as const} onChange={(p) => rescale(p, d.meal!.quantity)} />
                </Field>
              </div>
              <div className="sub">
                {d.meal.kcal === null ? 'No calorie data for this food. Enter calories or leave blank.' : <>Estimate for {d.meal.servingLabel}{d.meal.baseKey ? ' (approximate, not verified)' : ''}. {d.meal.note}</>}
                {d.meal.proteinG !== null && <> Protein {d.meal.proteinG} g · Carbs {d.meal.carbsG} g · Fat {d.meal.fatG} g.</>}
              </div>
            </div>
          )}
        </>
      ) : d.expense && d.expense.category === 'Food & Drinks' ? (
        <button className="btn secondary small" onClick={addMeal}>+ I ate this (add calories)</button>
      ) : null}
      {d.expense && d.expense.amountSen > 0 && <div className="sub">Will record {formatRM(d.expense.amountSen)} under {d.expense.category}{d.meal?.eaten ? ' and link the meal to it' : ''}.</div>}
    </div>
  );
}
