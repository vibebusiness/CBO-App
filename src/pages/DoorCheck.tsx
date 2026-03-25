import React from 'react';
import { useParams, useLocation } from 'wouter';
import { getEvent, getCheckIns } from '../lib/api';
import type { Event, CheckIn } from '../types/models';
import { fmtET } from '../lib/tz';

export function DoorCheckPage() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const [event, setEvent] = React.useState<Event | null>(null);
  const [checkins, setCheckins] = React.useState<CheckIn[]>([]);
  const [query, setQuery] = React.useState('');
  const [secondsAgo, setSecondsAgo] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const lastUpdatedRef = React.useRef<Date>(new Date());

  React.useEffect(() => {
    getEvent(id).then(setEvent).catch(console.error);
  }, [id]);

  const fetchCheckins = React.useCallback(async () => {
    try {
      const rows = await getCheckIns(id);
      setCheckins(rows);
      lastUpdatedRef.current = new Date();
      setSecondsAgo(0);
      setLoading(false);
    } catch (e) {
      console.error(e);
      setLoading(false);
    }
  }, [id]);

  React.useEffect(() => {
    fetchCheckins();
    const poll = setInterval(fetchCheckins, 5000);
    return () => clearInterval(poll);
  }, [fetchCheckins]);

  React.useEffect(() => {
    const timer = setInterval(() => {
      const diff = Math.floor((Date.now() - lastUpdatedRef.current.getTime()) / 1000);
      setSecondsAgo(diff);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const q = query.trim().toLowerCase();
  const results = q.length > 0
    ? checkins.filter((c) =>
        c.full_name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q)
      )
    : [];
  const hasSearched = q.length > 0;
  const found = results.length > 0;

  return (
    <div className="flex min-h-screen flex-col bg-slate-900 text-white">
      {/* Header */}
      <div className="border-b border-slate-700 bg-slate-800 px-4 pb-3 pt-safe">
        <div className="flex items-center justify-between pt-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-base font-semibold text-white">
              {event?.title ?? '…'}
            </div>
            {event && (
              <div className="text-xs text-slate-400">
                {fmtET(event.start_at, 'EEE, MMM d · h:mm a')} ET
              </div>
            )}
          </div>
          <div className="ml-4 flex shrink-0 items-center gap-3">
            <div className="text-right">
              {loading ? (
                <div className="text-xs text-slate-500">Loading…</div>
              ) : (
                <>
                  <div className="text-2xl font-bold tabular-nums text-white">{checkins.length}</div>
                  <div className="text-xs text-slate-400">checked in</div>
                </>
              )}
            </div>
            <button
              onClick={() => navigate('/admin')}
              className="rounded-lg border border-slate-600 px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200"
            >
              ← Admin
            </button>
          </div>
        </div>
      </div>

      {/* Search input */}
      <div className="px-4 pt-4 pb-2">
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-xl">🔍</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a name…"
            className="w-full rounded-2xl bg-slate-700 py-4 pl-12 pr-12 text-xl text-white placeholder-slate-500 outline-none focus:ring-2 focus:ring-blue-500"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="words"
            spellCheck={false}
          />
          {query && (
            <button
              onClick={() => { setQuery(''); inputRef.current?.focus(); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-xl"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Results area */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {!hasSearched ? (
          <div className="mt-12 text-center">
            <div className="mb-3 text-6xl">🏷️</div>
            <div className="text-base text-slate-400">Search to verify check-in status</div>
            <div className="mt-1 text-sm text-slate-600">{checkins.length} people checked in so far</div>
          </div>
        ) : found ? (
          <div className="mt-2 space-y-3">
            {results.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-4 rounded-2xl border border-green-600/60 bg-green-900/40 p-4"
              >
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-green-500 text-3xl font-bold text-white shadow-lg">
                  ✓
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-xl font-bold text-white">
                    {c.full_name ?? c.email}
                  </div>
                  {c.full_name && (
                    <div className="truncate text-sm text-green-300">{c.email}</div>
                  )}
                  <div className="mt-0.5 text-xs text-green-400">
                    Checked in · {fmtET(c.checked_in_at, 'h:mm a')} ET
                  </div>
                </div>
                <div className="shrink-0 text-4xl">🏷️</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-2 rounded-2xl border border-red-600/60 bg-red-900/40 p-6 text-center">
            <div className="mb-3 text-5xl">❌</div>
            <div className="text-xl font-bold text-white">Not on the list</div>
            <div className="mt-2 text-sm leading-relaxed text-red-300">
              Have them open the CBO app,<br />
              tap <strong>Check In</strong> on the event,<br />
              then come back.
            </div>
          </div>
        )}
      </div>

      {/* Live status bar */}
      <div className="border-t border-slate-700/60 bg-slate-800/50 px-4 py-2 text-center">
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
          Live · updated {secondsAgo === 0 ? 'just now' : `${secondsAgo}s ago`}
        </span>
      </div>
    </div>
  );
}
