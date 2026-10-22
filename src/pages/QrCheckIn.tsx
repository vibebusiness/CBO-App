import React from 'react';
import { Link, useRoute } from 'wouter';
import { completeQrCheckIn } from '../lib/qrCheckIn';
import { useAuth } from '../state/auth';

export function QrCheckInPage() {
  const [, params] = useRoute('/checkin/:id');
  const { user } = useAuth();
  const id = params?.id;
  const [attempt, setAttempt] = React.useState(0);
  const [result, setResult] = React.useState<Awaited<ReturnType<typeof completeQrCheckIn>> | null>(null);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    let active = true;
    if (!id) return;
    completeQrCheckIn(id).then(data => { if (active) setResult(data); })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : 'Check-in failed. Please try again.'); });
    return () => { active = false; };
  }, [id, user?.id, attempt]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <section className="w-full max-w-lg rounded-3xl bg-white p-8 text-center shadow-lg">
        <img src="/cbo-logo.png" alt="Charlotte Business Owners" className="mx-auto mb-6 h-24 w-24 object-contain" />
        {error ? <div role="alert">
          <h1 className="text-2xl font-bold">We couldn’t check you in</h1>
          <p className="mt-4 text-slate-600">{error}</p>
          <button onClick={() => { setError(''); setAttempt(value => value + 1); }} className="mt-6 rounded-xl bg-slate-900 px-6 py-3 font-bold text-white">Try again</button>
        </div> : result ? <div role="status">
          <div className="text-5xl text-green-600" aria-hidden="true">✓</div>
          <h1 className="mt-4 text-3xl font-black">{result.alreadyCheckedIn ? 'You’re already checked in!' : 'You’re checked in!'}</h1>
          <p className="mt-4 text-xl font-semibold">{result.event.title}</p>
          <p className="mt-2 text-slate-600">{user?.full_name}, your attendance is recorded.</p>
        </div> : <p role="status" className="text-xl font-bold">Checking you in…</p>}
        {(result || error) && <Link href={`/events/${id}?checkin=1`} className="mt-6 block font-semibold text-blue-700 underline">View event</Link>}
      </section>
    </main>
  );
}
