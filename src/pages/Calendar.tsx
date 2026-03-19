import { format } from 'date-fns';

export function CalendarPage() {
  // Placeholder: will be replaced with real events from Supabase.
  const today = new Date();
  return (
    <div className="space-y-3">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm font-semibold">Calendar</div>
        <div className="mt-1 text-xs text-white/60">Upcoming events in a simple month view (MVP)</div>
        <div className="mt-4 rounded-xl bg-black/20 p-3 text-sm text-white/80">
          Connected UI scaffold. Next: load events from DB + render month grid.
          <div className="mt-2 text-xs text-white/60">Today: {format(today, 'EEE, MMM d')}</div>
        </div>
      </div>
    </div>
  );
}
