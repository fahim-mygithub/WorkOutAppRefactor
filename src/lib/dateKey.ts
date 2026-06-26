/**
 * Canonical LOCAL date keys ('YYYY-MM-DD') for the planned-schedule layer. We
 * never use toISOString() (UTC) for keys — it shifts the day for negative offsets.
 * All slot↔date math normalizes to local midnight (mirrors statsCalculator's
 * setHours(0,0,0,0)) so a DST transition can't slide the rotation by a day.
 */
export type DateKey = string;

export function toDateKey(date: Date): DateKey {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function dateKeyToDate(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d); // local midnight
}

export function daysBetweenKeys(from: DateKey, to: DateKey): number {
  const ms = dateKeyToDate(to).getTime() - dateKeyToDate(from).getTime();
  return Math.round(ms / 86_400_000);
}

export function addDaysKey(key: DateKey, days: number): DateKey {
  const d = dateKeyToDate(key);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

export function firstOfMonthKey(date: Date): DateKey {
  return toDateKey(new Date(date.getFullYear(), date.getMonth(), 1));
}

export function lastOfMonthKey(date: Date): DateKey {
  return toDateKey(new Date(date.getFullYear(), date.getMonth() + 1, 0));
}

/** Max of two date keys (lexicographic works for zero-padded YYYY-MM-DD). */
export function maxKey(a: DateKey | null, b: DateKey): DateKey {
  return a && a > b ? a : b;
}
