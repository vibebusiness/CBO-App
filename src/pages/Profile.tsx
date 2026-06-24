import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { updateProfile, uploadAvatar } from '../lib/api';
import { useAuth } from '../state/auth';

const schema = z.object({
  full_name: z.string().min(1, 'Name is required'),
  business_name: z.string().optional(),
  tagline: z.string().max(120).optional(),
  industry: z.string().optional(),
  phone: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export const INDUSTRIES = [
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
];

function isCustomIndustry(val: string) {
  return val !== '' && !INDUSTRIES.includes(val);
}

function Avatar({ user, onUpload }: {
  user: { full_name?: string | null; email?: string | null; avatar_url?: string | null };
  onUpload: (file: File) => Promise<void>;
}) {
  const [uploading, setUploading] = React.useState(false);
  const [imgError, setImgError] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setImgError(false);
    try {
      await onUpload(file);
    } finally {
      setUploading(false);
    }
  };

  const initials = user.full_name?.[0]?.toUpperCase() ?? user.email?.[0]?.toUpperCase() ?? '?';

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="group relative"
        aria-label="Change profile photo"
      >
        {user.avatar_url && !imgError ? (
          <img
            src={user.avatar_url}
            alt="Your headshot"
            className="h-20 w-20 rounded-full object-cover ring-2 ring-slate-200"
            onError={() => setImgError(true)}
          />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-2xl font-bold text-slate-700 ring-2 ring-slate-200">
            {initials}
          </div>
        )}
        {/* Overlay on hover */}
        <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 transition group-hover:opacity-100 group-disabled:opacity-0">
          <span className="text-xs font-semibold text-white">{uploading ? '…' : '✏️'}</span>
        </div>
      </button>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="text-xs font-medium text-slate-500 hover:text-slate-800 disabled:opacity-40"
      >
        {uploading ? 'Uploading…' : user.avatar_url ? 'Change photo' : '+ Add headshot'}
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
    </div>
  );
}

export function ProfilePage() {
  const { user, refresh } = useAuth();
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [avatarError, setAvatarError] = React.useState<string | null>(null);

  const initialIndustry = user?.industry ?? '';
  const [customMode, setCustomMode] = React.useState(() => isCustomIndustry(initialIndustry));

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      full_name: user?.full_name ?? '',
      business_name: user?.business_name ?? '',
      tagline: user?.tagline ?? '',
      industry: initialIndustry,
      phone: user?.phone ?? '',
    },
  });

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

  const handleAvatarUpload = async (file: File) => {
    setAvatarError(null);
    try {
      await uploadAvatar(file);
      await refresh();
      // Clear the avatar prompt dismiss flag so it also goes away
      localStorage.removeItem('cbo_avatar_prompt_dismissed');
    } catch (e: unknown) {
      setAvatarError((e as Error).message ?? 'Upload failed');
    }
  };

  const onSubmit = async (values: FormValues) => {
    setError(null);
    setSaved(false);
    try {
      await updateProfile({
        full_name: values.full_name,
        business_name: values.business_name || undefined,
        tagline: values.tagline || undefined,
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
      {/* Profile card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <Avatar user={user ?? {}} onUpload={handleAvatarUpload} />
        {avatarError && (
          <p className="mt-2 text-center text-xs text-red-500">{avatarError}</p>
        )}
        <div className="mt-3 text-center">
          <div className="font-semibold text-slate-900">{user?.full_name ?? 'Member'}</div>
          <div className="text-xs text-slate-500">{user?.email}</div>
          {user?.role === 'admin' && (
            <span className="mt-1.5 inline-block rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
              Admin
            </span>
          )}
        </div>
      </div>

      {/* Edit form */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <h2 className="mb-4 text-sm font-semibold text-slate-800">Edit profile</h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              Full name <span className="text-orange-500">*</span>
            </label>
            <input
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              placeholder="First and last name"
              {...register('full_name')}
            />
            {errors.full_name && (
              <p className="mt-1 text-xs text-red-500">{errors.full_name.message}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Business name</label>
            <input
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              placeholder="Your company or brand"
              {...register('business_name')}
            />
          </div>

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

          <div className="space-y-2">
            <label className="mb-1 block text-xs font-medium text-slate-600">Industry</label>
            <select
              value={selectValue}
              onChange={handleSelectChange}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            >
              <option value="">Select industry</option>
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

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">Phone</label>
            <input
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              placeholder="+1 (704) 555-0123"
              type="tel"
              {...register('phone')}
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
              {error}
            </div>
          )}
          {saved && (
            <div className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-700">
              Profile saved!
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting || !isDirty}
            className="w-full rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-40"
          >
            {isSubmitting ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </div>
    </div>
  );
}
