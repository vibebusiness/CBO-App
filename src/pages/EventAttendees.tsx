import React from 'react';
import { useRoute, useLocation } from 'wouter';
import { getEvent, getEventAttendees, getAiMatch, getConversations, startConversation, getAiDraft, sendMessage, type AiMatchResult, type ConversationSummary } from '../lib/api';
import type { Event } from '../types/models';
import { useAuth } from '../state/auth';
import { ChatDrawer, InboxPanel, ConnectModal } from '../components/EventChat';

type Attendee = {
  id: string;
  full_name: string | null;
  industry: string | null;
  business_name: string | null;
  tagline: string | null;
  avatar_url: string | null;
};

type ActiveChat = {
  conversationId: string;
  other: { name: string | null; business: string | null; avatar: string | null };
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
  const [modePicker, setModePicker] = React.useState(false);
  const [matchMode, setMatchMode] = React.useState<'regular' | 'bold' | null>(null);
  const seenIds = React.useRef<string[]>([]);

  const { user } = useAuth();
  const [inboxOpen, setInboxOpen] = React.useState(false);
  const [connectTarget, setConnectTarget] = React.useState<Attendee | null>(null);
  const [activeChat, setActiveChat] = React.useState<ActiveChat | null>(null);
  const [unreadTotal, setUnreadTotal] = React.useState(0);

  // Poll the unread badge total while the page is open (paused when tab hidden).
  React.useEffect(() => {
    if (!id) return;
    let stop = false;
    const refresh = async () => {
      if (document.hidden) return;
      try {
        const rows = await getConversations(id);
        if (!stop) setUnreadTotal(rows.reduce((s, c) => s + (c.unread || 0), 0));
      } catch {
        /* ignore */
      }
    };
    refresh();
    const t = window.setInterval(refresh, 8000);
    return () => {
      stop = true;
      window.clearInterval(t);
    };
  }, [id, activeChat, inboxOpen, connectTarget]);

  const openChat = (conversationId: string, other: ActiveChat['other']) => {
    setConnectTarget(null);
    setInboxOpen(false);
    setActiveChat({ conversationId, other });
  };

  const handleInboxOpen = (c: ConversationSummary) =>
    openChat(c.id, { name: c.other_name, business: c.other_business, avatar: c.other_avatar });

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

  const runMatch = async (mode: 'regular' | 'bold') => {
    if (!id) return;
    setModePicker(false);
    setMatchMode(mode);
    setMatchLoading(true);
    setMatchError(null);
    try {
      const result = await getAiMatch(id, seenIds.current);
      seenIds.current = [...seenIds.current, result.match.id];
      setMatchResult(result);

      const matched = attendees.find((a) => a.id === result.match.id);
      const avatar = matched?.avatar_url ?? null;

      if (mode === 'regular') {
        // Open the compose flow so the user can review/edit before sending.
        setConnectTarget({
          id: result.match.id,
          full_name: result.match.full_name,
          business_name: result.match.business_name,
          tagline: result.match.tagline ?? null,
          industry: result.match.industry ?? null,
          avatar_url: avatar,
        });
      } else {
        // Bold: draft a message and auto-send it without the user reviewing.
        const conv = await startConversation(id, result.match.id);
        let body = '';
        try {
          body = (await getAiDraft(id, result.match.id)).draft;
        } catch {
          /* fall through to fallback below */
        }
        body = (body && body.trim())
          || result.icebreaker
          || `Hi ${result.match.full_name ?? 'there'} — great to connect with you here at the event!`;
        await sendMessage(conv.id, body);
        openChat(conv.id, {
          name: result.match.full_name,
          business: result.match.business_name,
          avatar,
        });
      }
    } catch (e: unknown) {
      setMatchError((e as Error).message ?? 'Something went wrong');
    } finally {
      setMatchLoading(false);
      setMatchMode(null);
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

      {/* Inbox button */}
      <button
        onClick={() => setInboxOpen(true)}
        className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition hover:bg-slate-50"
      >
        <span className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-sm">✉️</span>
          <span className="text-sm font-semibold text-slate-800">Messages</span>
        </span>
        {unreadTotal > 0 && (
          <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-violet-600 px-1.5 text-[11px] font-bold text-white">
            {unreadTotal}
          </span>
        )}
      </button>

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
            onClick={() => setModePicker(true)}
            disabled={matchLoading}
            className="w-full rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-60"
          >
            {matchLoading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {matchMode === 'bold' ? 'Drafting & sending…' : 'Finding your match…'}
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
                const isSelf = m.id === user?.id;
                return (
                  <div
                    key={m.id ?? i}
                    className={[
                      'flex items-start gap-3 rounded-xl px-3 py-3 transition-colors',
                      isMatch ? 'bg-violet-50 ring-1 ring-violet-200' : '',
                    ].join(' ')}
                  >
                    <AttendeeAvatar member={m} isMatch={isMatch} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-slate-900">{m.full_name ?? '—'}</span>
                        {isSelf && (
                          <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">you</span>
                        )}
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
                    {!isSelf && (
                      <button
                        onClick={() => setConnectTarget(m)}
                        className="mt-0.5 shrink-0 rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-100"
                      >
                        Connect
                      </button>
                    )}
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Match style picker */}
      {modePicker && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 sm:items-center sm:justify-center"
          role="dialog"
          aria-modal="true"
          aria-label="Choose how to match"
          onClick={() => setModePicker(false)}
        >
          <div
            className="w-full rounded-t-3xl bg-white p-5 shadow-xl sm:max-w-sm sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-slate-200 sm:hidden" />
            <h3 className="text-center text-base font-bold text-slate-900">How should we break the ice?</h3>
            <p className="mx-auto mt-1 mb-4 max-w-xs text-center text-xs text-slate-500">
              We'll pick your best match either way.
            </p>

            <button
              onClick={() => runMatch('regular')}
              className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-violet-300 hover:bg-violet-50"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-lg">✍️</div>
                <div>
                  <div className="text-sm font-semibold text-slate-900">Regular</div>
                  <div className="text-xs text-slate-500 leading-relaxed">
                    Draft a message and let you review it before sending.
                  </div>
                </div>
              </div>
            </button>

            <button
              onClick={() => runMatch('bold')}
              className="mt-3 w-full rounded-2xl border border-violet-300 bg-gradient-to-br from-violet-600 to-indigo-600 p-4 text-left text-white transition hover:from-violet-700 hover:to-indigo-700"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/20 text-lg">⚡</div>
                <div>
                  <div className="text-sm font-semibold">Bold</div>
                  <div className="text-xs text-violet-100 leading-relaxed">
                    Draft a message and auto-send it to your match instantly.
                  </div>
                </div>
              </div>
            </button>

            <button
              onClick={() => setModePicker(false)}
              className="mt-4 w-full py-2 text-center text-sm font-medium text-slate-500 transition hover:text-slate-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Connect (AI draft) modal */}
      {connectTarget && id && (
        <ConnectModal
          eventId={id}
          recipient={{
            id: connectTarget.id,
            name: connectTarget.full_name,
            business: connectTarget.business_name,
            avatar: connectTarget.avatar_url,
          }}
          onClose={() => setConnectTarget(null)}
          onOpenChat={(conversationId) =>
            openChat(conversationId, {
              name: connectTarget.full_name,
              business: connectTarget.business_name,
              avatar: connectTarget.avatar_url,
            })
          }
        />
      )}

      {/* Inbox */}
      {inboxOpen && id && (
        <InboxPanel
          eventId={id}
          onOpenConversation={handleInboxOpen}
          onClose={() => setInboxOpen(false)}
          onCountChange={setUnreadTotal}
        />
      )}

      {/* Active chat thread */}
      {activeChat && user && (
        <ChatDrawer
          conversationId={activeChat.conversationId}
          other={activeChat.other}
          currentUserId={user.id}
          onClose={() => setActiveChat(null)}
        />
      )}
    </div>
  );
}
