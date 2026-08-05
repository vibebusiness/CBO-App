import React from 'react';
import { Link } from 'wouter';
import { getEvents } from '../lib/api';
import type { Event } from '../types/models';
import { selectEventFeed } from '../lib/events';
import { fmtET } from '../lib/tz';

function EventCard({ event }: { event: Event }) {
  return (
    <Link href={`/events/${event.id}`} className="block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md active:scale-[0.99]">
        {/* Event image */}
        {event.image_url ? (
          <div className="h-44 w-full overflow-hidden bg-slate-100">
            <img src={event.image_url} alt={event.title} className="h-full w-full object-cover" />
          </div>
        ) : (
          <div className="flex h-28 w-full items-center justify-center bg-slate-100">
            <span className="text-3xl opacity-30">🎟️</span>
          </div>
        )}

        {/* Content */}
        <div className="p-4">
          <div className="flex items-start gap-3">
            {/* Date badge */}
            <div className="flex min-w-[44px] flex-col items-center rounded-xl bg-slate-100 px-2 py-1.5 text-center">
              <span className="text-[10px] font-semibold uppercase leading-none text-slate-500">
                {fmtET(event.start_at, 'MMM')}
              </span>
              <span className="text-xl font-bold leading-tight text-slate-900">
                {fmtET(event.start_at, 'd')}
              </span>
            </div>

            <div className="min-w-0 flex-1">
              <div className="font-semibold leading-snug text-slate-900">{event.title}</div>
              <div className="mt-0.5 text-xs text-slate-500">
                {fmtET(event.start_at, 'EEEE · h:mm a')} ET
              </div>
              {event.location_name && (
                <div className="mt-0.5 text-xs text-slate-400">📍 {event.location_name}</div>
              )}
            </div>
          </div>

          {/* Description snippet */}
          {event.description && (
            <p className="mt-3 line-clamp-2 text-sm text-slate-500">{event.description.replace(/<[^>]*>/g, '')}</p>
          )}

          {/* CTA */}
          <div className="mt-3 flex items-center justify-between">
            {event.status === 'draft' && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                Draft
              </span>
            )}
            <span className="ml-auto text-xs font-medium text-slate-400">View details →</span>
          </div>
        </div>
    </Link>
  );
}

export function EventsPage() {
  const [events, setEvents] = React.useState<Event[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loadEvents = React.useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const rows = await getEvents();
      setEvents(rows);
    } catch {
      setError('We could not load the events. Please try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void loadEvents();
  }, [loadEvents]);

  const { today, past } = React.useMemo(() => selectEventFeed(events), [events]);

  if (error) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm" role="alert">
        <p className="text-sm text-slate-500">{error}</p>
        <button
          type="button"
          onClick={() => void loadEvents()}
          className="mt-4 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
        >
          Try again
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-400 shadow-sm">
        Loading events…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-base font-semibold text-slate-900">Events</h1>

      {today.length > 0 && (
        <section className="space-y-3" aria-labelledby="today-event-heading">
          <h2 id="today-event-heading" className="text-sm font-medium text-slate-500">Today&apos;s event</h2>
          {today.map((event) => <EventCard key={event.id} event={event} />)}
        </section>
      )}

      {past.length > 0 && (
        <section className="space-y-3" aria-labelledby="past-events-heading">
          <h2 id="past-events-heading" className="pt-2 text-sm font-medium text-slate-400">Past events</h2>
          <div className="space-y-3">
            {past.map((event) => <EventCard key={event.id} event={event} />)}
          </div>
        </section>
      )}

      {today.length === 0 && past.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-400 shadow-sm">
          No current or past events yet.
        </div>
      )}
    </div>
  );
}
