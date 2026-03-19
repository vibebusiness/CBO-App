import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { supabase } from '../lib/supabase';
import { Link } from 'wouter';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Use 8+ characters'),
});

type FormValues = z.infer<typeof schema>;

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-1 text-xs font-medium text-white/70">{label}</div>
      {children}
    </label>
  );
}

export function AuthPage() {
  const [mode, setMode] = React.useState<'signin' | 'signup'>('signin');
  const [msg, setMsg] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setMsg(null);
    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email: values.email,
        password: values.password,
      });
      if (error) throw error;
      setMsg('Account created. You can sign in now.');
      setMode('signin');
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: values.email,
      password: values.password,
    });
    if (error) throw error;
  };

  return (
    <div className="space-y-3">
      <Link href="/">
        <a className="inline-flex items-center gap-2 text-sm text-white/70 hover:text-white">
          ← Back
        </a>
      </Link>

      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="mb-4 flex items-baseline justify-between">
          <div>
            <div className="text-base font-semibold">{mode === 'signin' ? 'Sign in' : 'Create account'}</div>
            <div className="text-xs text-white/60">Free profile • access events • one-tap check-in</div>
          </div>
          <button
            className="text-sm text-white/80 underline"
            onClick={() => setMode((m) => (m === 'signin' ? 'signup' : 'signin'))}
            type="button"
          >
            {mode === 'signin' ? 'Sign up' : 'Sign in'}
          </button>
        </div>

        <form
          onSubmit={handleSubmit(async (v) => {
            try {
              await onSubmit(v);
            } catch (e: any) {
              setMsg(e?.message ?? 'Something went wrong');
            }
          })}
          className="space-y-3"
        >
          <Field label="Email">
            <input
              className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
              autoComplete="email"
              inputMode="email"
              {...register('email')}
            />
            {errors.email ? <div className="mt-1 text-xs text-red-300">{errors.email.message}</div> : null}
          </Field>

          <Field label="Password">
            <input
              className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white outline-none"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              type="password"
              {...register('password')}
            />
            {errors.password ? <div className="mt-1 text-xs text-red-300">{errors.password.message}</div> : null}
          </Field>

          {msg ? <div className="rounded-xl bg-white/10 px-3 py-2 text-sm text-white/80">{msg}</div> : null}

          <button
            className="w-full rounded-xl bg-white px-3 py-2 text-sm font-semibold text-[#0b1220] disabled:opacity-50"
            disabled={isSubmitting}
            type="submit"
          >
            {mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  );
}
