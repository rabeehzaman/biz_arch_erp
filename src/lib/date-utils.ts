/**
 * Normalize a date to midnight UTC, effectively making it a date-only value.
 * ERP accounting dates (invoice dates, stock dates, etc.) should never have
 * time components — this prevents FIFO filtering bugs where lot timestamps
 * don't match invoice dates.
 */
export function toMidnightUTC(date?: Date | string): Date {
  const d = date
    ? (typeof date === 'string' ? new Date(date) : new Date(date.getTime()))
    : new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Format a local Date as YYYY-MM-DD (avoids UTC shift from toISOString). */
export function localDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** First day of the current month as YYYY-MM-DD string. */
export function firstOfMonth(): string {
  const now = new Date();
  return localDateStr(new Date(now.getFullYear(), now.getMonth(), 1));
}

/** Last day of the current month as YYYY-MM-DD string. */
export function lastOfMonth(): string {
  const now = new Date();
  return localDateStr(new Date(now.getFullYear(), now.getMonth() + 1, 0));
}

/** First day of the current year as YYYY-MM-DD string. */
export function firstOfYear(): string {
  return localDateStr(new Date(new Date().getFullYear(), 0, 1));
}

/** Today as YYYY-MM-DD string in local time. */
export function todayStr(): string {
  return localDateStr(new Date());
}
