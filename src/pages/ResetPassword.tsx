import React from 'react';
import { useLocation } from 'wouter';
import { validateResetToken, resetPassword } from '../lib/api';

export function ResetPasswordPage() {
  const [, navigate] = useLocation();
  const token = new URLSearchParams(window.location.search).get('token') ?? '';

  const [status, setStatus] = React.useState<'validating' | 'valid' | 'invalid' | 'submitting' | 'done'>('validating');
  const [password, setPassword] = React.useState('');
  const [confirm, setConfirm] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!token) { setStatus('invalid'); return; }
    validateResetToken(token).then(({ valid }) => {
      setStatus(valid ? 'valid' : 'invalid');
    }).catch(() => setStatus('invalid'));
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setStatus('submitting');
    try {
      await resetPassword(token, password);
      setStatus('done');
      setTimeout(() => navigate('/?reset=1'), 2500);
    } catch (e: unknown) {
      const err = e as { message?: string };
      setError(err?.message ?? 'Something went wrong. Please try again.');
      setStatus('valid');
    }
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-slate-900">
      {/* Charlotte skyline */}
      <img
        src="/charlotte-skyline-clean.jpg"
        width={1280}
        height={853}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover object-right"
        style={{ filter: 'blur(8px)', transform: 'scale(1.08)' }}
      />
      <div className="absolute inset-0 bg-black/40" />

      {/* Card */}
      <div className="relative z-10 mx-4 w-full max-w-sm rounded-2xl bg-white px-8 py-10 shadow-2xl">
        {/* Logo */}
        <div className="mb-6 flex flex-col items-center gap-3">
          <img src="/cbo-logo.png" alt="Charlotte Business Owners" className="h-14 w-auto" />
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
            Connect • Collaborate • Grow
          </p>
        </div>

        {status === 'validating' && (
          <div className="py-6 text-center text-sm text-slate-400">Verifying link…</div>
        )}

        {status === 'invalid' && (
          <div className="text-center">
            <div className="mb-3 text-4xl">⚠️</div>
            <h2 className="mb-2 text-base font-semibold text-slate-900">Link expired or invalid</h2>
            <p className="mb-4 text-sm text-slate-500">
              This reset link has already been used or has expired (links are valid for 1 hour).
            </p>
            <button
              onClick={() => navigate('/')}
              className="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Back to log in
            </button>
          </div>
        )}

        {(status === 'valid' || status === 'submitting') && (
          <div>
            <h2 className="mb-1 text-center text-lg font-semibold text-slate-800">Set a new password</h2>
            <p className="mb-5 text-center text-xs text-slate-500">Choose a strong password of at least 8 characters.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">New password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="8+ characters"
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                  required
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Confirm new password</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Same password again"
                  autoComplete="new-password"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                  required
                />
              </div>
              {error && (
                <p className="text-xs text-red-500">{error}</p>
              )}
              <button
                type="submit"
                disabled={status === 'submitting'}
                className="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
              >
                {status === 'submitting' ? 'Saving…' : 'Set new password'}
              </button>
            </form>
          </div>
        )}

        {status === 'done' && (
          <div className="text-center">
            <div className="mb-3 text-4xl">✅</div>
            <h2 className="mb-2 text-base font-semibold text-slate-900">Password updated!</h2>
            <p className="text-sm text-slate-500">Redirecting you to log in…</p>
          </div>
        )}
      </div>
    </div>
  );
}
