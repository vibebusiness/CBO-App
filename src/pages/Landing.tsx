import { Link } from 'wouter';

function Button({
  href,
  children,
  variant = 'primary',
}: {
  href: string;
  children: React.ReactNode;
  variant?: 'primary' | 'ghost';
}) {
  const base =
    'inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition active:scale-[0.99]';
  const styles =
    variant === 'primary'
      ? 'bg-white text-[#0b1220] hover:bg-white/90'
      : 'bg-white/10 text-white hover:bg-white/15';
  return (
    <Link href={href}>
      <a className={`${base} ${styles}`}>{children}</a>
    </Link>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
      <div className="text-sm font-semibold">{title}</div>
      <div className="mt-1 text-sm text-white/70">{children}</div>
    </div>
  );
}

function Pillar({ n, title }: { n: number; title: string }) {
  return (
    <div className="flex items-start gap-3 rounded-3xl border border-white/10 bg-black/20 p-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-sm font-semibold">
        {n}
      </div>
      <div>
        <div className="text-sm font-semibold">{title}</div>
      </div>
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="space-y-10 pb-6">
      {/* Top bar */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img
            src="/cbo-logo.png"
            alt="Charlotte Business Owners"
            className="h-10 w-auto rounded-xl bg-white p-1"
          />
          <div>
            <div className="text-sm font-semibold">Charlotte Business Owners</div>
            <div className="text-xs text-white/60">Events • Community • Growth</div>
          </div>
        </div>
        <div className="hidden items-center gap-2 sm:flex">
          <Button href="/auth" variant="ghost">
            Sign in
          </Button>
          <Button href="/auth">Sign up</Button>
        </div>
      </header>

      {/* Hero */}
      <section className="space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
          <span className="h-2 w-2 rounded-full bg-[#f58220]" />
          Built for mobile check-ins
        </div>
        <h1 className="text-3xl font-semibold leading-tight tracking-tight">
          You don’t have to build alone. <span className="text-white/70">Find your circle. Grow your dream.</span>
        </h1>
        <p className="text-base text-white/70">
          Charlotte Business Owners is where serious entrepreneurs connect, collaborate, and grow through real relationships,
          expert support, and high-energy events across Charlotte.
        </p>

        <div className="flex gap-3">
          <Button href="/auth">Sign up free</Button>
          <Button href="/auth" variant="ghost">
            Sign in
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-3 pt-2">
          <div className="rounded-3xl border border-white/10 bg-white/5 p-3">
            <div className="text-lg font-semibold">23k+</div>
            <div className="text-xs text-white/60">Local owners (site claim)</div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-3">
            <div className="text-lg font-semibold">Weekly</div>
            <div className="text-xs text-white/60">Training + accountability</div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/5 p-3">
            <div className="text-lg font-semibold">Events</div>
            <div className="text-xs text-white/60">Networking that matters</div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="space-y-3">
        <div>
          <div className="text-sm font-semibold">What you’ll get</div>
          <div className="text-sm text-white/60">Practical support that turns relationships into results.</div>
        </div>
        <div className="grid gap-3">
          <Card title="Exclusive networking events">
            Meet Charlotte business owners in-person and build relationships that actually lead somewhere.
          </Card>
          <Card title="Workshops & lunch-and-learns">
            Sharpen your skills with education focused on real operator problems.
          </Card>
          <Card title="Accountability + momentum">
            Weekly meetings and monthly challenges to keep you moving.
          </Card>
          <Card title="Perks + partner discounts">
            Group discounts on tools and services to strengthen your bottom line.
          </Card>
        </div>
      </section>

      {/* 4 pillars */}
      <section className="space-y-3">
        <div>
          <div className="text-sm font-semibold">The 4 Pillars</div>
          <div className="text-sm text-white/60">A simple framework for building a business that supports your life.</div>
        </div>
        <div className="grid gap-3">
          <Pillar n={1} title="Mindset, vision, mission & goals" />
          <Pillar n={2} title="Marketing & sales" />
          <Pillar n={3} title="Systems & teams" />
          <Pillar n={4} title="Financials" />
        </div>
      </section>

      {/* Events CTA */}
      <section className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 to-black/20 p-5">
        <div className="text-sm font-semibold">Ready to get connected?</div>
        <div className="mt-1 text-sm text-white/70">
          Create your free profile, browse upcoming events, and check in with one tap when you arrive.
        </div>
        <div className="mt-4 flex gap-3">
          <Button href="/auth">Create profile</Button>
          <Button href="/events" variant="ghost">
            View events
          </Button>
        </div>
      </section>

      <footer className="space-y-2 border-t border-white/10 pt-6 text-xs text-white/60">
        <div>Contact: info@charlottebusinessowners.com</div>
        <div>© {new Date().getFullYear()} Charlotte Business Owners</div>
      </footer>
    </div>
  );
}
