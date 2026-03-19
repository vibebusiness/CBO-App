import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateProfile } from '../lib/api';
import { useAuth } from '../state/auth';

const schema = z.object({
  full_name: z.string().min(1, 'Name is required'),
  business_name: z.string().optional(),
  industry: z.string().optional(),
  phone: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

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

export function ProfilePage() {
  const { user, refresh } = useAuth();
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: user?.full_name ?? '',
      business_name: user?.business_name ?? '',
      industry: user?.industry ?? '',
      phone: user?.phone ?? '',
    },
  });

  const onSubmit = async (values: FormValues) => {
    setError(null);
    setSaved(false);
    try {
      await updateProfile({
        full_name: values.full_name,
        business_name: values.business_name || undefined,
        industry: values.industry || undefined,
        phone: values.phone || undefined,
      });
      await refresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e: unknown) {
      setError((e as Error).message ?? 'Something went wrong');
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-lg font-bold text-white">
            {user?.full_name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div>
            <div className="font-semibold text-white">{user?.full_name ?? 'Member'}</div>
            <div className="text-xs text-white/50">{user?.email}</div>
            {user?.role === 'admin' && (
              <span className="mt-1 inline-block rounded-full bg-orange-500/20 px-2 py-0.5 text-xs font-medium text-orange-300">
                Admin
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Edit form */}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <h2 className="mb-4 text-sm font-semibold text-white">Edit profile</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-white/70">
              Full name <span className="text-orange-400">*</span>
            </label>
            <input
              className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-white/30"
              placeholder="First and last name"
              {...register('full_name')}
            />
            {errors.full_name && (
              <p className="mt-1 text-xs text-red-400">{errors.full_name.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-white/70">Business name</label>
            <input
              className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-white/30"
              placeholder="Your company or brand"
              {...register('business_name')}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-white/70">Industry</label>
            <select
              className="w-full rounded-xl border border-white/10 bg-[#0b1220] px-3 py-2.5 text-sm text-white outline-none focus:border-white/30"
              {...register('industry')}
            >
              <option value="">Select industry</option>
              {INDUSTRIES.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-white/70">Phone</label>
            <input
              className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-white/30"
              placeholder="+1 (704) 555-0123"
              type="tel"
              {...register('phone')}
            />
          </div>

          {error && (
            <div className="rounded-xl bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</div>
          )}
          {saved && (
            <div className="rounded-xl bg-green-500/10 px-3 py-2 text-xs text-green-300">
              Profile saved!
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !isDirty}
            className="w-full rounded-xl bg-white py-2.5 text-sm font-semibold text-[#0b1220] disabled:opacity-40"
          >
            {isSubmitting ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </div>
    </div>
  );
}
