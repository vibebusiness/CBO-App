import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateProfile } from '../lib/api';
import { useAuth } from '../state/auth';

const schema = z.object({
  full_name: z.string().min(1, 'Your name is required'),
  business_name: z.string().optional(),
  industry: z.string().optional(),
  phone: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

function Field({
  label,
  required,
  children,
  hint,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-white/80">
        {label}
        {required && <span className="ml-1 text-orange-400">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-white/40">{hint}</p>}
    </div>
  );
}

const INDUSTRIES = [
  'Consulting',
  'Finance & Accounting',
  'Health & Wellness',
  'Legal',
  'Marketing & PR',
  'Real Estate',
  'Retail',
  'Technology',
  'Food & Beverage',
  'Construction & Trades',
  'Education',
  'Non-profit',
  'Other',
];

export function SetupPage() {
  const { refresh } = useAuth();
  const [error, setError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const onSubmit = async (values: FormValues) => {
    setError(null);
    try {
      await updateProfile({
        full_name: values.full_name,
        business_name: values.business_name || undefined,
        industry: values.industry || undefined,
        phone: values.phone || undefined,
      });
      await refresh();
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Something went wrong');
    }
  };

  return (
    <div className="min-h-screen bg-[#0b1220] px-4 py-10">
      <div className="mx-auto max-w-md">
        {/* Header */}
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <img src="/cbo-logo.png" alt="CBO" className="h-14 w-auto" />
          <div>
            <h1 className="text-xl font-bold text-white">Welcome to CBO!</h1>
            <p className="mt-1 text-sm text-white/60">
              Set up your profile to get started. It only takes a minute.
            </p>
          </div>
        </div>

        {/* Form card */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <Field label="Your name" required>
              <input
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20"
                placeholder="First and last name"
                autoComplete="name"
                {...register('full_name')}
              />
              {errors.full_name && (
                <p className="mt-1 text-xs text-red-400">{errors.full_name.message}</p>
              )}
            </Field>

            <Field label="Business name" hint="Optional — shown on your profile">
              <input
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20"
                placeholder="Your company or brand name"
                autoComplete="organization"
                {...register('business_name')}
              />
            </Field>

            <Field label="Industry" hint="Optional — helps members connect">
              <select
                className="w-full rounded-xl border border-white/10 bg-[#0b1220] px-4 py-3 text-sm text-white outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20"
                {...register('industry')}
                defaultValue=""
              >
                <option value="" disabled className="text-white/40">
                  Select your industry
                </option>
                {INDUSTRIES.map((i) => (
                  <option key={i} value={i}>
                    {i}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Phone number" hint="Optional — not shared publicly">
              <input
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/30 outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20"
                placeholder="+1 (704) 555-0123"
                type="tel"
                autoComplete="tel"
                {...register('phone')}
              />
            </Field>

            {error && (
              <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-xl bg-white py-3 text-sm font-semibold text-[#0b1220] transition hover:bg-white/90 disabled:opacity-50"
            >
              {isSubmitting ? 'Saving…' : 'Complete profile →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
