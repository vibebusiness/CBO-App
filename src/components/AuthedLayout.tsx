import { Link, useLocation } from 'wouter';
import { useAuth } from '../state/auth';
import { InstallBanner } from './InstallBanner';
import { AvatarPrompt } from './AvatarPrompt';

function NavLink({ href, label, icon }: { href: string; label: string; icon: string }) {
  const [loc] = useLocation();
  const active = loc === href || (href !== '/calendar' && loc.startsWith(href));
  return (
    <Link
      href={href}
      className={[
        'flex flex-col items-center gap-0.5 px-3 py-2 text-xs font-medium transition',
        active ? 'text-slate-900' : 'text-slate-400 hover:text-slate-600',
      ].join(' ')}
    >
      <span className="text-lg leading-none">{icon}</span>
      {label}
    </Link>
  );
}

export function AuthedLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top header */}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <img src="/cbo-logo.png" alt="CBO" className="h-7 w-auto" />
            <span className="text-sm font-semibold text-slate-800">CBO</span>
          </div>
          {user && (
            <div className="flex items-center gap-2">
              <span className="hidden text-xs text-slate-500 sm:inline">
                {user.full_name ?? user.email}
              </span>
              <button
                className="rounded-xl bg-slate-100 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-200"
                onClick={signOut}
              >
                Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-md px-4 pb-28 pt-4">
        <InstallBanner />
        <AvatarPrompt />
        {children}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-around px-2 py-1">
          <NavLink href="/events" label="Events" icon="🎟️" />
          <NavLink href="/calendar" label="Calendar" icon="📅" />
          <NavLink href="/profile" label="Profile" icon="👤" />
          {user?.role === 'admin' && (
            <NavLink href="/admin" label="Admin" icon="⚙️" />
          )}
        </div>
      </nav>
    </div>
  );
}
