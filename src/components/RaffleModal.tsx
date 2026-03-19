import React from 'react';
import type { CheckIn } from '../types/models';
import { getRaffleParticipants, getRaffleWinners, recordRaffleWinner } from '../lib/api';

type Props = {
  eventId: string;
  eventTitle: string;
  onClose: () => void;
};

function getDisplayName(p: CheckIn): string {
  return p.full_name?.trim() || p.email || 'Unknown';
}

type Phase = 'idle' | 'spinning' | 'winner';

export function RaffleModal({ eventId, eventTitle, onClose }: Props) {
  const [participants, setParticipants] = React.useState<CheckIn[]>([]);
  const [winners, setWinners] = React.useState<CheckIn[]>([]);
  const [loading, setLoading] = React.useState(true);

  const [phase, setPhase] = React.useState<Phase>('idle');
  const [displayed, setDisplayed] = React.useState<string>('');
  const [winner, setWinner] = React.useState<CheckIn | null>(null);
  const [saving, setSaving] = React.useState(false);

  const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [p, w] = await Promise.all([
        getRaffleParticipants(eventId),
        getRaffleWinners(eventId),
      ]);
      setParticipants(p);
      setWinners(w);
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  React.useEffect(() => {
    loadData();
    return () => clearTimers();
  }, [loadData]);

  const draw = () => {
    if (participants.length === 0 || phase === 'spinning') return;

    const chosenIdx = Math.floor(Math.random() * participants.length);
    const chosen = participants[chosenIdx];
    const chosenName = getDisplayName(chosen);
    const names = participants.map(getDisplayName);

    setWinner(null);
    setPhase('spinning');

    const steps: { delay: number; interval: number }[] = [
      { delay: 0,    interval: 60  },
      { delay: 1200, interval: 100 },
      { delay: 2200, interval: 160 },
      { delay: 3000, interval: 260 },
      { delay: 3600, interval: 400 },
      { delay: 4000, interval: 600 },
    ];

    let nameIdx = 0;

    const startInterval = (intervalMs: number) => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(() => {
        nameIdx = (nameIdx + 1) % names.length;
        setDisplayed(names[nameIdx]);
      }, intervalMs);
    };

    startInterval(steps[0].interval);

    steps.slice(1).forEach(({ delay, interval }) => {
      timerRef.current = setTimeout(() => startInterval(interval), delay);
    });

    timerRef.current = setTimeout(async () => {
      clearTimers();
      setDisplayed(chosenName);
      setWinner(chosen);
      setPhase('winner');

      // Record the winner server-side immediately
      setSaving(true);
      try {
        await recordRaffleWinner(eventId, chosen.user_id);
        // Refresh winners list (participants refresh happens on "Draw again")
        const w = await getRaffleWinners(eventId);
        setWinners(w);
      } catch (e) {
        console.error('Failed to record winner', e);
      } finally {
        setSaving(false);
      }
    }, 4800);
  };

  const drawAgain = async () => {
    clearTimers();
    setPhase('idle');
    setWinner(null);
    setDisplayed('');
    // Reload participants (winner is now excluded server-side)
    setLoading(true);
    try {
      const p = await getRaffleParticipants(eventId);
      setParticipants(p);
    } finally {
      setLoading(false);
    }
  };

  const noEntries = !loading && participants.length === 0;
  const showDrawAgain = phase === 'winner' && participants.length > 1;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 backdrop-blur-sm sm:items-center">
      <div className="w-full max-w-sm overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg">🎟️</span>
              <span className="font-semibold text-slate-900">Raffle</span>
            </div>
            <p className="mt-0.5 text-xs text-slate-400 truncate max-w-[220px]">{eventTitle}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700 text-xl leading-none">✕</button>
        </div>

        {/* Body */}
        <div className="px-5 py-5">

          {loading ? (
            <div className="py-10 text-center text-sm text-slate-400">Loading…</div>
          ) : (
            <>
              {/* Counts row */}
              <div className="mb-4 flex items-center justify-center gap-4 text-center">
                <div>
                  <div className="text-2xl font-bold text-slate-900">{participants.length}</div>
                  <div className="text-xs text-slate-500">{participants.length === 1 ? 'entry' : 'entries'} left</div>
                </div>
                {winners.length > 0 && (
                  <>
                    <div className="h-8 w-px bg-slate-200" />
                    <div>
                      <div className="text-2xl font-bold text-orange-500">{winners.length}</div>
                      <div className="text-xs text-slate-500">{winners.length === 1 ? 'winner' : 'winners'}</div>
                    </div>
                  </>
                )}
              </div>

              {/* Past winners list */}
              {winners.length > 0 && (
                <div className="mb-4 rounded-xl border border-orange-100 bg-orange-50 px-3 py-2">
                  <p className="mb-1.5 text-xs font-semibold text-orange-600">🏆 Past winners</p>
                  {winners.map((w, i) => (
                    <div key={w.id} className="flex items-center gap-1.5 text-xs text-orange-700 py-0.5">
                      <span className="text-orange-400 shrink-0">{i + 1}.</span>
                      <span className="font-medium truncate">{getDisplayName(w)}</span>
                    </div>
                  ))}
                </div>
              )}

              {noEntries ? (
                <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-8 text-center">
                  {winners.length > 0
                    ? <p className="text-sm text-slate-400">All eligible members have already won.</p>
                    : <p className="text-sm text-slate-400">No check-ins yet — entries appear when members check in.</p>
                  }
                </div>
              ) : (
                <>
                  {/* Slot display */}
                  <div className={[
                    'relative flex h-28 items-center justify-center overflow-hidden rounded-2xl border-2 transition-all duration-300',
                    phase === 'winner'
                      ? 'border-orange-400 bg-orange-50'
                      : phase === 'spinning'
                      ? 'border-slate-300 bg-slate-50'
                      : 'border-slate-200 bg-slate-50',
                  ].join(' ')}>
                    <div className="pointer-events-none absolute inset-x-0 top-0 h-8 bg-gradient-to-b from-white/80 to-transparent z-10" />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white/80 to-transparent z-10" />

                    {phase === 'idle' ? (
                      <span className="text-sm text-slate-400">Press "Draw name" to start</span>
                    ) : phase === 'winner' && winner ? (
                      <div className="text-center px-4 animate-[bounceIn_0.5s_ease-out]">
                        <div className="text-2xl font-bold text-orange-600 leading-tight break-words">
                          {getDisplayName(winner)}
                        </div>
                        {winner.full_name && (
                          <div className="mt-1 text-xs text-orange-400">{winner.email}</div>
                        )}
                      </div>
                    ) : (
                      <div className="text-center px-4">
                        <div key={displayed} className="text-xl font-bold text-slate-700 animate-[fadeSlide_0.08s_ease-out]">
                          {displayed}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Winner celebration bar */}
                  {phase === 'winner' && (
                    <div className="mt-3 rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-center">
                      <p className="text-sm font-semibold text-orange-700">
                        {saving ? '⏳ Saving winner…' : '🎉 We have a winner!'}
                      </p>
                      <p className="mt-0.5 text-xs text-orange-500">
                        {saving ? 'Please wait' : 'Call out the name above'}
                      </p>
                    </div>
                  )}

                  {/* Entries list (collapsed, idle only) */}
                  {phase === 'idle' && participants.length > 0 && (
                    <details className="mt-4">
                      <summary className="cursor-pointer text-xs text-slate-400 hover:text-slate-600 select-none">
                        View all entries ({participants.length})
                      </summary>
                      <div className="mt-2 max-h-36 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50">
                        {participants.map((p, i) => (
                          <div key={p.id} className={['flex items-center gap-2 px-3 py-2 text-sm', i < participants.length - 1 ? 'border-b border-slate-100' : ''].join(' ')}>
                            <span className="text-xs text-slate-400 w-5 shrink-0 text-right">{i + 1}.</span>
                            <span className="text-slate-700 truncate">{getDisplayName(p)}</span>
                          </div>
                        ))}
                      </div>
                    </details>
                  )}
                </>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {!loading && !noEntries && (
          <div className="border-t border-slate-100 px-5 pb-5 pt-4 space-y-2">
            {phase === 'winner' ? (
              <>
                {showDrawAgain && (
                  <button
                    onClick={drawAgain}
                    disabled={saving}
                    className="w-full rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition disabled:opacity-40"
                  >
                    Draw again
                  </button>
                )}
              </>
            ) : (
              <button
                onClick={draw}
                disabled={phase === 'spinning'}
                className={[
                  'w-full rounded-xl py-3 text-sm font-semibold text-white transition',
                  phase === 'spinning'
                    ? 'bg-slate-400 cursor-not-allowed'
                    : 'bg-slate-900 hover:bg-slate-700 active:scale-95',
                ].join(' ')}
              >
                {phase === 'spinning' ? 'Drawing…' : '🎲 Draw name'}
              </button>
            )}
          </div>
        )}
      </div>

      <style>{`
        @keyframes fadeSlide {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes bounceIn {
          0%   { opacity: 0; transform: scale(0.8); }
          60%  { transform: scale(1.08); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
