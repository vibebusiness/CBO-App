import React from 'react';
import { Link, useLocation, useRoute } from 'wouter';
import { getAdminUser, getAdminUsers, type AdminUserDetail, type AdminUserSummary } from '../lib/api';
import { fmtET } from '../lib/tz';

function BackButton({ to, label }: { to: string; label: string }) {
  const [, navigate] = useLocation();
  return (
    <button
      onClick={() => navigate(to)}
      className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
    >
      ← {label}
    </button>
  );
}

function UserAvatar({ user }: { user: Pick<AdminUserSummary, 'avatar_url' | 'full_name' | 'email'> }) {
  const initials = (user.full_name ?? user.email)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  if (user.avatar_url) {
    return <img src={user.avatar_url} alt="" className="h-11 w-11 rounded-xl object-cover" />;
  }

  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-semibold text-slate-500">
      {initials || '?'}
    </span>
  );
}

function UserCard({ user }: { user: AdminUserSummary }) {
  return (
    <Link
      href={`/admin/users/${user.id}`}
      className="block rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md active:scale-[0.99]"
    >
      <div className="flex gap-3">
        <UserAvatar user={user} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-900">{user.full_name ?? 'No name yet'}</div>
              <div className="truncate text-xs text-slate-500">{user.email}</div>
            </div>
            <span className={[
              'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
              user.role === 'admin' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600',
            ].join(' ')}>
              {user.role}
            </span>
          </div>
          {(user.business_name || user.industry) && (
            <div className="mt-2 text-xs leading-5 text-slate-500">
              {[user.business_name, user.industry].filter(Boolean).join(' · ')}
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5 text-xs text-slate-500">
            <span className="rounded-full bg-slate-50 px-2 py-1">{user.checkin_count} check-ins</span>
            {user.last_event_title && (
              <span className="max-w-full truncate rounded-full bg-slate-50 px-2 py-1">
                Last: {user.last_event_title}
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

export function AdminUsersPage() {
  const [query, setQuery] = React.useState('');
  const [users, setUsers] = React.useState<AdminUserSummary[]>([]);
  const [total, setTotal] = React.useState(0);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const handle = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      getAdminUsers(query)
        .then((result) => {
          setUsers(result.users);
          setTotal(result.total);
        })
        .catch(() => setError('We could not load users. Please try again.'))
        .finally(() => setLoading(false));
    }, 250);

    return () => window.clearTimeout(handle);
  }, [query]);

  return (
    <div className="space-y-4">
      <BackButton to="/admin" label="Back to admin" />

      <div>
        <h1 className="text-base font-semibold text-slate-900">Users</h1>
        <p className="mt-1 text-sm text-slate-500">Search signed-up accounts by email, name, business, phone, or industry.</p>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <label className="mb-1 block text-xs font-medium text-slate-600">Find a user</label>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Email, name, business, phone..."
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
          autoComplete="off"
        />
      </div>

      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{loading ? 'Searching...' : `${total} signed-up ${total === 1 ? 'user' : 'users'}`}</span>
        {users.length > 0 && total > users.length && <span>Showing first {users.length}</span>}
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-slate-400">Loading users…</div>
      ) : users.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-400 shadow-sm">
          No signed-up users found.
        </div>
      ) : (
        <div className="space-y-3">
          {users.map((user) => <UserCard key={user.id} user={user} />)}
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border-b border-slate-100 py-3 last:border-b-0">
      <div className="text-xs font-medium text-slate-400">{label}</div>
      <div className="mt-1 break-words text-sm text-slate-800">{value || '—'}</div>
    </div>
  );
}

export function AdminUserDetailPage() {
  const [, params] = useRoute('/admin/users/:id');
  const [, navigate] = useLocation();
  const id = params?.id;
  const [user, setUser] = React.useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [notFound, setNotFound] = React.useState(false);

  React.useEffect(() => {
    if (!id) return;
    getAdminUser(id)
      .then(setUser)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-sm text-slate-400">Loading user…</div>
      </div>
    );
  }

  if (notFound || !user) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <div className="text-sm text-slate-500">User not found</div>
        <button onClick={() => navigate('/admin/users')} className="text-sm text-slate-900 underline">
          Back to users
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <BackButton to="/admin/users" label="Back to users" />

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <UserAvatar user={user} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold text-slate-900">{user.full_name ?? 'No name yet'}</h1>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
          </div>
          <span className={[
            'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
            user.role === 'admin' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600',
          ].join(' ')}>
            {user.role}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-slate-50 px-3 py-2 text-center">
            <div className="text-lg font-bold text-slate-900">{user.checkin_count}</div>
            <div className="text-xs text-slate-400">check-ins</div>
          </div>
          <div className="rounded-xl bg-slate-50 px-3 py-2 text-center">
            <div className="truncate text-sm font-semibold text-slate-900">{user.last_event_title ?? 'None'}</div>
            <div className="text-xs text-slate-400">last event</div>
          </div>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white px-4 shadow-sm">
        <DetailRow label="Email" value={user.email} />
        <DetailRow label="Phone" value={user.phone} />
        <DetailRow label="Business" value={user.business_name} />
        <DetailRow label="Industry" value={user.industry} />
        <DetailRow label="Tagline" value={user.tagline} />
        <DetailRow label="Signed up" value={fmtET(user.created_at, 'MMM d yyyy h:mm a')} />
        <DetailRow label="Last check-in" value={user.last_checkin_at ? fmtET(user.last_checkin_at, 'MMM d yyyy h:mm a') : null} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Check-in history</h2>
        {user.checkins.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-400 shadow-sm">
            No check-ins yet.
          </div>
        ) : (
          <div className="space-y-2">
            {user.checkins.map((checkin) => (
              <Link
                key={`${checkin.event_id}-${checkin.checked_in_at}`}
                href={`/events/${checkin.event_id}`}
                className="block rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-slate-900">{checkin.event_title}</div>
                    <div className="text-xs text-slate-500">
                      Event: {fmtET(checkin.event_start_at, 'MMM d yyyy h:mm a')} ET
                    </div>
                    <div className="text-xs text-slate-400">
                      Checked in: {fmtET(checkin.checked_in_at, 'MMM d yyyy h:mm a')} ET
                    </div>
                  </div>
                  <span className={[
                    'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                    checkin.event_status === 'published' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700',
                  ].join(' ')}>
                    {checkin.event_status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
