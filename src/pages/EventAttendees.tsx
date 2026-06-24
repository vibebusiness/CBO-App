import React from 'react';
import { useRoute, useLocation } from 'wouter';
import { getEvent, getEventAttendees, getAiMatch, type AiMatchResult } from '../lib/api';
import type { Event } from '../types/models';

type Attendee = {
  full_name: string | null;
  industry: string | null;
  business_name: string | null;
  tagline: string | null;
  avatar_url: string | null;
};

function AttendeeAvatar({ member, isMatch }: { member: Attendee; isMatch: boolean }) {
  const [imgError, setImgError] = React.useState(false);
  const initials = member.full_name?.[0]?.toUpperCase() ?? '?';

  if (member.avatar_url && !imgError) {
    return (
      <img
        src={member.avatar_url}
        alt={member.full_name ?? 'Member'}
        className={[
          'mt-0.5 h-9 w-9 shrink-0 rounded-full object-cover',
          isMatch ? 'ring-2 ring-violet-300' : 'ring-1 ring-slate-200',
        ].join(' ')}
        onError={() => setImgError(true)}
      />
    );
  }
  return (
    <div className={[
      'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold',
      isMatch ? 'bg-violet-100 text-violet-700' : 'bg-slate-100 text-slate-600',
    ].join(' ')}>
      {initials}
    </div>
  );
}

export function EventAttendeesPage() {
  const [, params] = useRoute('/events/:id/attendees');
  const [, navigate] = useLocation();
  const id = params?.id;

  const [event, setEvent] = React.useState<Event | null>(null);
  const [attendees, setAttendees] = React.useState<Attendee[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<string | null>(null);
  const tabBarRef = React.useRef<HTMLDivElement>(null);

  const [matchLoading, setMatchLoading] = React.useState(false);
  const [matchResult, setMatchResult] = React.useState<AiMatchResult | null>(null);
  const [matchError, setMatchError] = React.useState<string | null>(null);
  const seenIds = React.useRef<string[]>([]);

  React.useEffect(() => {
    if (!id) return;
    Promise.all([getEvent(id), getEventAttendees(id)])
      .then(([ev, att]) => {
        setEvent(ev);
        setAttendees(att as Attendee[]);
      })
      .catch(() => navigate('/events'))
      .finally(() => setLoading(false));
  }, [id]);

  const grouped = React.useMemo(() => {
    const map = new Map<string, Attendee[]>();
    for (const a of attendees) {
      const key = a.industry?.trim() || 'Not Listed';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return [...map.entries()].sort(([a], [b]) => {
      if (a === 'Not Listed') return 1;
      if (b === 'Not Listed') return -1;
      return a.localeCompare(b);
    });
  }, [attendees]);

  React.useEffect(() => {
    if (grouped.length > 0 && activeTab === null) {
      setActiveTab(grouped[0][0]);
    }
  }, [grouped]);

  React.useEffect(() => {
    if (!activeTab || !tabBarRef.current) return;
    const btn = tabBarRef.current.querySelector(`[data-tab="${CSS.escape(activeTab)}"]`);
    btn?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeTab]);

  const handleFindMatch = async () => {
    if (!id) return;
    setMatchLoading(true);
    setMatchError(null);
    try {
      const result = await getAiMatch(id, seenIds.current);
      seenIds.current = [...seenIds.current, result.match.id];
      setMatchResult(result);
    } catch (e: unknown) {
      setMatchError((e as Error).message ?? 'Something went wrong');
    } finally {
      setMatchLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-sm text-slate-400">Loading…</div>
      </div>
    );
  }

  const activeMembers = grouped.find(([industry]) => industry === activeTab)?.[1] ?? [];

  return (
    <div className="space-y-4">
      <button
        onClick={() => window.history.back()}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
      >
        ← Back
      </button>

      {/* Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-lg font-bold text-slate-900">Who's Here</h1>
        {event && <p className="mt-0.5 text-sm text-slate-500">{event.title}</p>}
        <div className="mt-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-sm">👥</div>
          <span className="text-sm font-medium text-slate-700">
            {attendees.length} {attendees.length === 1 ? 'person' : 'people'} checked in
          </span>
        </div>
      </div>

      {/* AI Match CTA */}
      {attendees.length > 1 && (
        <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-indigo-50 p-4 shadow-sm">
          <div className="mb-3 flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-lg">🤝</div>
            <div>
              <div className="text-sm font-semibold text-violet-900">Find your best match</div>
              <p className="mt-0.5 text-xs text-violet-600 leading-relaxed">
                AI looks at everyone's profile and picks the one person you should meet today — plus gives you an opening line to use.
              </p>
            </div>
          </div>
          <button
            onClick={handleFindMatch}
            disabled={matchLoading}
            className="w-full rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-60"
          >
            {matchLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Finding your match…
              </span>
            ) : matchResult ? 'Find a different match' : 'Find my match ✨'}
          </button>

          {matchError && (
            <p className="mt-2 text-center text-xs text-red-600">{matchError}</p>
          )}
        </div>
      )}

      {/* AI Match Result */}
      {matchResult && (
        <div className="overflow-hidden rounded-2xl border border-violet-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 bg-violet-600 px-4 py-2.5">
            <span className="text-base">✨</span>
            <span className="text-sm font-semibold text-white">Your match today</span>
          </div>
          <div className="p-4 space-y-4">
            {/* Person card */}
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-violet-100 text-base font-bold text-violet-700">
                {matchResult.match.full_name?.[0]?.toUpperCase() ?? '?'}
              </div>
              <div className="min-w-0">
                <div className="font-semibold text-slate-900">{matchResult.match.full_name}</div>
                {matchResult.match.business_name && (
                  <div className="text-sm font-medium text-slate-500">{matchResult.match.business_name}</div>
                )}
                {matchResult.match.tagline && (
                  <div className="text-xs text-slate-400 mt-0.5">{matchResult.match.tagline}</div>
                )}
                {matchResult.match.industry && (
                  <span className="mt-1.5 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                    {matchResult.match.industry}
                  </span>
                )}
              </div>
            </div>

            {/* Why */}
            <div className="rounded-xl bg-slate-50 px-3.5 py-3">
              <div className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Why them?</div>
              <p className="text-sm text-slate-700 leading-relaxed">{matchResult.reason}</p>
            </div>

            {/* Icebreaker */}
            <div className="rounded-xl border border-violet-100 bg-violet-50 px-3.5 py-3">
              <div className="mb-1 flex items-center gap-1.5">
                <span className="text-sm">💬</span>
                <span className="text-[11px] font-semibold uppercase tracking-wide text-violet-500">Say this to them</span>
              </div>
              <p className="text-sm font-medium text-violet-900 leading-relaxed">"{matchResult.icebreaker}"</p>
            </div>
          </div>
        </div>
      )}

      {/* Attendee directory */}
      {attendees.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mb-2 text-3xl">👋</div>
          <div className="text-sm font-medium text-slate-700">No one's checked in yet</div>
          <div className="mt-1 text-xs text-slate-400">Be the first!</div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* Tab bar */}
          <div
            ref={tabBarRef}
            className="flex gap-1 overflow-x-auto border-b border-slate-100 px-3 pt-3 pb-0"
            style={{ scrollbarWidth: 'none' }}
          >
            {grouped.map(([industry, members]) => (
              <button
                key={industry}
                data-tab={industry}
                onClick={() => setActiveTab(industry)}
                className={[
                  'flex shrink-0 items-center gap-1.5 rounded-t-xl border-b-2 px-3.5 pb-2.5 pt-2 text-xs font-semibold transition-colors',
                  activeTab === industry
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-400 hover:text-slate-600',
                ].join(' ')}
              >
                {industry}
                <span className={[
                  'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                  activeTab === industry ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500',
                ].join(' ')}>
                  {members.length}
                </span>
              </button>
            ))}
          </div>

          {/* Members */}
          <div className="divide-y divide-slate-50 p-2">
            {activeMembers
              .slice()
              .sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? ''))
              .map((m, i) => {
                const isMatch = matchResult?.match.full_name === m.full_name;
                return (
                  <div
                    key={i}
                    className={[
                      'flex items-start gap-3 rounded-xl px-3 py-3 transition-colors',
                      isMatch ? 'bg-violet-50 ring-1 ring-violet-200' : '',
                    ].join(' ')}
                  >
                    <AttendeeAvatar member={m} isMatch={isMatch} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-slate-900">{m.full_name ?? '—'}</span>
                        {isMatch && (
                          <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-600">your match ✨</span>
                        )}
                      </div>
                      {m.business_name && (
                        <div className="text-xs font-medium text-slate-500">{m.business_name}</div>
                      )}
                      {m.tagline && (
                        <div className="mt-0.5 text-xs text-slate-400">{m.tagline}</div>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}
    </div>
  );
}
