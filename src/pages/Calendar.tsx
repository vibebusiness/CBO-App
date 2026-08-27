import React from 'react';
import {
  startOfMonth, endOfMonth, eachDayOfInterval,
  isSameMonth, isSameDay, isToday, addMonths, subMonths, getDay,
  isAfter, addHours,
} from 'date-fns';
import { Link } from 'wouter';
import { getEvents } from '../lib/api';
import type { Event } from '../types/models';
import { fmtET, toET } from '../lib/tz';

export function CalendarPage() {
  const [events, setEvents] = React.useState<Event[]>([]);
  const [month, setMonth] = React.useState(new Date());
  const [selected, setSelected] = React.useState<Date | null>(null);

  React.useEffect(() => {
    getEvents().then(setEvents);
  }, []);

  const checkedInIds = React.useMemo(
    () => new Set(events.filter((event) => event.checked_in).map((event) => event.id)),
    [events],
  );

  const days = eachDayOfInterval({ start: startOfMonth(month), end: endOfMonth(month) });
  const startPad = getDay(startOfMonth(month));

  // Compare event dates in ET so events on e.g. 11pm ET March 19 show on March 19, not March 20
  const eventsOnDay = (day: Date) =>
    events.filter((e) => isSameDay(toET(e.start_at), day));

  const selectedEvents = selected ? eventsOnDay(selected) : [];

  return (
    <div className="space-y-4">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setMonth((m) => subMonths(m, 1))}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm hover:bg-slate-50"
        >
          ‹
        </button>
        <span className="text-sm font-semibold text-slate-800">{fmtET(month, 'MMMM yyyy')}</span>
        <button
          onClick={() => setMonth((m) => addMonths(m, 1))}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm hover:bg-slate-50"
        >
          ›
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 text-center">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <div key={d} className="py-1 text-xs font-medium text-slate-400">{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
        {Array.from({ length: startPad }).map((_, i) => <div key={`pad-${i}`} />)}
        {days.map((day) => {
          const dayEvents = eventsOnDay(day);
          const isSelected = selected && isSameDay(day, selected);
          return (
            <button
              key={day.toISOString()}
              onClick={() => setSelected((s) => (s && isSameDay(s, day) ? null : day))}
              className={[
                'relative flex flex-col items-center rounded-xl py-2 text-sm transition',
                isToday(day) ? 'font-bold' : '',
                !isSameMonth(day, month) ? 'opacity-30' : '',
                isSelected
                  ? 'bg-slate-900 text-white'
                  : isToday(day)
                  ? 'text-slate-900'
                  : 'text-slate-600 hover:bg-slate-100',
              ].join(' ')}
            >
              <span>{fmtET(day, 'd')}</span>
              {dayEvents.length > 0 && (
                <span className={['mt-0.5 h-1.5 w-1.5 rounded-full', isSelected ? 'bg-white' : 'bg-orange-400'].join(' ')} />
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day events */}
      {selected && (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            {fmtET(selected, 'EEEE, MMMM d')}
          </h2>
          {selectedEvents.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-400">
              No events on this day
            </div>
          ) : (
            selectedEvents.map((event) => (
              <Link key={event.id} href={`/events/${event.id}`} className="block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md">
                  {event.image_url && (
                    <div className="h-32 w-full overflow-hidden bg-slate-100">
                      <img src={event.image_url} alt={event.title} className="h-full w-full object-cover" />
                    </div>
                  )}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-medium text-slate-900">{event.title}</div>
                        <div className="mt-0.5 text-xs text-slate-500">
                          {fmtET(event.start_at, 'h:mm a')} ET
                          {event.end_at && ` – ${fmtET(event.end_at, 'h:mm a')}`}
                        </div>
                        {event.location_name && (
                          <div className="mt-0.5 text-xs text-slate-400">📍 {event.location_name}</div>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        {checkedInIds.has(event.id) && (
                          <span className="rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs text-green-700">
                            ✓ Checked in
                          </span>
                        )}
                        <span className="text-xs text-slate-400">View →</span>
                      </div>
                    </div>
                    {event.description && (
                      <p className="mt-2 line-clamp-2 text-sm text-slate-500">{event.description.replace(/<[^>]*>/g, '')}</p>
                    )}
                  </div>
              </Link>
            ))
          )}
        </div>
      )}

      {/* Coming up list */}
      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Coming up</h2>
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          {events
            .filter((e) => isAfter(addHours(new Date(e.start_at), 6), new Date()))
            .slice(0, 5)
            .map((event, idx, arr) => (
              <Link key={event.id} href={`/events/${event.id}`} className={[
                  'flex items-center gap-3 px-4 py-3 transition hover:bg-slate-50',
                  idx < arr.length - 1 ? 'border-b border-slate-100' : '',
                ].join(' ')}>
                  {event.image_url ? (
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-slate-100">
                      <img src={event.image_url} alt="" className="h-full w-full object-cover" />
                    </div>
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-base">
                      🎟️
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-900">{event.title}</div>
                    <div className="text-xs text-slate-400">
                      {fmtET(event.start_at, 'MMM d · h:mm a')} ET
                      {event.location_name ? ` · ${event.location_name}` : ''}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    {checkedInIds.has(event.id) && <span className="text-xs text-green-600">✓</span>}
                    <span className="text-xs text-slate-300">›</span>
                  </div>
              </Link>
            ))}
          {events.filter((e) => isAfter(addHours(new Date(e.start_at), 6), new Date())).length === 0 && (
            <div className="px-4 py-4 text-sm text-slate-400">No upcoming events</div>
          )}
        </div>
      </div>
    </div>
  );
}
