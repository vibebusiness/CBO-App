import React from 'react';
import { format, parseISO } from 'date-fns';
import { getEvents, createEvent, updateEvent, deleteEvent, getCheckIns, removeCheckIn, createInviteLink } from '../lib/api';
import type { Event, CheckIn } from '../types/models';

type EventForm = {
  title: string;
  description: string;
  start_at: string;
  end_at: string;
  location_name: string;
  location_address: string;
  status: 'draft' | 'published';
};

const EMPTY_FORM: EventForm = {
  title: '',
  description: '',
  start_at: '',
  end_at: '',
  location_name: '',
  location_address: '',
  status: 'draft',
};

function Input({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-white/70">{label}</label>
      <input
        className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-white/30"
        {...props}
      />
    </div>
  );
}

function CheckInRoster({ event, onClose }: { event: Event; onClose: () => void }) {
  const [checkins, setCheckins] = React.useState<CheckIn[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(() => {
    getCheckIns(event.id).then((rows) => {
      setCheckins(rows);
      setLoading(false);
    });
  }, [event.id]);

  React.useEffect(() => { load(); }, [load]);

  const handleRemove = async (userId: string) => {
    await removeCheckIn(event.id, userId);
    load();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0b1220] p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-white">{event.title}</h3>
            <p className="text-xs text-white/50">
              {format(parseISO(event.start_at), 'MMM d · h:mm a')}
            </p>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white text-xl">✕</button>
        </div>

        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm text-white/70">
            {loading ? '—' : checkins.length} {checkins.length === 1 ? 'check-in' : 'check-ins'}
          </span>
        </div>

        {loading ? (
          <div className="py-6 text-center text-sm text-white/40">Loading…</div>
        ) : checkins.length === 0 ? (
          <div className="py-6 text-center text-sm text-white/40">No check-ins yet</div>
        ) : (
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {checkins.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-xl bg-white/5 px-3 py-2">
                <div>
                  <div className="text-sm font-medium text-white">
                    {c.full_name ?? c.email}
                  </div>
                  {c.full_name && (
                    <div className="text-xs text-white/50">{c.email}</div>
                  )}
                  <div className="text-xs text-white/40">
                    {format(parseISO(c.checked_in_at), 'h:mm a')}
                  </div>
                </div>
                <button
                  onClick={() => handleRemove(c.user_id)}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function AdminPage() {
  const [events, setEvents] = React.useState<Event[]>([]);
  const [form, setForm] = React.useState<EventForm>(EMPTY_FORM);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [showForm, setShowForm] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [rosterEvent, setRosterEvent] = React.useState<Event | null>(null);
  const [inviteLink, setInviteLink] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<'events' | 'invite'>('events');

  const load = () => getEvents(true).then(setEvents);

  React.useEffect(() => { load(); }, []);

  const openNew = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (event: Event) => {
    setForm({
      title: event.title,
      description: event.description,
      start_at: event.start_at.slice(0, 16), // datetime-local format
      end_at: event.end_at?.slice(0, 16) ?? '',
      location_name: event.location_name ?? '',
      location_address: event.location_address ?? '',
      status: event.status,
    });
    setEditingId(event.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title || !form.start_at) return;
    setSaving(true);
    try {
      const payload = {
        ...form,
        end_at: form.end_at || undefined,
        start_at: new Date(form.start_at).toISOString(),
        end_at_iso: form.end_at ? new Date(form.end_at).toISOString() : undefined,
      };
      if (editingId) {
        await updateEvent(editingId, { ...payload, end_at: payload.end_at_iso });
      } else {
        await createEvent({ ...payload, end_at: payload.end_at_iso });
      }
      await load();
      setShowForm(false);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this event and all its check-ins?')) return;
    await deleteEvent(id);
    load();
  };

  const handleGenerateInvite = async () => {
    try {
      const res = await createInviteLink();
      const fullLink = `${window.location.origin}${res.link}`;
      setInviteLink(fullLink);
    } catch (e) {
      alert((e as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-base font-semibold text-white">Admin Dashboard</h1>

      {/* Tabs */}
      <div className="flex rounded-xl bg-white/5 p-1">
        {(['events', 'invite'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              'flex-1 rounded-lg py-2 text-sm font-medium capitalize transition',
              tab === t ? 'bg-white text-[#0b1220]' : 'text-white/60 hover:text-white',
            ].join(' ')}
          >
            {t === 'events' ? 'Events' : 'Invite Admins'}
          </button>
        ))}
      </div>

      {tab === 'events' && (
        <>
          <button
            onClick={openNew}
            className="w-full rounded-xl bg-white py-3 text-sm font-semibold text-[#0b1220]"
          >
            + Create event
          </button>

          {/* Event form */}
          {showForm && (
            <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
              <h2 className="text-sm font-semibold text-white">
                {editingId ? 'Edit event' : 'New event'}
              </h2>

              <Input
                label="Title *"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Event title"
              />

              <div>
                <label className="mb-1 block text-xs font-medium text-white/70">Description</label>
                <textarea
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-white/30"
                  rows={3}
                  placeholder="What's this event about?"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>

              <Input
                label="Start *"
                type="datetime-local"
                value={form.start_at}
                onChange={(e) => setForm((f) => ({ ...f, start_at: e.target.value }))}
              />

              <Input
                label="End (optional)"
                type="datetime-local"
                value={form.end_at}
                onChange={(e) => setForm((f) => ({ ...f, end_at: e.target.value }))}
              />

              <Input
                label="Location name"
                value={form.location_name}
                onChange={(e) => setForm((f) => ({ ...f, location_name: e.target.value }))}
                placeholder="Venue or restaurant name"
              />

              <Input
                label="Address"
                value={form.location_address}
                onChange={(e) => setForm((f) => ({ ...f, location_address: e.target.value }))}
                placeholder="123 Main St, Charlotte NC"
              />

              <div>
                <label className="mb-1 block text-xs font-medium text-white/70">Status</label>
                <select
                  className="w-full rounded-xl border border-white/10 bg-[#0b1220] px-3 py-2.5 text-sm text-white outline-none"
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as 'draft' | 'published' }))}
                >
                  <option value="draft">Draft (admins only)</option>
                  <option value="published">Published (visible to members)</option>
                </select>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving || !form.title || !form.start_at}
                  className="flex-1 rounded-xl bg-white py-2.5 text-sm font-semibold text-[#0b1220] disabled:opacity-40"
                >
                  {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create event'}
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="rounded-xl bg-white/10 px-4 py-2.5 text-sm text-white"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Events list */}
          <div className="space-y-3">
            {events.length === 0 && (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-sm text-white/40">
                No events yet. Create your first one above!
              </div>
            )}
            {events.map((event) => (
              <div key={event.id} className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-white truncate">{event.title}</div>
                    <div className="text-xs text-white/60">
                      {format(parseISO(event.start_at), 'EEE, MMM d · h:mm a')}
                    </div>
                    {event.location_name && (
                      <div className="text-xs text-white/40">📍 {event.location_name}</div>
                    )}
                    <span
                      className={[
                        'mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-medium',
                        event.status === 'published'
                          ? 'bg-green-500/20 text-green-300'
                          : 'bg-yellow-500/20 text-yellow-300',
                      ].join(' ')}
                    >
                      {event.status}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button
                      onClick={() => setRosterEvent(event)}
                      className="rounded-xl bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/20"
                    >
                      Check-ins
                    </button>
                    <button
                      onClick={() => openEdit(event)}
                      className="rounded-xl bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/20"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(event.id)}
                      className="rounded-xl bg-red-500/10 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/20"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'invite' && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-5 space-y-4">
          <div>
            <h2 className="font-medium text-white">Invite an admin</h2>
            <p className="mt-1 text-sm text-white/60">
              Generate a one-time invite link. Anyone who signs up with this link will be granted admin access.
            </p>
          </div>
          <button
            onClick={handleGenerateInvite}
            className="w-full rounded-xl bg-white py-3 text-sm font-semibold text-[#0b1220]"
          >
            Generate invite link
          </button>
          {inviteLink && (
            <div className="space-y-2">
              <p className="text-xs text-white/50">Share this link (one-time use):</p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={inviteLink}
                  className="flex-1 min-w-0 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/80 outline-none"
                />
                <button
                  onClick={() => navigator.clipboard.writeText(inviteLink)}
                  className="shrink-0 rounded-xl bg-white/10 px-3 py-2 text-xs text-white hover:bg-white/20"
                >
                  Copy
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {rosterEvent && (
        <CheckInRoster event={rosterEvent} onClose={() => setRosterEvent(null)} />
      )}
    </div>
  );
}
