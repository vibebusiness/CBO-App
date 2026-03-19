import { Link, useLocation } from 'wouter';
import { useAuth } from '../state/auth';

function NavLink({ href, label, icon }: { href: string; label: string; icon: string }) {
  const [loc] = useLocation();
  const active = loc === href || (href !== '/calendar' && loc.startsWith(href));
  return (
    <Link href={href}>
      <a
        className={[
          'flex flex-col items-center gap-0.5 px-3 py-2 text-xs font-medium transition',
          active ? 'text-white' : 'text-white/50 hover:text-white/80',
        ].join(' ')}
      >
        <span className="text-lg leading-none">{icon}</span>
        {label}
      </a>
    </Link>
  );
}

export function AuthedLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();

  return (
    <div className="min-h-screen bg-[#0b1220]">
      {/* Top header */}
      <header className="sticky top-0 z-10 border-b border-white/5 bg-[#0b1220]/95 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <img src="/cbo-logo.png" alt="CBO" className="h-7 w-auto" />
            <span className="text-sm font-semibold text-white">CBO</span>
          </div>
          {user && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/40 hidden sm:inline">
                {user.full_name ?? user.email}
              </span>
              <button
                className="rounded-xl bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/20"
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
        {children}
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 border-t border-white/10 bg-[#0b1220]/95 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-around px-2 py-1">
          <NavLink href="/calendar" label="Calendar" icon="📅" />
          <NavLink href="/events" label="Events" icon="🎟️" />
          <NavLink href="/profile" label="Profile" icon="👤" />
          {user?.role === 'admin' && (
            <NavLink href="/admin" label="Admin" icon="⚙️" />
          )}
        </div>
      </nav>
    </div>
  );
}
