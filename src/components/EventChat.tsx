import React from 'react';
import {
  getMessages,
  sendMessage,
  getConversations,
  startConversation,
  getAiDraft,
  type ChatMessage,
  type ConversationSummary,
} from '../lib/api';
import { fmtET } from '../lib/tz';

/** Run `cb` on an interval, paused while the tab is hidden. */
function usePolling(cb: () => void, ms: number, active: boolean) {
  const saved = React.useRef(cb);
  React.useEffect(() => {
    saved.current = cb;
  }, [cb]);
  React.useEffect(() => {
    if (!active) return;
    const tick = () => {
      if (!document.hidden) saved.current();
    };
    const id = window.setInterval(tick, ms);
    return () => window.clearInterval(id);
  }, [ms, active]);
}

function Avatar({ url, name, size = 'h-9 w-9' }: { url: string | null; name: string | null; size?: string }) {
  const [err, setErr] = React.useState(false);
  const initial = name?.[0]?.toUpperCase() ?? '?';
  if (url && !err) {
    return (
      <img
        src={url}
        alt={name ?? 'Member'}
        className={`${size} shrink-0 rounded-full object-cover ring-1 ring-slate-200`}
        onError={() => setErr(true)}
      />
    );
  }
  return (
    <div className={`${size} flex shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600`}>
      {initial}
    </div>
  );
}

/** Bottom-sheet chat thread between the current user and one other member. */
export function ChatDrawer({
  conversationId,
  other,
  currentUserId,
  onClose,
  onActivity,
}: {
  conversationId: string;
  other: { name: string | null; business: string | null; avatar: string | null };
  currentUserId: string;
  onClose: () => void;
  onActivity?: () => void;
}) {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [closed, setClosed] = React.useState(false);
  const [draft, setDraft] = React.useState('');
  const [sending, setSending] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const load = React.useCallback(async () => {
    try {
      const res = await getMessages(conversationId);
      setMessages(res.messages);
      setClosed(res.closed);
      onActivity?.();
    } catch {
      /* keep showing what we have */
    } finally {
      setLoading(false);
    }
  }, [conversationId, onActivity]);

  React.useEffect(() => {
    load();
  }, [load]);

  usePolling(load, 3500, true);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || sending || closed) return;
    setSending(true);
    setError(null);
    try {
      const msg = await sendMessage(conversationId, body);
      setMessages((prev) => [...prev, msg]);
      setDraft('');
      onActivity?.();
    } catch (e) {
      setError((e as Error).message ?? 'Could not send');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={onClose}>
      <div
        className="flex h-[80vh] flex-col rounded-t-3xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 border-b border-slate-100 px-4 py-3">
          <Avatar url={other.avatar} name={other.name} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-slate-900">{other.name ?? 'Member'}</div>
            {other.business && <div className="truncate text-xs text-slate-400">{other.business}</div>}
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 space-y-2 overflow-y-auto px-4 py-4">
          {loading ? (
            <div className="py-8 text-center text-sm text-slate-400">Loading…</div>
          ) : messages.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-400">No messages yet — say hello 👋</div>
          ) : (
            messages.map((m) => {
              const mine = m.sender_id === currentUserId;
              return (
                <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={[
                      'max-w-[78%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed',
                      mine ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-800',
                    ].join(' ')}
                  >
                    <div className="whitespace-pre-wrap break-words">{m.body}</div>
                    <div className={`mt-0.5 text-[10px] ${mine ? 'text-violet-200' : 'text-slate-400'}`}>
                      {fmtET(m.sent_at, 'h:mm a')}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Composer */}
        {closed ? (
          <div className="border-t border-slate-100 px-4 py-4 text-center text-xs text-slate-400">
            Messaging closed for this event.
          </div>
        ) : (
          <div className="border-t border-slate-100 px-3 py-3">
            {error && <p className="mb-1.5 px-1 text-center text-xs text-red-600">{error}</p>}
            <div className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                rows={1}
                placeholder="Message…"
                className="max-h-28 min-h-[42px] flex-1 resize-none rounded-2xl border border-slate-200 px-3.5 py-2.5 text-sm focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-400"
              />
              <button
                onClick={handleSend}
                disabled={sending || !draft.trim()}
                className="h-[42px] shrink-0 rounded-2xl bg-violet-600 px-4 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
              >
                {sending ? '…' : 'Send'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Full-height "Messages" sheet that slides up to the top. Newest conversations
 * sit at the top and the list fills downward as messages arrive. Dismiss by
 * swiping the sheet down or tapping the handle/minus at the top.
 */
export function InboxPanel({
  eventId,
  onOpenConversation,
  onClose,
  onCountChange,
}: {
  eventId: string;
  onOpenConversation: (c: ConversationSummary) => void;
  onClose: () => void;
  onCountChange?: (total: number) => void;
}) {
  const [convos, setConvos] = React.useState<ConversationSummary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [entered, setEntered] = React.useState(false);
  const [dragY, setDragY] = React.useState(0);
  const [dragging, setDragging] = React.useState(false);
  const startY = React.useRef<number | null>(null);
  const closeTimer = React.useRef<number | null>(null);
  const closing = React.useRef(false);

  const load = React.useCallback(async () => {
    try {
      const rows = await getConversations(eventId);
      setConvos(rows);
      onCountChange?.(rows.reduce((sum, c) => sum + (c.unread || 0), 0));
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [eventId, onCountChange]);

  React.useEffect(() => {
    load();
  }, [load]);
  usePolling(load, 4000, true);

  // Slide up on mount; clear any pending close timer on unmount.
  React.useEffect(() => {
    const id = requestAnimationFrame(() => setEntered(true));
    return () => {
      cancelAnimationFrame(id);
      if (closeTimer.current != null) window.clearTimeout(closeTimer.current);
    };
  }, []);

  // Animate down, then unmount. Idempotent so rapid taps/swipes don't queue
  // multiple timers (which could close a freshly reopened panel).
  const handleClose = React.useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    setEntered(false);
    setDragY(0);
    closeTimer.current = window.setTimeout(onClose, 240);
  }, [onClose]);

  const onTouchStart = (e: React.TouchEvent) => {
    startY.current = e.touches[0].clientY;
    setDragging(true);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current == null) return;
    const dy = e.touches[0].clientY - startY.current;
    setDragY(dy > 0 ? dy : 0);
  };
  const onTouchEnd = () => {
    setDragging(false);
    if (dragY > 110) handleClose();
    else setDragY(0);
    startY.current = null;
  };

  // Newest first so the most recent conversation stays pinned to the top.
  const sorted = React.useMemo(
    () =>
      [...convos].sort((a, b) => {
        const at = a.last_at ? new Date(a.last_at).getTime() : 0;
        const bt = b.last_at ? new Date(b.last_at).getTime() : 0;
        return bt - at;
      }),
    [convos]
  );

  const translateY = entered ? `${dragY}px` : '100%';

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40" onClick={handleClose}>
      <div
        className="flex h-[94vh] flex-col rounded-t-3xl bg-white shadow-xl"
        style={{
          transform: `translateY(${translateY})`,
          transition: dragging ? 'none' : 'transform 240ms ease-out',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle / minus — swipe down or tap to dismiss */}
        <div
          className="cursor-grab touch-none pt-2.5 active:cursor-grabbing"
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <button
            onClick={handleClose}
            aria-label="Close messages"
            className="mx-auto block h-1.5 w-10 rounded-full bg-slate-300 transition-colors hover:bg-slate-400"
          />
        </div>

        <div className="flex items-center justify-between px-4 py-3">
          <div className="text-sm font-bold text-slate-900">Messages</div>
          <button
            onClick={handleClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto border-t border-slate-100 p-2">
          {loading ? (
            <div className="py-10 text-center text-sm text-slate-400">Loading…</div>
          ) : sorted.length === 0 ? (
            <div className="py-10 text-center">
              <div className="mb-2 text-3xl">💬</div>
              <div className="text-sm font-medium text-slate-700">No conversations yet</div>
              <div className="mt-1 text-xs text-slate-400">Tap “Connect” on someone to start chatting.</div>
            </div>
          ) : (
            sorted.map((c) => (
              <button
                key={c.id}
                onClick={() => onOpenConversation(c)}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-slate-50"
              >
                <Avatar url={c.other_avatar} name={c.other_name} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-slate-900">{c.other_name ?? 'Member'}</span>
                    {c.last_at && (
                      <span className="shrink-0 text-[10px] text-slate-400">{fmtET(c.last_at, 'h:mm a')}</span>
                    )}
                  </div>
                  <div className="truncate text-xs text-slate-500">{c.last_body ?? 'No messages yet'}</div>
                </div>
                {c.unread > 0 && (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-violet-600 px-1.5 text-[10px] font-bold text-white">
                    {c.unread}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Connect flow. On open: ensures a conversation exists. If it already has
 * messages, jumps straight to the thread. Otherwise fetches an AI-drafted
 * icebreaker into an editable box the sender can tweak before sending.
 */
export function ConnectModal({
  eventId,
  recipient,
  onClose,
  onOpenChat,
}: {
  eventId: string;
  recipient: { id: string; name: string | null; business: string | null; avatar: string | null };
  onClose: () => void;
  onOpenChat: (conversationId: string) => void;
}) {
  const [convId, setConvId] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState('');
  const [phase, setPhase] = React.useState<'loading' | 'compose' | 'error'>('loading');
  const [error, setError] = React.useState<string | null>(null);
  const [sending, setSending] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { id } = await startConversation(eventId, recipient.id);
        if (cancelled) return;
        setConvId(id);
        const existing = await getMessages(id);
        if (cancelled) return;
        if (existing.messages.length > 0) {
          onOpenChat(id); // already chatting — skip the draft step
          return;
        }
        const { draft: aiDraft } = await getAiDraft(eventId, recipient.id);
        if (cancelled) return;
        setDraft(aiDraft);
        setPhase('compose');
      } catch (e) {
        if (cancelled) return;
        setError((e as Error).message ?? 'Something went wrong');
        setPhase('error');
      }
    })();
    return () => {
      cancelled = true;
    };
    // Bootstrap runs once per recipient; onOpenChat is intentionally excluded so
    // parent rerenders (e.g. unread-badge polling) don't re-trigger the flow.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId, recipient.id]);

  const handleSend = async () => {
    const body = draft.trim();
    if (!body || !convId || sending) return;
    setSending(true);
    setError(null);
    try {
      await sendMessage(convId, body);
      onOpenChat(convId);
    } catch (e) {
      setError((e as Error).message ?? 'Could not send');
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/40 sm:items-center sm:justify-center" onClick={onClose}>
      <div
        className="w-full rounded-t-3xl bg-white p-5 shadow-xl sm:max-w-md sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center gap-3">
          <Avatar url={recipient.avatar} name={recipient.name} size="h-11 w-11" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-slate-900">{recipient.name ?? 'Member'}</div>
            {recipient.business && <div className="truncate text-xs text-slate-400">{recipient.business}</div>}
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {phase === 'loading' && (
          <div className="py-8 text-center">
            <svg className="mx-auto h-6 w-6 animate-spin text-violet-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="mt-2 text-xs text-slate-500">Drafting an opener…</p>
          </div>
        )}

        {phase === 'error' && (
          <div className="py-6 text-center">
            <p className="text-sm text-red-600">{error}</p>
            <button
              onClick={onClose}
              className="mt-4 rounded-xl bg-slate-100 px-4 py-2 text-sm font-medium text-slate-700"
            >
              Close
            </button>
          </div>
        )}

        {phase === 'compose' && (
          <>
            <div className="mb-1.5 flex items-center gap-1.5">
              <span className="text-sm">✨</span>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-violet-500">
                AI-drafted opener — edit before sending
              </span>
            </div>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={5}
              placeholder="Write a message to introduce yourself…"
              className="w-full resize-none rounded-xl border border-slate-200 px-3.5 py-3 text-sm leading-relaxed focus:border-violet-400 focus:outline-none focus:ring-1 focus:ring-violet-400"
            />
            {error && <p className="mt-1.5 text-center text-xs text-red-600">{error}</p>}
            <button
              onClick={handleSend}
              disabled={sending || !draft.trim()}
              className="mt-3 w-full rounded-xl bg-violet-600 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-50"
            >
              {sending ? 'Sending…' : 'Send message'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
