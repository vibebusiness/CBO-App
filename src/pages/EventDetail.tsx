import React from 'react';
import { useRoute, useLocation, Link } from 'wouter';
import { isAfter, subHours, addHours } from 'date-fns';
import { getEvent, getCheckIns, checkIn, getNetworkingCurrent, getToken, getMyFeedback, submitFeedback, updateProfile } from '../lib/api';
import type { Event, CheckIn, NetworkingCurrent, EventFeedback } from '../types/models';
import { useAuth } from '../state/auth';
import { fmtET } from '../lib/tz';

const PATRICK_GOFUNDME_URL = 'https://www.gofundme.com/f/support-patricks-fight-against-cancer-zupv4';

function isCheckInOpen(event: Event): boolean {
  const now = new Date();
  const start = new Date(event.start_at);
  return now >= subHours(start, 2) && now <= addHours(start, 6);
}

function FeedbackCard({ eventId }: { eventId: string }) {
  const [existing, setExisting] = React.useState<EventFeedback | null | undefined>(undefined);
  const [rating, setRating] = React.useState<number | null>(null);
  const [sizePreference, setSizePreference] = React.useState<'larger' | 'smaller' | null>(null);
  const [oneChange, setOneChange] = React.useState('');
  const [additionalFeedback, setAdditionalFeedback] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);
  const [submitted, setSubmitted] = React.useState(false);

  React.useEffect(() => {
    getMyFeedback(eventId)
      .then(setExisting)
      .catch(() => setExisting(null));
  }, [eventId]);

  const handleSubmit = async () => {
    if (!rating) return;
    setSubmitting(true);
    try {
      await submitFeedback(eventId, {
        enjoyment_rating: rating,
        event_size_preference: sizePreference,
        one_change: oneChange,
        additional_feedback: additionalFeedback,
      });
      setSubmitted(true);
    } catch {
      // silent
    } finally {
      setSubmitting(false);
    }
  };

  if (existing === undefined) return null;

  if (existing || submitted) {
    return (
      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3 rounded-xl border border-purple-200 bg-purple-50 px-4 py-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-purple-100 text-lg">
            💜
          </div>
          <div>
            <div className="font-medium text-purple-700">Thanks for your feedback!</div>
            <div className="text-xs text-purple-500/80">We appreciate you sharing your thoughts.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-sm font-semibold text-slate-900">Share your feedback</h2>
      <p className="mb-4 text-xs text-slate-500">Help us make future events even better.</p>

      {/* Q1: Enjoyment rating */}
      <div className="mb-5">
        <p className="mb-2.5 text-sm font-medium text-slate-700">
          On a scale of 1–10, how much did you enjoy this event?
        </p>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
            <button
              key={n}
              onClick={() => setRating(n)}
              className={[
                'flex h-9 flex-1 items-center justify-center rounded-lg text-sm font-semibold transition',
                rating === n
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100',
              ].join(' ')}
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Q2: Event size preference */}
      <div className="mb-5">
        <p className="mb-2.5 text-sm font-medium text-slate-700">
          Do you prefer larger events or these smaller events?
        </p>
        <div className="flex gap-2">
          {(['larger', 'smaller'] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => setSizePreference(opt)}
              className={[
                'flex-1 rounded-xl border py-2.5 text-sm font-medium transition',
                sizePreference === opt
                  ? 'border-slate-900 bg-slate-900 text-white'
                  : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100',
              ].join(' ')}
            >
              {opt === 'larger' ? 'Larger events' : 'Smaller events like these'}
            </button>
          ))}
        </div>
      </div>

      {/* Q3: One change */}
      <div className="mb-4">
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          What's one thing you'd change? <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <textarea
          rows={2}
          value={oneChange}
          onChange={(e) => setOneChange(e.target.value)}
          placeholder="e.g. More networking time, different venue…"
          className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-slate-400 focus:bg-white"
        />
      </div>

      {/* Q4: Additional feedback */}
      <div className="mb-5">
        <label className="mb-1.5 block text-sm font-medium text-slate-700">
          Any additional feedback? <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <textarea
          rows={2}
          value={additionalFeedback}
          onChange={(e) => setAdditionalFeedback(e.target.value)}
          placeholder="Anything else you'd like us to know…"
          className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-800 placeholder-slate-400 outline-none focus:border-slate-400 focus:bg-white"
        />
      </div>

      <button
        onClick={handleSubmit}
        disabled={!rating || submitting}
        className="w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 active:scale-95 disabled:opacity-40"
      >
        {submitting ? 'Submitting…' : 'Submit feedback'}
      </button>
    </div>
  );
}

function ProfilePromptModal({
  user,
  onSave,
  onSkip,
}: {
  user: { business_name?: string | null; tagline?: string | null; full_name?: string | null } | null;
  onSave: (business_name: string, tagline: string) => Promise<void>;
  onSkip: () => void;
}) {
  const [businessName, setBusinessName] = React.useState(user?.business_name ?? '');
  const [tagline, setTagline] = React.useState(user?.tagline ?? '');
  const [saving, setSaving] = React.useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(businessName, tagline);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 px-4 pb-6 sm:items-center">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-1 flex items-center gap-2">
          <span className="text-xl">👋</span>
          <h2 className="text-base font-bold text-slate-900">Finish your profile</h2>
        </div>
        <p className="mb-5 text-sm text-slate-500 leading-relaxed">
          Other members see this when browsing who's at the event. Takes 10 seconds!
        </p>

        <div className="space-y-3">
          {!user?.business_name && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Business name</label>
              <input
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                placeholder="Your company or brand"
                value={businessName}
                onChange={e => setBusinessName(e.target.value)}
                autoFocus
              />
            </div>
          )}
          {!user?.tagline && (
            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-medium text-slate-600">What do you do?</label>
                <span className={['text-xs', tagline.length > 100 ? 'text-orange-500' : 'text-slate-400'].join(' ')}>
                  {tagline.length}/120
                </span>
              </div>
              <input
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                placeholder="e.g. I help small businesses build their online presence"
                maxLength={120}
                value={tagline}
                onChange={e => setTagline(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="mt-5 flex gap-2">
          <button
            onClick={onSkip}
            className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-50"
          >
            Skip for now
          </button>
          <button
            onClick={handleSave}
            disabled={saving || (!businessName.trim() && !tagline.trim())}
            className="flex-1 rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function EventDetailPage() {
  const [, params] = useRoute('/events/:id');
  const [, navigate] = useLocation();
  const { user, refresh } = useAuth();

  const [event, setEvent] = React.useState<Event | null>(null);
  const [myCheckin, setMyCheckin] = React.useState<CheckIn | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [checkingIn, setCheckingIn] = React.useState(false);
  const [msg, setMsg] = React.useState<string | null>(null);
  const [notFound, setNotFound] = React.useState(false);
  const [showProfilePrompt, setShowProfilePrompt] = React.useState(false);

  // networking state: undefined = not loaded yet, null = no active round
  const [networkingGroup, setNetworkingGroup] = React.useState<NetworkingCurrent | null | undefined>(undefined);

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

  const loadNetworkingGroup = React.useCallback(async () => {
    if (!id) return;
    try {
      const data = await getNetworkingCurrent(id);
      setNetworkingGroup(data);
    } catch {
      setNetworkingGroup(null);
    }
  }, [id]);

  // Load group once checked-in + networking is enabled
  React.useEffect(() => {
    if (myCheckin && event?.has_networking) loadNetworkingGroup();
  }, [myCheckin, event?.has_networking, loadNetworkingGroup]);

  // SSE: instantly update when admin runs a new round
  React.useEffect(() => {
    if (!myCheckin || !event?.has_networking || !id) return;
    const token = getToken();
    if (!token) return;
    const es = new EventSource(`/api/events/${id}/networking/stream?token=${encodeURIComponent(token)}`);
    es.onmessage = () => { loadNetworkingGroup(); };
    es.onerror = () => { es.close(); };
    return () => { es.close(); };
  }, [myCheckin, event?.has_networking, id, loadNetworkingGroup]);

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
        // Prompt to complete profile if business name or tagline is missing
        if (!user?.business_name || !user?.tagline) {
          setShowProfilePrompt(true);
        }
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

  const open = isCheckInOpen(event);

  return (
    <div>
      {/* Profile completion prompt */}
      {showProfilePrompt && (
        <ProfilePromptModal
          user={user}
          onSave={async (business_name, tagline) => {
            await updateProfile({
              full_name: user?.full_name ?? '',
              business_name: business_name || undefined,
              tagline: tagline || undefined,
            });
            await refresh();
            setShowProfilePrompt(false);
          }}
          onSkip={() => setShowProfilePrompt(false)}
        />
      )}

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
          <img src={event.image_url} alt={event.title} className="h-52 w-full object-cover" />
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
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm">
              📅
            </div>
            <div>
              <div className="text-sm font-medium text-slate-900">
                {fmtET(event.start_at, 'EEEE, MMMM d, yyyy')}
              </div>
              <div className="text-xs text-slate-500">
                {fmtET(event.start_at, 'h:mm a')}
                {event.end_at && ` – ${fmtET(event.end_at, 'h:mm a')}`}
                {' ET'}
              </div>
            </div>
          </div>

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

      {/* Community support */}
      <section
        aria-labelledby="support-patrick-heading"
        className="mb-4 rounded-2xl border border-rose-200 bg-gradient-to-br from-rose-50 via-white to-orange-50 p-5 shadow-sm"
      >
        <div className="flex items-start gap-3">
          <div
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-lg text-rose-700"
          >
            ♥
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="support-patrick-heading" className="font-semibold text-slate-900">
              Support Patrick and his family
            </h2>
            <p className="mt-1.5 text-sm leading-6 text-slate-600">
              Patrick Moreau is facing a serious cancer diagnosis. If you&apos;re able, please consider
              contributing to help with medical costs, travel, and family care.
            </p>
          </div>
        </div>
        <a
          href={PATRICK_GOFUNDME_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Support Patrick Moreau on GoFundMe (opens in a new tab)"
          className="mt-4 flex min-h-11 w-full items-center justify-center rounded-xl bg-rose-700 px-4 py-3 text-center text-sm font-semibold text-white transition hover:bg-rose-800 focus:outline-none focus:ring-2 focus:ring-rose-600 focus:ring-offset-2"
        >
          Support Patrick on GoFundMe <span aria-hidden="true" className="ml-1.5">↗</span>
        </a>
      </section>

      {/* Check-in */}
      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        {myCheckin ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-green-100 text-lg">
                ✓
              </div>
              <div>
                <div className="font-medium text-green-700">You're checked in!</div>
                <div className="text-xs text-green-600/70">
                  Checked in at {fmtET(myCheckin.checked_in_at, 'h:mm a')} ET
                </div>
              </div>
            </div>

            {event.has_raffle && (
              <div className="flex items-center gap-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-100 text-base">
                  🎟️
                </div>
                <div>
                  <div className="text-sm font-semibold text-orange-700">You're in the raffle!</div>
                  <div className="text-xs text-orange-500">
                    Your name has been entered — good luck!
                  </div>
                </div>
              </div>
            )}

            {/* Networking group card */}
            {event.has_networking && networkingGroup && (
              <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3.5">
                <div className="mb-2 flex items-center gap-2">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-base">
                    ⚡
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-blue-700">
                      Round {networkingGroup.round_number} · Group {networkingGroup.group_label}
                    </div>
                    <div className="text-xs text-blue-500">Your networking group</div>
                  </div>
                </div>
                <div className="ml-11 space-y-1">
                  {networkingGroup.members.map((m) => (
                    <div key={m.user_id} className="text-sm text-blue-800">
                      {m.full_name ?? '—'}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {event.has_networking && networkingGroup === null && (
              <div className="flex items-center gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-100 text-base">
                  ⚡
                </div>
                <div className="text-sm text-blue-600">Networking rounds haven't started yet</div>
              </div>
            )}
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
            {isAfter(new Date(), addHours(new Date(event.start_at), 6))
              ? 'Check-in is closed for this event'
              : `Check-in opens 2 hours before the event starts`}
          </div>
        )}
        {msg && !myCheckin && (
          <p className="mt-2 text-center text-xs text-slate-500">{msg}</p>
        )}
      </div>

      {/* Who's Here */}
      {id && (
        <Link
          href={`/events/${id}/attendees`}
          className="mb-4 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm transition hover:bg-slate-50 active:scale-[0.99]"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-base">
              👥
            </div>
            <div>
              <div className="text-sm font-semibold text-slate-800">Who's Here</div>
              <div className="text-xs text-slate-400">Browse attendees by industry</div>
            </div>
          </div>
          <span className="text-slate-300">→</span>
        </Link>
      )}

      {/* Feedback form — shown only when checked in */}
      {myCheckin && id && <FeedbackCard eventId={id} />}

      {/* Description */}
      {event.description && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
            About this event
          </h2>
          <div
            className="prose prose-sm max-w-none text-slate-700"
            dangerouslySetInnerHTML={{ __html: event.description }}
          />
        </div>
      )}
    </div>
  );
}
