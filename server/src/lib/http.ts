import { Response } from 'express';
import crypto from 'crypto';

/** Sends a uniform JSON error response used across the API. */
export function fail(res: Response, status: number, message: string): void {
  res.status(status).json({ error: { message, status } });
}

/** YYYY-MM-DD (UTC) */
export function ymd(d: Date): string {
  return d.toISOString().split('T')[0];
}

/** Parses YYYY-MM-DD as a UTC date (no timezone drift). */
export function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Number of working days (Mon–Fri) between two dates, inclusive. */
export function countWorkingDays(start: Date, end: Date): number {
  if (end < start) return 0;
  let count = 0;
  const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  while (cur <= last) {
    const day = cur.getUTCDay();
    if (day !== 0 && day !== 6) count++;
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return count;
}

/** Today's date in Asia/Tashkent as a UTC-midnight Date. */
export function todayTashkent(): Date {
  const s = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tashkent' }).format(new Date());
  return parseYmd(s);
}

/** Readable temporary password, e.g. "Amaliyot-7K4Q2M". */
export function generateTempPassword(): string {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  const bytes = crypto.randomBytes(6);
  let out = '';
  for (let i = 0; i < 6; i++) out += chars[bytes[i] % chars.length];
  return `Amaliyot-${out}`;
}
