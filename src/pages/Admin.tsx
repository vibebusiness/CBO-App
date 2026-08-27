import { Link } from 'wouter';

const ADMIN_SECTIONS = [
  {
    href: '/admin/events',
    icon: '🎟️',
    title: 'Events',
    description: 'Create events, review future events, and look back at past events.',
  },
  {
    href: '/admin/users',
    icon: '👥',
    title: 'Users',
    description: 'Search signed-up members and confirm whether an account exists.',
  },
  {
    href: '/admin/invite',
    icon: '🔑',
    title: 'Invite Admins',
    description: 'Generate a one-time invite link for a new admin.',
  },
];

export function AdminPage() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-base font-semibold text-slate-900">Admin Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Manage the CBO app settings and records.</p>
      </div>

      <div className="space-y-3">
        {ADMIN_SECTIONS.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md active:scale-[0.99]"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-xl">
              {section.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-slate-900">{section.title}</span>
              <span className="mt-0.5 block text-xs leading-5 text-slate-500">{section.description}</span>
            </span>
            <span className="text-lg text-slate-300">›</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
