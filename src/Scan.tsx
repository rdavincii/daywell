import { useRef, useState } from 'react';
import { decodeBarcode } from './lib/barcode';
import { foodToDraft, resolveFood } from './lib/scanDrafts';
import { detectFoods, photoToBase64 } from './lib/vision';
import { getKey } from './lib/keys';
import { lookupBarcode } from './lib/webFood';
import type { Draft, FoodRef } from './lib/types';
import { Sheet } from './ui';

/** Photo scan: a barcode (looked up online) or a meal photo (foods detected by AI, then looked up). Results open in the normal review sheet. */
export function ScanSheet({ now, tz, customFoods, onDrafts, onClose }: { now: number; tz: string; customFoods: FoodRef[]; onDrafts: (d: Draft[]) => void; onClose: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const barRef = useRef<HTMLInputElement>(null);
  const mealRef = useRef<HTMLInputElement>(null);

  async function byCode(c: string) {
    setBusy('Looking up barcode…'); setMsg(null);
    try {
      const f = await lookupBarcode(c);
      if (!f) setMsg('That barcode is not in Open Food Facts or USDA. Try typing the food name instead.');
      else onDrafts([foodToDraft(f.name, f, 1, now, tz)]);
    } catch (e) {
      setMsg(e instanceof Error && /digits/.test(e.message) ? e.message : "Couldn't reach the food databases. Check your connection and try again.");
    }
    setBusy(null);
  }

  async function barcodePhoto(file?: File) {
    if (!file) return;
    setBusy('Reading barcode…'); setMsg(null);
    const c = await decodeBarcode(file).catch(() => null);
    setBusy(null);
    if (!c) return setMsg("Couldn't read a barcode in that photo. Get closer and keep it sharp, or type the number below.");
    setCode(c);
    await byCode(c);
  }

  async function mealPhoto(file?: File) {
    if (!file) return;
    if (!getKey('gemini')) return setMsg('Meal detection needs a free Google AI (Gemini) key. Add it in Settings → Data → Scan & food databases.');
    setBusy('Finding foods in your photo…'); setMsg(null);
    try {
      const found = await detectFoods(await photoToBase64(file));
      if (!found.length) { setBusy(null); return setMsg("I couldn't see any food in that photo. Try a closer, brighter shot."); }
      setBusy('Looking up macros…');
      const drafts = await Promise.all(found.map(async (d) => foodToDraft(d.name, await resolveFood(d.name, customFoods), d.servings, now, tz)));
      onDrafts(drafts);
    } catch (e) {
      const m = e instanceof Error ? e.message : '';
      setMsg(m === 'BAD_KEY' ? 'Google rejected that key. Check it in Settings → Data.'
        : m === 'RATE_LIMIT' ? 'Google free limit reached. Wait a minute and try again.'
        : m.startsWith('Google said') || m.startsWith('No Gemini') ? m
        : "Couldn't analyse the photo. Check your connection and try again.");
    }
    setBusy(null);
  }

  return (
    <Sheet title="Scan food" onClose={onClose}>
      <div className="stack">
        <input ref={barRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { barcodePhoto(e.target.files?.[0]); e.target.value = ''; }} />
        <input ref={mealRef} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { mealPhoto(e.target.files?.[0]); e.target.value = ''; }} />
        <button className="btn" disabled={!!busy} onClick={() => barRef.current?.click()}>Scan a barcode</button>
        <button className="btn" disabled={!!busy} onClick={() => mealRef.current?.click()}>Scan a meal</button>
        <div className="row">
          <input className="input" inputMode="numeric" aria-label="Barcode number" placeholder="or type the barcode number" value={code} onChange={(e) => setCode(e.target.value)} />
          <button className="btn secondary small" disabled={!!busy || !code.trim()} onClick={() => byCode(code)}>Look up</button>
        </div>
        {busy && <div className="notice" role="status">{busy}</div>}
        {msg && <div className="notice warn" role="alert">{msg}</div>}
        <div className="sub">Photos stay in your browser. Meal photos are sent to Google (your key) to name the foods; barcodes go to Open Food Facts and USDA.</div>
      </div>
    </Sheet>
  );
}
