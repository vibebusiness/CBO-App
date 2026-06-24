import React from 'react';
import { uploadAvatar } from '../lib/api';
import { useAuth } from '../state/auth';

const DISMISSED_KEY = 'cbo_avatar_prompt_dismissed';

export function AvatarPrompt() {
  const { user, refresh } = useAuth();
  const [dismissed, setDismissed] = React.useState(
    () => !!localStorage.getItem(DISMISSED_KEY)
  );
  const [uploading, setUploading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  if (dismissed || user?.avatar_url) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, '1');
    setDismissed(true);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await uploadAvatar(file);
      await refresh();
      // Banner disappears automatically once user.avatar_url is set
    } catch (err: unknown) {
      setError((err as Error).message ?? 'Upload failed');
      setUploading(false);
    }
  };

  return (
    <div className="mx-auto mb-3 max-w-md overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-start gap-3 px-4 pt-4">
        {/* Ghost avatar */}
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xl text-slate-400">
          👤
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">Add your headshot</p>
          <p className="mt-0.5 text-xs text-slate-500 leading-relaxed">
            Make it easier for people to find you at events — your photo shows on the attendee list.
          </p>
        </div>
        <button
          onClick={dismiss}
          className="ml-1 shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          aria-label="Dismiss"
        >
          ✕
        </button>
      </div>

      {error && (
        <p className="mx-4 mt-2 text-xs text-red-500">{error}</p>
      )}

      <div className="flex gap-2 px-4 pb-4 pt-3">
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex-1 rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-40"
        >
          {uploading ? 'Uploading…' : '📷 Add photo'}
        </button>
        <button
          onClick={dismiss}
          className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-500 transition hover:bg-slate-50"
        >
          Later
        </button>
      </div>

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
