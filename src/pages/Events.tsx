import React from 'react';
import { format, parseISO, isAfter, subHours, addHours } from 'date-fns';
import { getEvents, getCheckIns, checkIn, type AppUser } from '../lib/api';
import type { Event, CheckIn } from '../types/models';
import { useAuth } from '../state/auth';

function isCheckInOpen(event: Event): boolean {
  const now = new Date();
  const start = parseISO(event.start_at);
  return now >= subHours(start, 2) && now <= addHours(start, 6);
}

function EventCard({ event, user }: { event: Event; user: AppUser | null }) {
  const [checkins, setCheckins] = React.useState<CheckIn[]>([]);
  const [myCheckin, setMyCheckin] = React.useState<CheckIn | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const open = isCheckInOpen(event);

  React.useEffect(() => {
    getCheckIns(event.id).then((rows) => {
      if (Array.isArray(rows)) {
        setCheckins(rows);
        const mine = rows.find((c) => c.user_id === user?.id);
        setMyCheckin(mine ?? null);
      }
    });
  }, [event.id, user?.id]);

  const handleCheckIn = async () => {
    setLoading(true);
    setMsg(null);
    try {
      const res = await checkIn(event.id);
      if ('already_checked_in' in res) {
        setMsg('You are already checked in!');
      } else {
        setMyCheckin(res as CheckIn);
        setMsg('Checked in!');
      }
    } catch (e: unknown) {
      setMsg((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const start = parseISO(event.start_at);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      {/* Date badge + title */}
      <div className="flex items-start gap-3">
        <div className="flex min-w-[48px] flex-col items-center rounded-xl bg-white/10 px-2 py-2 text-center">
          <span className="text-xs font-medium uppercase text-white/60">{format(start, 'MMM')}</span>
          <span className="text-xl font-bold leading-none text-white">{format(start, 'd')}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-white leading-tight">{event.title}</div>
          <div className="mt-0.5 text-xs text-white/60">{format(start, 'EEEE · h:mm a')}</div>
          {event.location_name && (
            <div className="mt-0.5 text-xs text-white/50">📍 {event.location_name}</div>
          )}
          {event.status === 'draft' && (
            <span className="mt-1 inline-block rounded-full bg-yellow-500/20 px-2 py-0.5 text-xs text-yellow-300">
              Draft
            </span>
          )}
        </div>
      </div>

      {event.description ? (
        <p className="mt-3 text-sm text-white/70 leading-relaxed">{event.description}</p>
      ) : null}

      {event.location_address ? (
        <p className="mt-1 text-xs text-white/40">{event.location_address}</p>
      ) : null}

      {/* Check-in area */}
      <div className="mt-4">
        {myCheckin ? (
          <div className="flex items-center gap-2 rounded-xl bg-green-500/15 px-4 py-3">
            <span className="text-base">✓</span>
            <div>
              <div className="text-sm font-medium text-green-300">Checked in</div>
              <div className="text-xs text-green-400/70">
                {format(parseISO(myCheckin.checked_in_at), 'h:mm a')}
              </div>
            </div>
          </div>
        ) : open ? (
          <button
            onClick={handleCheckIn}
            disabled={loading}
            className="w-full rounded-xl bg-white py-3 text-sm font-semibold text-[#0b1220] transition active:scale-95 disabled:opacity-50"
          >
            {loading ? 'Checking in…' : 'Check in'}
          </button>
        ) : (
          <div className="rounded-xl bg-white/5 px-4 py-3 text-center text-xs text-white/40">
            {isAfter(new Date(), addHours(parseISO(event.start_at), 6))
              ? 'Check-in is closed'
              : 'Check-in opens 2 hours before the event'}
          </div>
        )}
        {msg && !myCheckin && (
          <p className="mt-2 text-center text-xs text-white/60">{msg}</p>
        )}
      </div>
    </div>
  );
}

export function EventsPage() {
  const { user } = useAuth();
  const [events, setEvents] = React.useState<Event[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    getEvents().then((rows) => {
      setEvents(rows);
      setLoading(false);
    });
  }, []);

  const upcoming = events.filter((e) =>
    isAfter(addHours(parseISO(e.start_at), 6), new Date())
  );
  const past = events.filter(
    (e) => !isAfter(addHours(parseISO(e.start_at), 6), new Date())
  );

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-sm text-white/50">
        Loading events…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-base font-semibold text-white">Upcoming Events</h1>

      {upcoming.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-sm text-white/50">
          No upcoming events right now. Check back soon!
        </div>
      ) : (
        <div className="space-y-3">
          {upcoming.map((e) => (
            <EventCard key={e.id} event={e} user={user} />
          ))}
        </div>
      )}

      {past.length > 0 && (
        <>
          <h2 className="pt-2 text-sm font-medium text-white/50">Past events</h2>
          <div className="space-y-3">
            {past.map((e) => (
              <EventCard key={e.id} event={e} user={user} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
