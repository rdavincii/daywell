// All money is stored as integer sen (1 RM = 100 sen) so sums never drift.

export function formatRM(sen: number, currency = 'MYR'): string {
  const negative = sen < 0;
  const abs = Math.abs(Math.round(sen));
  const whole = Math.trunc(abs / 100);
  const cents = String(abs % 100).padStart(2, '0');
  const grouped = new Intl.NumberFormat('en-MY').format(whole);
  const symbol = currency === 'MYR' ? 'RM' : currency + ' ';
  return `${negative ? '-' : ''}${symbol}${grouped}.${cents}`;
}

/** Parse "5", "5.5", "3.50", "1,200.00" into sen without floating-point maths. Returns null if invalid. */
export function parseToSen(input: string): number | null {
  const cleaned = input.trim().replace(/^(rm|myr)\s*/i, '').replace(/,(?=\d{3}(\D|$))/g, '');
  const m = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(cleaned);
  if (!m) return null;
  const whole = parseInt(m[1], 10);
  const frac = m[2] ? parseInt(m[2].padEnd(2, '0'), 10) : 0;
  const sen = whole * 100 + frac;
  return Number.isSafeInteger(sen) ? sen : null;
}

/** Format sen as an editable plain string, e.g. 350 -> "3.50". */
export function senToInput(sen: number): string {
  const abs = Math.abs(sen);
  return `${sen < 0 ? '-' : ''}${Math.trunc(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}
