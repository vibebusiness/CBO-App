import React from 'react';
import { useParams, useLocation } from 'wouter';
import { getEvent, getCheckIns, adminManualCheckIn } from '../lib/api';
import type { Event, CheckIn } from '../types/models';
import { fmtET } from '../lib/tz';

function wordStartMatch(name: string | null | undefined, q: string): boolean {
  if (!name) return false;
  return name.toLowerCase().split(/\s+/).some((word) => word.startsWith(q));
}

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

  const [manualEmail, setManualEmail] = React.useState('');
  const [manualName, setManualName] = React.useState('');
  const [manualBusy, setManualBusy] = React.useState(false);
  const [manualMsg, setManualMsg] = React.useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const handleManualCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = manualEmail.trim();
    if (!email || manualBusy) return;
    setManualBusy(true);
    setManualMsg(null);
    try {
      const r = await adminManualCheckIn(id, email, manualName.trim() || undefined);
      const who = r.user.full_name || r.user.email;
      setManualMsg({
        kind: 'ok',
        text: r.already_checked_in
          ? `${who} was already checked in.`
          : r.created_account
            ? `Account created and ${who} checked in. They can use "Forgot password" to set a password.`
            : `${who} checked in.`,
      });
      setManualEmail('');
      setManualName('');
      fetchCheckins();
    } catch (err: any) {
      setManualMsg({ kind: 'err', text: err?.message ?? 'Something went wrong' });
    } finally {
      setManualBusy(false);
    }
  };

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
      setSecondsAgo(Math.floor((Date.now() - lastUpdatedRef.current.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const q = query.trim().toLowerCase();
  const hasSearched = q.length > 0;

  const results = hasSearched
    ? checkins.filter((c) => wordStartMatch(c.full_name, q) || wordStartMatch(c.email, q))
    : [];

  const found = results.length > 0;

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* Header — matches app style */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <img src="/cbo-logo.png" alt="CBO" className="h-6 w-auto" />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-slate-900">
                  {event?.title ?? '…'}
                </div>
                {event && (
                  <div className="text-xs text-slate-500">
                    {fmtET(event.start_at, 'EEE, MMM d · h:mm a')} ET
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="ml-3 flex shrink-0 items-center gap-3">
            {!loading && (
              <div className="text-right">
                <div className="text-lg font-bold tabular-nums text-slate-900">{checkins.length}</div>
                <div className="text-xs text-slate-400 leading-none">checked in</div>
              </div>
            )}
            <button
              onClick={() => navigate('/admin')}
              className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-200"
            >
              ← Admin
            </button>
          </div>
        </div>
      </header>

      {/* Search input */}
      <div className="mx-auto w-full max-w-md px-4 pt-4 pb-3">
        <div className="relative">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400"
            fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a name…"
            className="w-full rounded-2xl border border-slate-200 bg-white py-4 pl-12 pr-12 text-xl text-slate-900 placeholder-slate-400 shadow-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="words"
            spellCheck={false}
          />
          {query && (
            <button
              onClick={() => { setQuery(''); inputRef.current?.focus(); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-xl text-slate-400 hover:text-slate-600"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Results */}
      <div className="mx-auto w-full max-w-md flex-1 overflow-y-auto px-4 pb-6">
        {!hasSearched ? (
          <div className="mt-10 text-center">
            <div className="mb-3 text-6xl">🏷️</div>
            <div className="text-base font-medium text-slate-500">Search to verify check-in status</div>
            {!loading && (
              <div className="mt-1 text-sm text-slate-400">{checkins.length} people checked in so far</div>
            )}
          </div>
        ) : found ? (
          <div className="space-y-3">
            {results.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-4 rounded-2xl border border-green-200 bg-green-50 p-4 shadow-sm"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-green-500 text-2xl font-bold text-white shadow">
                  ✓
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-lg font-bold text-slate-900">
                    {c.full_name ?? c.email}
                  </div>
                  {c.full_name && (
                    <div className="truncate text-sm text-slate-500">{c.email}</div>
                  )}
                  <div className="mt-0.5 text-xs text-green-600 font-medium">
                    ✓ Checked in · {fmtET(c.checked_in_at, 'h:mm a')} ET
                  </div>
                </div>
                <div className="shrink-0 text-3xl">🏷️</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center shadow-sm">
            <div className="mb-3 text-5xl">❌</div>
            <div className="text-xl font-bold text-slate-900">Not on the list</div>
            <div className="mt-2 text-sm leading-relaxed text-slate-600">
              Have them open the CBO app,<br />
              tap <span className="font-semibold">Check In</span> on this event,<br />
              then come back.
            </div>

            <form onSubmit={handleManualCheckIn} className="mt-5 rounded-xl border border-slate-200 bg-white p-4 text-left">
              <div className="mb-2 text-sm font-semibold text-slate-800">Or check them in manually</div>
              <input
                type="email"
                value={manualEmail}
                onChange={(e) => setManualEmail(e.target.value)}
                placeholder="their@email.com"
                className="mb-2 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                autoComplete="off"
                required
              />
              <input
                type="text"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder="Full name (only needed if they have no account)"
                className="mb-3 w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-slate-400"
                autoComplete="off"
              />
              <button
                type="submit"
                disabled={manualBusy || !manualEmail.trim()}
                className="w-full rounded-lg bg-slate-900 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                {manualBusy ? 'Checking in…' : 'Check them in'}
              </button>
            </form>
          </div>
        )}

        {manualMsg && (
          <div
            className={`mt-3 rounded-xl px-4 py-3 text-sm font-medium ${
              manualMsg.kind === 'ok'
                ? 'border border-green-200 bg-green-50 text-green-700'
                : 'border border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {manualMsg.text}
          </div>
        )}
      </div>

      {/* Live status bar */}
      <div className="border-t border-slate-200 bg-white px-4 py-2 text-center">
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-400">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
          Live · updated {secondsAgo === 0 ? 'just now' : `${secondsAgo}s ago`}
        </span>
      </div>
    </div>
  );
}
