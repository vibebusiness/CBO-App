import React from 'react';
import { useRoute, useLocation } from 'wouter';
import { format, parseISO, isAfter, subHours, addHours } from 'date-fns';
import { getEvent, getCheckIns, checkIn } from '../lib/api';
import type { Event, CheckIn } from '../types/models';
import { useAuth } from '../state/auth';

function isCheckInOpen(event: Event): boolean {
  const now = new Date();
  const start = parseISO(event.start_at);
  return now >= subHours(start, 2) && now <= addHours(start, 6);
}

export function EventDetailPage() {
  const [, params] = useRoute('/events/:id');
  const [, navigate] = useLocation();
  const { user } = useAuth();

  const [event, setEvent] = React.useState<Event | null>(null);
  const [myCheckin, setMyCheckin] = React.useState<CheckIn | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [checkingIn, setCheckingIn] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [notFound, setNotFound] = React.useState(false);

  const id = params?.id;

  React.useEffect(() => {
    if (!id) return;
    Promise.all([getEvent(id), getCheckIns(id)])
      .then(([ev, rows]) => {
        setEvent(ev);
        if (Array.isArray(rows)) {
          const mine = rows.find((c) => c.user_id === user?.id);
          setMyCheckin(mine ?? null);
        }
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id, user?.id]);

  const handleCheckIn = async () => {
    if (!id) return;
    setCheckingIn(true);
    setMsg(null);
    try {
      const res = await checkIn(id);
      if ('already_checked_in' in res) {
        setMsg('You are already checked in!');
      } else {
        setMyCheckin(res as CheckIn);
      }
    } catch (e: unknown) {
      setMsg((e as Error).message);
    } finally {
      setCheckingIn(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-sm text-slate-400">Loading…</div>
      </div>
    );
  }

  if (notFound || !event) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <div className="text-sm text-slate-500">Event not found</div>
        <button onClick={() => navigate('/events')} className="text-sm text-slate-900 underline">
          Back to events
        </button>
      </div>
    );
  }

  const start = parseISO(event.start_at);
  const open = isCheckInOpen(event);

  return (
    <div>
      {/* Back button */}
      <button
        onClick={() => window.history.back()}
        className="mb-4 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
      >
        ← Back
      </button>

      {/* Event image */}
      {event.image_url && (
        <div className="mb-4 overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
          <img
            src={event.image_url}
            alt={event.title}
            className="h-52 w-full object-cover"
          />
        </div>
      )}

      {/* Title + meta */}
      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-xl font-bold text-slate-900">{event.title}</h1>

        {event.status === 'draft' && (
          <span className="mt-1 inline-block rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
            Draft
          </span>
        )}

        <div className="mt-4 space-y-2.5">
          {/* Date & time */}
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm">
              📅
            </div>
            <div>
              <div className="text-sm font-medium text-slate-900">
                {format(start, 'EEEE, MMMM d, yyyy')}
              </div>
              <div className="text-xs text-slate-500">
                {format(start, 'h:mm a')}
                {event.end_at && ` – ${format(parseISO(event.end_at), 'h:mm a')}`}
              </div>
            </div>
          </div>

          {/* Location */}
          {event.location_name && (
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm">
                📍
              </div>
              <div>
                <div className="text-sm font-medium text-slate-900">{event.location_name}</div>
                {event.location_address && (
                  <div className="text-xs text-slate-500">{event.location_address}</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      {event.description && (
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">About this event</h2>
          <p className="text-sm leading-relaxed text-slate-700">{event.description}</p>
        </div>
      )}

      {/* Check-in */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {myCheckin ? (
          <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 text-lg">
              ✓
            </div>
            <div>
              <div className="font-medium text-green-700">You're checked in!</div>
              <div className="text-xs text-green-600/70">
                Checked in at {format(parseISO(myCheckin.checked_in_at), 'h:mm a')}
              </div>
            </div>
          </div>
        ) : open ? (
          <>
            <p className="mb-3 text-sm text-slate-600">Ready to check in to this event?</p>
            <button
              onClick={handleCheckIn}
              disabled={checkingIn}
              className="w-full rounded-xl bg-slate-900 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-700 active:scale-95 disabled:opacity-50"
            >
              {checkingIn ? 'Checking in…' : 'Check in now'}
            </button>
          </>
        ) : (
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-4 text-center text-sm text-slate-400">
            {isAfter(new Date(), addHours(parseISO(event.start_at), 6))
              ? 'Check-in is closed for this event'
              : `Check-in opens 2 hours before the event starts`}
          </div>
        )}
        {msg && !myCheckin && (
          <p className="mt-2 text-center text-xs text-slate-500">{msg}</p>
        )}
      </div>
    </div>
  );
}
