import React from 'react';
import { useRoute, useLocation } from 'wouter';
import { getEvent, getEventAttendees } from '../lib/api';
import type { Event } from '../types/models';

type Attendee = {
  full_name: string | null;
  industry: string | null;
  business_name: string | null;
  tagline: string | null;
};

export function EventAttendeesPage() {
  const [, params] = useRoute('/events/:id/attendees');
  const [, navigate] = useLocation();
  const id = params?.id;

  const [event, setEvent] = React.useState<Event | null>(null);
  const [attendees, setAttendees] = React.useState<Attendee[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [activeTab, setActiveTab] = React.useState<string | null>(null);
  const tabBarRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!id) return;
    Promise.all([getEvent(id), getEventAttendees(id)])
      .then(([ev, att]) => {
        setEvent(ev);
        setAttendees(att as Attendee[]);
      })
      .catch(() => navigate('/events'))
      .finally(() => setLoading(false));
  }, [id]);

  const grouped = React.useMemo(() => {
    const map = new Map<string, Attendee[]>();
    for (const a of attendees) {
      const key = a.industry?.trim() || 'Not Listed';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    return [...map.entries()].sort(([a], [b]) => {
      if (a === 'Not Listed') return 1;
      if (b === 'Not Listed') return -1;
      return a.localeCompare(b);
    });
  }, [attendees]);

  React.useEffect(() => {
    if (grouped.length > 0 && activeTab === null) {
      setActiveTab(grouped[0][0]);
    }
  }, [grouped]);

  React.useEffect(() => {
    if (!activeTab || !tabBarRef.current) return;
    const btn = tabBarRef.current.querySelector(`[data-tab="${CSS.escape(activeTab)}"]`);
    btn?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeTab]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-sm text-slate-400">Loading…</div>
      </div>
    );
  }

  const activeMembers = grouped.find(([industry]) => industry === activeTab)?.[1] ?? [];

  return (
    <div>
      <button
        onClick={() => window.history.back()}
        className="mb-4 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
      >
        ← Back
      </button>

      {/* Header */}
      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-lg font-bold text-slate-900">Who's Here</h1>
        {event && <p className="mt-0.5 text-sm text-slate-500">{event.title}</p>}
        <div className="mt-3 flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-sm">👥</div>
          <span className="text-sm font-medium text-slate-700">
            {attendees.length} {attendees.length === 1 ? 'person' : 'people'} checked in
          </span>
        </div>
      </div>

      {attendees.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <div className="mb-2 text-3xl">👋</div>
          <div className="text-sm font-medium text-slate-700">No one's checked in yet</div>
          <div className="mt-1 text-xs text-slate-400">Be the first!</div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          {/* Tab bar */}
          <div
            ref={tabBarRef}
            className="flex gap-1 overflow-x-auto border-b border-slate-100 px-3 pt-3 pb-0"
            style={{ scrollbarWidth: 'none' }}
          >
            {grouped.map(([industry, members]) => (
              <button
                key={industry}
                data-tab={industry}
                onClick={() => setActiveTab(industry)}
                className={[
                  'flex shrink-0 items-center gap-1.5 rounded-t-xl border-b-2 px-3.5 pb-2.5 pt-2 text-xs font-semibold transition-colors',
                  activeTab === industry
                    ? 'border-slate-900 text-slate-900'
                    : 'border-transparent text-slate-400 hover:text-slate-600',
                ].join(' ')}
              >
                {industry}
                <span className={[
                  'rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                  activeTab === industry ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500',
                ].join(' ')}>
                  {members.length}
                </span>
              </button>
            ))}
          </div>

          {/* Members */}
          <div className="divide-y divide-slate-50 p-2">
            {activeMembers
              .slice()
              .sort((a, b) => (a.full_name ?? '').localeCompare(b.full_name ?? ''))
              .map((m, i) => (
                <div key={i} className="flex items-start gap-3 rounded-xl px-3 py-3">
                  <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                    {m.full_name?.[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-slate-900">{m.full_name ?? '—'}</div>
                    {m.business_name && (
                      <div className="text-xs font-medium text-slate-500">{m.business_name}</div>
                    )}
                    {m.tagline && (
                      <div className="mt-0.5 text-xs text-slate-400">{m.tagline}</div>
                    )}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
