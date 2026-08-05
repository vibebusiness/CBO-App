import { compareAsc, compareDesc, isBefore, isSameDay } from 'date-fns';
import type { Event } from '../types/models';
import { toET } from './tz';

const MAX_VISIBLE_EVENTS = 3;

export function selectEventFeed(events: Event[], now = new Date()) {
  const todayET = toET(now);
  const byStartAscending = (a: Event, b: Event) =>
    compareAsc(new Date(a.start_at), new Date(b.start_at));
  const byStartDescending = (a: Event, b: Event) =>
    compareDesc(new Date(a.start_at), new Date(b.start_at));

  const today = events
    .filter((event) => isSameDay(toET(event.start_at), todayET))
    .sort(byStartAscending)
    .slice(0, 1);

  const past = events
    .filter((event) => isBefore(toET(event.start_at), todayET) && !isSameDay(toET(event.start_at), todayET))
    .sort(byStartDescending)
    .slice(0, MAX_VISIBLE_EVENTS - today.length);

  return { today, past };
}
