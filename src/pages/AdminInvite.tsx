import React from 'react';
import { useLocation } from 'wouter';
import { createInviteLink } from '../lib/api';

export function AdminInvitePage() {
  const [, navigate] = useLocation();
  const [inviteLink, setInviteLink] = React.useState<string | null>(null);

  const handleGenerateInvite = async () => {
    try {
      const res = await createInviteLink();
      setInviteLink(`${window.location.origin}${res.link}`);
    } catch (e) {
      alert((e as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <button
        onClick={() => navigate('/admin')}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
      >
        ← Back to admin
      </button>

      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div>
          <h1 className="font-medium text-slate-900">Invite an admin</h1>
          <p className="mt-1 text-sm text-slate-500">
            Generate a one-time invite link. Anyone who signs up with this link will be granted admin access.
          </p>
        </div>
        <button onClick={handleGenerateInvite} className="w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white transition hover:bg-slate-700">
          Generate invite link
        </button>
        {inviteLink && (
          <div className="space-y-2">
            <p className="text-xs text-slate-500">Share this link (one-time use):</p>
            <div className="flex gap-2">
              <input readOnly value={inviteLink} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 outline-none" />
              <button onClick={() => navigator.clipboard.writeText(inviteLink)} className="shrink-0 rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50">
                Copy
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
