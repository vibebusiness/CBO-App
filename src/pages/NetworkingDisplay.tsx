import React from 'react';
import { useRoute } from 'wouter';
import { getEvent, getNetworkingRounds } from '../lib/api';
import type { Event, NetworkingRound } from '../types/models';

const REFRESH_MS = 15_000;
const PAGE_MS = 12_000;

function tablesPerPage(round: NetworkingRound | null, viewportHeight: number) {
  const largestTable = Math.max(0, ...(round?.groups.map((group) => group.members.length) ?? []));
  if (viewportHeight < 850) {
    if (largestTable > 10) return 1;
    if (largestTable > 6) return 2;
    return 3;
  }
  if (largestTable > 10) return 2;
  if (largestTable > 6) return 4;
  return 6;
}

export function NetworkingDisplayPage() {
  const [, params] = useRoute('/admin/events/:id/display');
  const eventId = params?.id;
  const [event, setEvent] = React.useState<Event | null>(null);
  const [round, setRound] = React.useState<NetworkingRound | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [page, setPage] = React.useState(0);
  const [fullscreen, setFullscreen] = React.useState(false);
  const [viewportHeight, setViewportHeight] = React.useState(window.innerHeight);
  const [fullscreenError, setFullscreenError] = React.useState(false);
  const roundIdRef = React.useRef<string | null>(null);

  const loadRound = React.useCallback(async () => {
    if (!eventId) return;
    try {
      const rounds = await getNetworkingRounds(eventId);
      const latest = rounds.at(-1) ?? null;
      if (roundIdRef.current !== latest?.id) {
        roundIdRef.current = latest?.id ?? null;
        setPage(0);
      }
      setRound(latest);
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  React.useEffect(() => {
    if (!eventId) return;
    getEvent(eventId).then(setEvent).catch(() => setError(true));
    void loadRound();
    const refresh = window.setInterval(() => void loadRound(), REFRESH_MS);
    const stream = new EventSource(`/api/events/${eventId}/networking/stream`);
    stream.onmessage = () => void loadRound();
    return () => {
      window.clearInterval(refresh);
      stream.close();
    };
  }, [eventId, loadRound]);

  React.useEffect(() => {
    const updateFullscreen = () => setFullscreen(Boolean(document.fullscreenElement));
    const updateHeight = () => setViewportHeight(window.innerHeight);
    document.addEventListener('fullscreenchange', updateFullscreen);
    window.addEventListener('resize', updateHeight);
    return () => {
      document.removeEventListener('fullscreenchange', updateFullscreen);
      window.removeEventListener('resize', updateHeight);
    };
  }, []);

  const pageSize = tablesPerPage(round, viewportHeight);
  const pageCount = Math.max(1, Math.ceil((round?.groups.length ?? 0) / pageSize));
  const currentPage = Math.min(page, pageCount - 1);
  const groups = round?.groups.slice(currentPage * pageSize, (currentPage + 1) * pageSize) ?? [];

  React.useEffect(() => {
    if (pageCount <= 1) return;
    const advance = window.setInterval(() => setPage((value) => (value + 1) % pageCount), PAGE_MS);
    return () => window.clearInterval(advance);
  }, [pageCount]);

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
      setFullscreenError(false);
    } catch {
      setFullscreenError(true);
    }
  };

  const gridColumns = groups.length >= 5 || groups.length === 3
    ? 'xl:grid-cols-3'
    : groups.length >= 2
      ? 'xl:grid-cols-2'
      : 'xl:grid-cols-1';

  return (
    <main className="flex min-h-screen flex-col bg-slate-950 text-white lg:h-screen lg:overflow-hidden">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-white/15 px-5 py-4 md:px-8 xl:px-12">
        <div className="flex min-w-0 items-center gap-4">
          <img src="/cbo-logo.png" alt="CBO" className="h-12 w-12 shrink-0 rounded-lg bg-white object-contain p-1" />
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase text-cyan-300">Speed Networking</p>
            <h1 className="truncate text-2xl font-bold md:text-3xl xl:text-4xl">{event?.title ?? 'CBO Event'}</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {round && <span className="rounded-md bg-cyan-300 px-4 py-2 text-lg font-black text-slate-950 md:text-2xl">Round {round.round_number}</span>}
          <button
            type="button"
            onClick={() => void toggleFullscreen()}
            className="rounded-md border border-white/30 px-4 py-2 text-sm font-semibold text-white hover:bg-white/10"
          >
            {fullscreen ? 'Exit full screen' : 'Full screen'}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col px-5 py-5 md:px-8 xl:px-12 xl:py-8">
        {loading ? (
          <div className="flex flex-1 items-center justify-center text-2xl text-slate-300">Loading tables...</div>
        ) : !round ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <p className="text-4xl font-black md:text-6xl">Waiting for the next round</p>
            <p className="mt-5 text-xl text-slate-300 md:text-2xl">Table assignments will appear here automatically.</p>
          </div>
        ) : (
          <div className={`grid min-h-0 flex-1 auto-rows-fr grid-cols-1 gap-4 md:grid-cols-2 xl:gap-6 ${gridColumns}`}>
            {groups.map((group) => (
              <section key={group.label} className="flex min-h-0 flex-col overflow-hidden rounded-md border border-white/20 bg-white/[0.07] p-5 xl:p-6">
                <h2 className="shrink-0 border-b border-white/15 pb-3 text-3xl font-black text-cyan-300 md:text-4xl xl:text-5xl">
                  Table {group.label}
                </h2>
                <ul className={`mt-3 grid min-h-0 flex-1 content-center gap-x-5 gap-y-1.5 ${group.members.length > 10 ? 'grid-cols-2 text-lg xl:text-2xl' : 'grid-cols-1 text-xl md:text-2xl xl:text-3xl'}`}>
                  {group.members.map((member) => (
                    <li key={member.user_id} className="min-w-0 break-words font-semibold leading-tight">
                      {member.full_name ?? member.email}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      <footer className="flex min-h-14 shrink-0 items-center justify-between gap-4 border-t border-white/15 px-5 py-3 text-sm text-slate-300 md:px-8 xl:px-12">
        <span>{round ? `${round.groups.length} tables · ${round.groups.reduce((count, group) => count + group.members.length, 0)} attendees` : 'Ready for table assignments'}</span>
        {pageCount > 1 && (
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => setPage((value) => (value - 1 + pageCount) % pageCount)} className="rounded-md border border-white/30 px-3 py-1.5 font-semibold text-white hover:bg-white/10" aria-label="Previous tables">‹</button>
            <span className="font-semibold text-white">{currentPage + 1} / {pageCount}</span>
            <button type="button" onClick={() => setPage((value) => (value + 1) % pageCount)} className="rounded-md border border-white/30 px-3 py-1.5 font-semibold text-white hover:bg-white/10" aria-label="Next tables">›</button>
          </div>
        )}
        {error && <button type="button" onClick={() => void loadRound()} className="font-semibold text-amber-300 underline">Connection lost · Retry</button>}
        {fullscreenError && <span className="text-amber-300">Use your browser's full-screen control.</span>}
      </footer>
    </main>
  );
}
