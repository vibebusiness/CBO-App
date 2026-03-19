import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '../lib/supabase';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Use 8+ characters'),
});

type FormValues = z.infer<typeof schema>;

export function AuthPage() {
  const [mode, setMode] = React.useState<'signin' | 'signup'>('signin');
  const [msg, setMsg] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const switchMode = (next: 'signin' | 'signup') => {
    setMode(next);
    setMsg(null);
    reset();
  };

  const onSubmit = async (values: FormValues) => {
    setMsg(null);
    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
      });
      if (error) throw error;
      setMsg('Account created — check your email to confirm, then sign in.');
      switchMode('signin');
      return;
    }
    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });
    if (error) throw error;
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-slate-900">
      {/* Charlotte skyline — blurred and zoomed to soften baked-in text */}
      <img
        src="/charlotte-skyline.png"
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover object-right"
        style={{ filter: 'blur(8px)', transform: 'scale(1.08)' }}
      />
      {/* Dark overlay for contrast */}
      <div className="absolute inset-0 bg-black/40" />

      {/* Card */}
      <div className="relative z-10 w-full max-w-sm mx-4 rounded-2xl bg-white px-8 py-10 shadow-2xl">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 mb-8">
          <img
            src="/cbo-logo.png"
            alt="Charlotte Business Owners"
            className="h-16 w-auto"
          />
          <div className="text-center">
            <p className="text-xs font-medium tracking-wider text-slate-400 uppercase">
              Connect • Collaborate • Grow
            </p>
          </div>
        </div>

        {/* Headline */}
        <h1 className="text-center text-lg font-semibold text-slate-800 mb-6">
          Sign up or log in to the CBO community
        </h1>

        {/* Mode tabs */}
        <div className="flex rounded-xl bg-slate-100 p-1 mb-6">
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

        {/* Form */}
        <form
          onSubmit={handleSubmit(async (v) => {
            try {
              await onSubmit(v);
            } catch (e: unknown) {
              const err = e as { message?: string };
              setMsg(err?.message ?? 'Something went wrong. Please try again.');
            }
          })}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Email
            </label>
            <input
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              autoComplete="email"
              inputMode="email"
              placeholder="you@example.com"
              {...register('email')}
            />
            {errors.email ? (
              <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>
            ) : null}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Password
            </label>
            <input
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              type="password"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              placeholder="8+ characters"
              {...register('password')}
            />
            {errors.password ? (
              <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>
            ) : null}
          </div>

          {msg ? (
            <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 text-sm text-slate-700">
              {msg}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
          >
            {isSubmitting
              ? 'Please wait…'
              : mode === 'signin'
              ? 'Log in'
              : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  );
}
