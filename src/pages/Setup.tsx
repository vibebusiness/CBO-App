import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateProfile } from '../lib/api';
import { useAuth } from '../state/auth';
import { INDUSTRIES } from './Profile';

const schema = z.object({
  full_name: z.string().min(1, 'Your name is required'),
  business_name: z.string().optional(),
  tagline: z.string().max(120).optional(),
  industry: z.string().optional(),
  phone: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">
        {label}
        {required && <span className="ml-1 text-orange-500">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export function SetupPage() {
  const { refresh } = useAuth();
  const [error, setError] = React.useState<string | null>(null);
  const [customMode, setCustomMode] = React.useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const industryValue = watch('industry') ?? '';
  const taglineValue = watch('tagline') ?? '';
  const selectValue = customMode ? '__custom__' : industryValue;

  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (e.target.value === '__custom__') {
      setCustomMode(true);
      setValue('industry', '', { shouldDirty: true });
    } else {
      setCustomMode(false);
      setValue('industry', e.target.value, { shouldDirty: true });
    }
  };

  const onSubmit = async (values: FormValues) => {
    setError(null);
    try {
      await updateProfile({
        full_name: values.full_name,
        business_name: values.business_name || undefined,
        tagline: values.tagline || undefined,
        industry: values.industry || undefined,
        phone: values.phone || undefined,
      });
      await refresh();
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Something went wrong');
    }
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center overflow-hidden bg-slate-900">
      <img
        src="/charlotte-skyline.png"
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover object-right"
        style={{ filter: 'blur(8px)', transform: 'scale(1.08)' }}
      />
      <div className="absolute inset-0 bg-black/40" />

      <div className="relative z-10 mx-4 w-full max-w-sm rounded-2xl bg-white px-8 py-10 shadow-2xl">
        <div className="mb-6 flex flex-col items-center gap-3">
          <img src="/cbo-logo.png" alt="Charlotte Business Owners" className="h-14 w-auto" />
          <div className="text-center">
            <h1 className="text-lg font-semibold text-slate-800">Welcome to CBO!</h1>
            <p className="mt-1 text-xs text-slate-500">Set up your profile to get started.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Field label="Your name" required>
            <input
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              placeholder="First and last name"
              autoComplete="name"
              {...register('full_name')}
            />
            {errors.full_name && (
              <p className="mt-1 text-xs text-red-500">{errors.full_name.message}</p>
            )}
          </Field>

          <Field label="Business name" hint="Optional">
            <input
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              placeholder="Your company or brand name"
              autoComplete="organization"
              {...register('business_name')}
            />
          </Field>

          <div>
            <div className="mb-1 flex items-center justify-between">
              <label className="text-xs font-medium text-slate-600">What do you do?</label>
              <span className={['text-xs', taglineValue.length > 100 ? 'text-orange-500' : 'text-slate-400'].join(' ')}>
                {taglineValue.length}/120
              </span>
            </div>
            <input
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              placeholder="e.g. I help small businesses build their online presence"
              maxLength={120}
              {...register('tagline')}
            />
            <p className="mt-1 text-xs text-slate-400">One line shown to other members at events</p>
          </div>

          <Field label="Industry" hint="Optional — helps members connect">
            <div className="space-y-2">
              <select
                value={selectValue}
                onChange={handleSelectChange}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              >
                <option value="" disabled>Select your industry</option>
                {INDUSTRIES.map((i) => (
                  <option key={i} value={i}>{i}</option>
                ))}
                <option value="__custom__">Other — type your own</option>
              </select>
              {customMode && (
                <input
                  type="text"
                  value={industryValue}
                  onChange={(e) => setValue('industry', e.target.value, { shouldDirty: true })}
                  placeholder="e.g. Podcast Production, Interior Design…"
                  autoFocus
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
                />
              )}
            </div>
          </Field>

          <Field label="Phone number" hint="Optional — not shared publicly">
            <input
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              placeholder="+1 (704) 555-0123"
              type="tel"
              autoComplete="tel"
              {...register('phone')}
            />
          </Field>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-50"
          >
            {isSubmitting ? 'Saving…' : 'Complete profile →'}
          </button>
        </form>
      </div>
    </div>
  );
}
