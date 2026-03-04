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
