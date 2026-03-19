import React from 'react';
import {
  format, parseISO, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameMonth, isSameDay, isToday, addMonths, subMonths, getDay,
  isAfter, addHours,
} from 'date-fns';
import { getEvents, getCheckIns } from '../lib/api';
import type { Event } from '../types/models';
import { useAuth } from '../state/auth';

export function CalendarPage() {
  const { user } = useAuth();
  const [events, setEvents] = React.useState<Event[]>([]);
  const [month, setMonth] = React.useState(new Date());
  const [selected, setSelected] = React.useState<Date | null>(null);
  const [checkedInIds, setCheckedInIds] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    getEvents().then(setEvents);
  }, []);

  // Fetch personal check-ins for all events
  React.useEffect(() => {
    events.forEach(async (e) => {
      try {
        const rows = await getCheckIns(e.id);
        if (Array.isArray(rows)) {
          const mine = rows.find((c) => c.user_id === user?.id);
          if (mine) setCheckedInIds((prev) => new Set([...prev, e.id]));
        }
      } catch { /* ignore */ }
    });
  }, [events, user?.id]);

  const days = eachDayOfInterval({
    start: startOfMonth(month),
    end: endOfMonth(month),
  });

  const startPad = getDay(startOfMonth(month)); // 0=Sun
  const eventsOnDay = (day: Date) =>
    events.filter((e) => isSameDay(parseISO(e.start_at), day));

  const selectedEvents = selected ? eventsOnDay(selected) : [];

  return (
    <div className="space-y-4">
      {/* Month nav */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setMonth((m) => subMonths(m, 1))}
          className="rounded-xl bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10"
        >
          ‹
        </button>
        <span className="text-sm font-semibold text-white">{format(month, 'MMMM yyyy')}</span>
        <button
          onClick={() => setMonth((m) => addMonths(m, 1))}
          className="rounded-xl bg-white/5 px-3 py-2 text-sm text-white hover:bg-white/10"
        >
          ›
        </button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 text-center">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d) => (
          <div key={d} className="py-1 text-xs font-medium text-white/40">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-px rounded-2xl border border-white/10 bg-white/5 p-2">
        {/* Padding cells */}
        {Array.from({ length: startPad }).map((_, i) => (
          <div key={`pad-${i}`} />
        ))}
        {days.map((day) => {
          const dayEvents = eventsOnDay(day);
          const isSelected = selected && isSameDay(day, selected);
          return (
            <button
              key={day.toISOString()}
              onClick={() => setSelected((s) => (s && isSameDay(s, day) ? null : day))}
              className={[
                'relative flex flex-col items-center rounded-xl py-2 text-sm transition',
                isToday(day) ? 'font-bold text-white' : 'text-white/70',
                !isSameMonth(day, month) ? 'opacity-30' : '',
                isSelected ? 'bg-white text-[#0b1220]' : 'hover:bg-white/10',
              ].join(' ')}
            >
              <span>{format(day, 'd')}</span>
              {dayEvents.length > 0 && (
                <span
                  className={[
                    'mt-0.5 h-1.5 w-1.5 rounded-full',
                    isSelected ? 'bg-[#0b1220]' : 'bg-orange-400',
                  ].join(' ')}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day events */}
      {selected && (
        <div className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-white/50">
            {format(selected, 'EEEE, MMMM d')}
          </h2>
          {selectedEvents.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/40">
              No events on this day
            </div>
          ) : (
            selectedEvents.map((event) => (
              <div key={event.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium text-white">{event.title}</div>
                    <div className="mt-0.5 text-xs text-white/60">
                      {format(parseISO(event.start_at), 'h:mm a')}
                      {event.end_at && ` – ${format(parseISO(event.end_at), 'h:mm a')}`}
                    </div>
                    {event.location_name && (
                      <div className="mt-0.5 text-xs text-white/50">📍 {event.location_name}</div>
                    )}
                  </div>
                  {checkedInIds.has(event.id) && (
                    <span className="shrink-0 rounded-full bg-green-500/20 px-2 py-0.5 text-xs text-green-300">
                      ✓ Checked in
                    </span>
                  )}
                </div>
                {event.description ? (
                  <p className="mt-2 text-sm text-white/60">{event.description}</p>
                ) : null}
              </div>
            ))
          )}
        </div>
      )}

      {/* Upcoming list below calendar */}
      <div>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-white/50">
          Coming up
        </h2>
        {events
          .filter((e) => isAfter(addHours(parseISO(e.start_at), 6), new Date()))
          .slice(0, 5)
          .map((event) => (
            <div
              key={event.id}
              className="flex items-center gap-3 border-b border-white/5 py-3 last:border-0"
            >
              <div className="w-10 shrink-0 text-center">
                <div className="text-xs font-medium uppercase text-white/40">
                  {format(parseISO(event.start_at), 'MMM')}
                </div>
                <div className="text-lg font-bold leading-none text-white">
                  {format(parseISO(event.start_at), 'd')}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-white">{event.title}</div>
                <div className="text-xs text-white/50">
                  {format(parseISO(event.start_at), 'h:mm a')}
                  {event.location_name ? ` · ${event.location_name}` : ''}
                </div>
              </div>
              {checkedInIds.has(event.id) && (
                <span className="shrink-0 text-xs text-green-400">✓</span>
              )}
            </div>
          ))}
        {events.filter((e) => isAfter(addHours(parseISO(e.start_at), 6), new Date())).length === 0 && (
          <div className="py-3 text-sm text-white/40">No upcoming events</div>
        )}
      </div>
    </div>
  );
}
