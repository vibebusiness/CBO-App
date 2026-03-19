import { Link, useLocation } from 'wouter';
import { supabase } from '../lib/supabase';
import { useAuth } from '../state/auth';

function NavLink({ href, label }: { href: string; label: string }) {
  const [loc] = useLocation();
  const active = loc === href;
  return (
    <Link href={href}>
      <a
        className={
          'block rounded-xl px-3 py-2 text-sm font-medium ' +
          (active ? 'bg-white/10 text-white' : 'text-white/80 hover:bg-white/5')
        }
      >
        {label}
      </a>
    </Link>
  );
}

export function AuthedLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  return (
    <div className="min-h-full">
      <div className="mx-auto max-w-md px-4 pb-24 pt-4">
        <header className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold">CBO Events</div>
            <div className="text-xs text-white/60">Mobile-first check-in MVP</div>
          </div>
          {user ? (
            <button
              className="rounded-xl bg-white/10 px-3 py-2 text-sm text-white"
              onClick={() => supabase.auth.signOut()}
            >
              Sign out
            </button>
          ) : null}
        </header>

        <main>{children}</main>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 border-t border-white/10 bg-[#0b1220]/95 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-around px-2 py-2">
          <NavLink href="/calendar" label="Calendar" />
          <NavLink href="/events" label="Events" />
          <NavLink href="/profile" label="Profile" />
          <NavLink href="/admin" label="Admin" />
        </div>
      </nav>
    </div>
  );
}
