import { compareAsc, compareDesc, isBefore, isSameDay } from 'date-fns';
import type { Event } from '../types/models';
import { toET } from './tz';

const MAX_VISIBLE_EVENTS = 3;

// Event dates use Charlotte time, even when the member is traveling.
export function selectArrivalEvent(events: Event[], now = new Date()): Event | undefined {
  const nowMs = now.getTime();
  return events
    .filter(event => {
      const start = new Date(event.start_at);
      const delta = start.getTime() - nowMs;
      return event.status === 'published'
        && Number.isFinite(delta)
        && isSameDay(toET(start), toET(now))
        && delta <= 60 * 60 * 1000
        && delta >= -6 * 60 * 60 * 1000;
    })
    // When multiple events qualify, prefer the one closest to its start time.
    .sort((a, b) => Math.abs(new Date(a.start_at).getTime() - nowMs)
      - Math.abs(new Date(b.start_at).getTime() - nowMs))[0];
}

export function orderAdminEvents(events: Event[], now = new Date()) {
  const nowMs = now.getTime();

  return [...events].sort((a, b) => {
    const aStart = new Date(a.start_at).getTime();
    const bStart = new Date(b.start_at).getTime();
    const aIsUpcoming = aStart >= nowMs;
    const bIsUpcoming = bStart >= nowMs;

    if (aIsUpcoming !== bIsUpcoming) return aIsUpcoming ? -1 : 1;

    // Upcoming events run nearest-to-farthest; past events run newest-to-oldest.
    return aIsUpcoming ? aStart - bStart : bStart - aStart;
  });
}

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
