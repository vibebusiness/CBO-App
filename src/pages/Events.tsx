import React from 'react';
import { isAfter, addHours } from 'date-fns';
import { Link } from 'wouter';
import { getEvents } from '../lib/api';
import type { Event } from '../types/models';
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
            <p className="mt-3 line-clamp-2 text-sm text-slate-500">{event.description}</p>
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

  React.useEffect(() => {
    getEvents().then((rows) => {
      setEvents(rows);
      setLoading(false);
    });
  }, []);

  const upcoming = events.filter((e) => isAfter(addHours(new Date(e.start_at), 6), new Date()));
  const past = events.filter((e) => !isAfter(addHours(new Date(e.start_at), 6), new Date()));

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-400 shadow-sm">
        Loading events…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-base font-semibold text-slate-900">Upcoming Events</h1>

      {upcoming.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-400 shadow-sm">
          No upcoming events right now. Check back soon!
        </div>
      ) : (
        <div className="space-y-3">
          {upcoming.map((e) => <EventCard key={e.id} event={e} />)}
        </div>
      )}

      {past.length > 0 && (
        <>
          <h2 className="pt-2 text-sm font-medium text-slate-400">Past events</h2>
          <div className="space-y-3">
            {past.map((e) => <EventCard key={e.id} event={e} />)}
          </div>
        </>
      )}
    </div>
  );
}
