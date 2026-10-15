import React from 'react';
import { useRoute } from 'wouter';
import { getNetworkingRounds } from '../lib/api';
import type { NetworkingRound } from '../types/models';

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
  return 8;
}

export function NetworkingDisplayPage() {
  const [, params] = useRoute('/admin/events/:id/display');
  const eventId = params?.id;
  const [round, setRound] = React.useState<NetworkingRound | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);
  const [page, setPage] = React.useState(0);
  const [viewportHeight, setViewportHeight] = React.useState(window.innerHeight);
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
    const updateHeight = () => setViewportHeight(window.innerHeight);
    window.addEventListener('resize', updateHeight);
    return () => {
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
    } catch {
      // The browser's full-screen control remains available when the API is blocked.
    }
  };

  const gridColumns = groups.length >= 7
    ? 'xl:grid-cols-4'
    : groups.length >= 5 || groups.length === 3
    ? 'xl:grid-cols-3'
    : groups.length >= 2
      ? 'xl:grid-cols-2'
      : 'xl:grid-cols-1';

  return (
    <main className="relative flex min-h-screen flex-col bg-slate-100 text-slate-950 lg:h-screen lg:overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col p-4 md:p-6 xl:p-8">
        {loading ? (
          <div className="flex flex-1 items-center justify-center text-2xl text-slate-600">Loading tables...</div>
        ) : !round ? (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <p className="text-4xl font-black md:text-6xl">Waiting for the next round</p>
            <p className="mt-5 text-xl text-slate-600 md:text-2xl">Table assignments will appear here automatically.</p>
          </div>
        ) : (
          <div className={`grid min-h-0 flex-1 auto-rows-fr grid-cols-1 gap-4 md:grid-cols-2 xl:gap-5 ${gridColumns}`}>
            {groups.map((group) => (
              <section key={group.label} className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:p-6">
                <h2 className="shrink-0 border-b-2 border-slate-200 pb-3 text-3xl font-black text-teal-800 md:text-4xl xl:text-5xl">
                  Table {group.label}
                </h2>
                <ul className={`mt-3 grid min-h-0 flex-1 content-center gap-x-5 gap-y-2 ${group.members.length > 10 ? 'grid-cols-2 text-lg xl:text-2xl' : 'grid-cols-1 text-xl md:text-2xl xl:text-3xl'}`}>
                  {group.members.map((member) => (
                    <li key={member.user_id} className="min-w-0 break-words font-extrabold leading-tight">
                      {member.full_name ?? member.email}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      <div className="absolute bottom-3 right-3 z-10 flex items-center gap-2 rounded-lg bg-white/95 p-1 shadow-md opacity-0 transition-opacity hover:opacity-100 focus-within:opacity-100">
        {pageCount > 1 && (
          <>
            <button type="button" onClick={() => setPage((value) => (value - 1 + pageCount) % pageCount)} className="rounded-md px-3 py-1.5 text-xl font-bold text-slate-700 hover:bg-slate-100" aria-label="Previous tables" title="Previous tables">‹</button>
            <button type="button" onClick={() => setPage((value) => (value + 1) % pageCount)} className="rounded-md px-3 py-1.5 text-xl font-bold text-slate-700 hover:bg-slate-100" aria-label="Next tables" title="Next tables">›</button>
          </>
        )}
        <button type="button" onClick={() => void toggleFullscreen()} className="rounded-md px-3 py-1.5 text-xl font-bold text-slate-700 hover:bg-slate-100" aria-label="Toggle full screen" title="Toggle full screen">⛶</button>
        {error && <button type="button" onClick={() => void loadRound()} className="rounded-md px-3 py-1.5 text-xl font-bold text-red-700 hover:bg-red-50" aria-label="Retry connection" title="Retry connection">↻</button>}
      </div>
    </main>
  );
}
