// Timezone-aware day/week/month helpers. Records store UTC epoch ms;
// "which day is this?" is always answered in the user's configured timezone.

export const DEFAULT_TZ = 'Asia/Kuala_Lumpur';

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function parts(ts: number, tz: string) {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    });
    fmtCache.set(tz, f);
  }
  const o: Record<string, string> = {};
  for (const p of f.formatToParts(new Date(ts))) o[p.type] = p.value;
  return {
    y: +o.year,
    mo: +o.month,
    d: +o.day,
    h: +o.hour,
    mi: +o.minute,
    s: +o.second,
  };
}

export function dayKey(ts: number, tz: string): string {
  const p = parts(ts, tz);
  return `${p.y}-${String(p.mo).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
}

export function monthKey(ts: number, tz: string): string {
  return dayKey(ts, tz).slice(0, 7);
}

export function hourOf(ts: number, tz: string): number {
  return parts(ts, tz).h;
}

export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

/** Monday of the ISO week containing the given day key. */
export function weekStart(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0=Sun
  const back = (dow + 6) % 7;
  return addDays(key, -back);
}

export function daysInMonth(monthKeyStr: string): number {
  const [y, m] = monthKeyStr.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function offsetMs(ts: number, tz: string): number {
  const p = parts(ts, tz);
  const asUTC = Date.UTC(p.y, p.mo - 1, p.d, p.h, p.mi, p.s);
  return asUTC - Math.floor(ts / 1000) * 1000;
}

/** Convert a wall-clock time in `tz` to epoch ms. */
export function zonedToEpoch(key: string, hour: number, minute: number, tz: string): number {
  const [y, m, d] = key.split('-').map(Number);
  const guess = Date.UTC(y, m - 1, d, hour, minute, 0);
  let ts = guess - offsetMs(guess, tz);
  ts = guess - offsetMs(ts, tz);
  return ts;
}

export function timeLabel(ts: number, tz: string): string {
  return new Intl.DateTimeFormat('en-MY', {
    timeZone: tz,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .format(new Date(ts))
    .replace('am', 'AM')
    .replace('pm', 'PM');
}

export function longDate(ts: number, tz: string): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date(ts));
}

export function dayHeading(key: string, todayKey: string): string {
  if (key === todayKey) return 'Today';
  if (key === addDays(todayKey, -1)) return 'Yesterday';
  const [y, m, d] = key.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(Date.UTC(y, m - 1, d)));
}

/** "YYYY-MM-DD" and "HH:mm" form fields <-> epoch, in tz. */
export function toFormFields(ts: number, tz: string) {
  const p = parts(ts, tz);
  return {
    date: dayKey(ts, tz),
    time: `${String(p.h).padStart(2, '0')}:${String(p.mi).padStart(2, '0')}`,
  };
}

export function fromFormFields(date: string, time: string, tz: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const [h, mi] = time.split(':').map(Number);
  if (h > 23 || mi > 59) return null;
  return zonedToEpoch(date, h, mi, tz);
}
