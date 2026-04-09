import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { signIn, signUp, setToken, forgotPassword } from '../lib/api';
import { useAuth } from '../state/auth';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Use 8+ characters'),
});

type FormValues = z.infer<typeof schema>;

export function AuthPage() {
  const params = new URLSearchParams(window.location.search);
  const inviteToken = params.get('invite');
  const hasInvite = !!inviteToken;

  const [mode, setMode] = React.useState<'signin' | 'signup'>(hasInvite ? 'signup' : 'signin');
  const [msg, setMsg] = React.useState<string | null>(null);
  const [showForgot, setShowForgot] = React.useState(false);
  const [forgotEmail, setForgotEmail] = React.useState('');
  const [forgotStatus, setForgotStatus] = React.useState<'idle' | 'sending' | 'sent'>('idle');
  const { refresh } = useAuth();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const switchMode = (next: 'signin' | 'signup') => {
    setMode(next);
    setMsg(null);
    setShowForgot(false);
    setForgotStatus('idle');
    reset();
  };

  const onSubmit = async (values: FormValues) => {
    setMsg(null);
    try {
      if (mode === 'signup') {
        const res = await signUp(values.email, values.password, inviteToken ?? undefined);
        setToken(res.token);
        await refresh();
      } else {
        const res = await signIn(values.email, values.password);
        setToken(res.token);
        await refresh();
      }
    } catch (e: unknown) {
      const err = e as { message?: string };
      setMsg(err?.message ?? 'Something went wrong. Please try again.');
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotStatus('sending');
    try {
      await forgotPassword(forgotEmail.trim());
    } catch {
      // Always show success to avoid revealing whether email exists
    }
    setForgotStatus('sent');
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-slate-900">
      {/* Charlotte skyline */}
      <img
        src="/charlotte-skyline.png"
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover object-right"
        style={{ filter: 'blur(8px)', transform: 'scale(1.08)' }}
      />
      <div className="absolute inset-0 bg-black/40" />

      {/* Card */}
      <div className="relative z-10 mx-4 w-full max-w-sm rounded-2xl bg-white px-8 py-10 shadow-2xl">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <img src="/cbo-logo.png" alt="Charlotte Business Owners" className="h-16 w-auto" />
          <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
            Connect • Collaborate • Grow
          </p>
        </div>

        {/* Invite banner */}
        {hasInvite && (
          <div className="mb-4 rounded-xl bg-orange-50 border border-orange-200 px-3 py-2 text-center text-xs text-orange-700">
            You've been invited as an admin — create your account below.
          </div>
        )}

        <h1 className="mb-6 text-center text-lg font-semibold text-slate-800">
          Sign up or log in to the CBO community
        </h1>

        {/* Mode tabs */}
        <div className="mb-6 flex rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => switchMode('signin')}
            className={
              'flex-1 rounded-lg py-2 text-sm font-medium transition-colors ' +
              (mode === 'signin'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700')
            }
          >
            Log in
          </button>
          <button
            type="button"
            onClick={() => switchMode('signup')}
            className={
              'flex-1 rounded-lg py-2 text-sm font-medium transition-colors ' +
              (mode === 'signup'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700')
            }
          >
            Sign up
          </button>
        </div>

        {/* Forgot password panel */}
        {showForgot ? (
          <div>
            {forgotStatus === 'sent' ? (
              <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-4 text-center">
                <div className="mb-1 text-2xl">📬</div>
                <p className="text-sm font-medium text-slate-800">Check your email</p>
                <p className="mt-1 text-xs text-slate-500">
                  If that address is in our system, a reset link is on its way. Check your inbox (and spam folder).
                </p>
              </div>
            ) : (
              <form onSubmit={handleForgot} className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-600">Your email address</label>
                  <input
                    type="email"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                    placeholder="you@example.com"
                    autoComplete="email"
                    inputMode="email"
                    required
                  />
                </div>
                <button
                  type="submit"
                  disabled={forgotStatus === 'sending'}
                  className="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
                >
                  {forgotStatus === 'sending' ? 'Sending…' : 'Send reset link'}
                </button>
              </form>
            )}
            <button
              type="button"
              onClick={() => { setShowForgot(false); setForgotStatus('idle'); setForgotEmail(''); }}
              className="mt-3 w-full text-center text-xs text-slate-500 hover:text-slate-700"
            >
              ← Back to log in
            </button>
          </div>
        ) : (
          /* Main login / signup form */
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">Email</label>
              <input
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                autoComplete="email"
                inputMode="email"
                placeholder="you@example.com"
                {...register('email')}
              />
              {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-medium text-slate-600">Password</label>
                {mode === 'signin' && (
                  <button
                    type="button"
                    onClick={() => setShowForgot(true)}
                    className="text-xs text-slate-500 hover:text-slate-800"
                  >
                    Forgot password?
                  </button>
                )}
              </div>
              <input
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                type="password"
                autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                placeholder="8+ characters"
                {...register('password')}
              />
              {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>}
            </div>

            {msg && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-700">
                {msg}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
            >
              {isSubmitting ? 'Please wait…' : mode === 'signin' ? 'Log in' : 'Create account'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
