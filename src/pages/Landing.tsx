import { Link } from 'wouter';

const colors = {
  orange: '#f58220',
  blue: '#1e79c6',
  green: '#2fb36d',
};

function Btn({
  href,
  children,
  variant = 'primary',
}: {
  href: string;
  children: React.ReactNode;
  variant?: 'primary' | 'secondary' | 'ghost';
}) {
  const base =
    'inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-2 active:translate-y-[1px]';
  const style =
    variant === 'primary'
      ? 'bg-orange-500 text-white hover:bg-orange-600 focus:ring-orange-500'
      : variant === 'secondary'
        ? 'bg-slate-900 text-white hover:bg-slate-800 focus:ring-slate-900'
        : 'bg-white text-slate-900 border border-slate-200 hover:bg-slate-50 focus:ring-slate-400';
  return (
    <Link href={href}>
      <a className={`${base} ${style}`}>{children}</a>
    </Link>
  );
}

function SectionTitle({ kicker, title, desc }: { kicker?: string; title: string; desc?: string }) {
  return (
    <div className="space-y-2">
      {kicker ? (
        <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">{kicker}</div>
      ) : null}
      <h2 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{title}</h2>
      {desc ? <p className="text-base text-slate-600">{desc}</p> : null}
    </div>
  );
}

function FeatureCard({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-sm font-semibold text-slate-900">{title}</div>
      <div className="mt-1 text-sm text-slate-600">{desc}</div>
    </div>
  );
}

function Pill({ label, accent }: { label: string; accent: string }) {
  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700">
      <span className="h-2 w-2 rounded-full" style={{ background: accent }} />
      {label}
    </div>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-full bg-white">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-slate-100 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <img src="/cbo-logo.png" alt="Charlotte Business Owners" className="h-10 w-auto" />
            <div className="hidden sm:block">
              <div className="text-sm font-semibold text-slate-900">Charlotte Business Owners</div>
              <div className="text-xs text-slate-500">Connect • Collaborate • Grow</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Btn href="/auth" variant="ghost">
              Sign in
            </Btn>
            <Btn href="/auth">Join now</Btn>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 opacity-[0.09]" aria-hidden>
          <div
            className="absolute -left-24 -top-24 h-72 w-72 rounded-full blur-3xl"
            style={{ background: colors.orange }}
          />
          <div
            className="absolute right-[-120px] top-10 h-80 w-80 rounded-full blur-3xl"
            style={{ background: colors.blue }}
          />
          <div
            className="absolute bottom-[-120px] left-1/3 h-80 w-80 rounded-full blur-3xl"
            style={{ background: colors.green }}
          />
        </div>

        <div className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
          <div className="grid items-center gap-10 sm:grid-cols-2">
            <div className="space-y-5">
              <div className="flex flex-wrap gap-2">
                <Pill label="Networking events" accent={colors.orange} />
                <Pill label="Workshops" accent={colors.blue} />
                <Pill label="Accountability" accent={colors.green} />
              </div>

              <h1 className="text-3xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-5xl">
                You don’t have to build alone.
                <span className="block text-slate-600">Find your circle. Grow your dream.</span>
              </h1>

              <p className="text-base leading-relaxed text-slate-600 sm:text-lg">
                Charlotte Business Owners is the place where serious entrepreneurs build stronger businesses through real
                relationships, expert support, and powerful collaboration.
              </p>

              <div className="flex gap-3">
                <Btn href="/auth">Create a free profile</Btn>
                <Btn href="/auth" variant="ghost">
                  Sign in
                </Btn>
              </div>

              <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="text-lg font-semibold text-slate-900">23k+</div>
                  <div className="text-xs text-slate-500">Owners (site)</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="text-lg font-semibold text-slate-900">Weekly</div>
                  <div className="text-xs text-slate-500">Training</div>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                  <div className="text-lg font-semibold text-slate-900">Events</div>
                  <div className="text-xs text-slate-500">All over CLT</div>
                </div>
              </div>
            </div>

            {/* Right visual */}
            <div className="relative">
              <div className="rounded-3xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 p-5 shadow-sm">
                <div className="text-sm font-semibold text-slate-900">The right connection can change everything.</div>
                <div className="mt-2 text-sm text-slate-600">
                  Join us at powerful networking events, workshops, and educational sessions across Charlotte.
                </div>
                <div className="mt-4 grid gap-3">
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Upcoming</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">Networking Nights</div>
                    <div className="text-xs text-slate-500">Meet local owners • build real relationships</div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Also</div>
                    <div className="mt-1 text-sm font-semibold text-slate-900">Coffee meetups + workshops</div>
                    <div className="text-xs text-slate-500">Learn • collaborate • take action</div>
                  </div>
                </div>

                <div className="mt-5">
                  <Btn href="/auth" variant="secondary">
                    Join & view events
                  </Btn>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Who we are */}
      <section className="border-t border-slate-100 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-12">
          <div className="grid gap-8 sm:grid-cols-2">
            <SectionTitle
              kicker="Who we are"
              title="A real community — not just networking"
              desc="Growing a business can feel lonely. We’re here to change that. Find the people, resources, and relationships to support your journey."
            />
            <div className="grid gap-3">
              <FeatureCard
                title="Real relationships"
                desc="Connect with entrepreneurs who show up, follow through, and want to see you win."
              />
              <FeatureCard
                title="Expert support"
                desc="Workshops, trainings, and trusted experts to help you grow smarter and faster."
              />
              <FeatureCard
                title="Collaboration"
                desc="Find partners, referrals, and opportunities through community and events."
              />
            </div>
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="border-t border-slate-100 bg-slate-50">
        <div className="mx-auto max-w-5xl px-4 py-12">
          <SectionTitle
            kicker="Membership"
            title="Membership benefits"
            desc="Events, meetups, discounts, and education — designed to make your business stronger."
          />

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <FeatureCard
              title="Exclusive networking events"
              desc="Members-only events and in-person meetups across Charlotte."
            />
            <FeatureCard
              title="Workshops & lunch-and-learns"
              desc="Sharpen your skills and apply what you learn with community support."
            />
            <FeatureCard
              title="Group discounts"
              desc="Discounts on software, meeting spaces, and other business essentials."
            />
            <FeatureCard
              title="Accountability"
              desc="Meetings and challenges that keep you focused and moving forward."
            />
          </div>

          <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
              <div>
                <div className="text-sm font-semibold text-slate-900">Ready to join?</div>
                <div className="text-sm text-slate-600">Create a free profile to access events and check in on your phone.</div>
              </div>
              <div className="flex gap-3">
                <Btn href="/auth">Sign up</Btn>
                <Btn href="/auth" variant="ghost">
                  Sign in
                </Btn>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4 pillars */}
      <section className="border-t border-slate-100 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-12">
          <SectionTitle
            kicker="Framework"
            title="The 4 pillars"
            desc="A simple structure for building a business that supports your life — not consumes it."
          />
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <FeatureCard title="1) Mindset, vision, mission & goal setting" desc="Clarity first. Align your work to what you actually want." />
            <FeatureCard title="2) Marketing & sales" desc="Build consistent lead flow and a repeatable sales process." />
            <FeatureCard title="3) Systems & teams" desc="Create processes and support so the business can scale." />
            <FeatureCard title="4) Financials" desc="Know your numbers and make decisions with confidence." />
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-100 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-10">
          <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <img src="/cbo-logo.png" alt="Charlotte Business Owners" className="h-9 w-auto" />
              <div>
                <div className="text-sm font-semibold text-slate-900">Charlotte Business Owners</div>
                <div className="text-xs text-slate-500">info@charlottebusinessowners.com</div>
              </div>
            </div>
            <div className="text-xs text-slate-500">© {new Date().getFullYear()} Charlotte Business Owners</div>
          </div>
        </div>
      </footer>
    </div>
  );
}
