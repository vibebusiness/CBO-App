import { formatInTimeZone, fromZonedTime, toZonedTime } from 'date-fns-tz';

export const ET = 'America/New_York';

/**
 * Format a UTC date string or Date object in Eastern Time.
 * Drop-in replacement for date-fns format() but always renders ET.
 */
export function fmtET(date: Date | string, fmt: string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return formatInTimeZone(d, ET, fmt);
}

/**
 * Convert a datetime-local string (e.g. "2025-03-19T18:00") entered as
 * Eastern Time into a UTC ISO string safe to send to the server.
 */
export function etInputToUtc(localStr: string): string {
  return fromZonedTime(localStr, ET).toISOString();
}

/**
 * Convert a UTC ISO string into a datetime-local string in Eastern Time,
 * for pre-filling <input type="datetime-local"> fields.
 */
export function utcToEtInput(utcStr: string): string {
  // datetime-local needs "YYYY-MM-DDTHH:mm" — slice off seconds/tz
  return formatInTimeZone(new Date(utcStr), ET, "yyyy-MM-dd'T'HH:mm");
}

/**
 * Return a Date object shifted into Eastern Time so date-fns helpers like
 * isSameDay / isToday work correctly against ET calendar days.
 */
export function toET(date: Date | string): Date {
  const d = typeof date === 'string' ? new Date(date) : date;
  return toZonedTime(d, ET);
}
