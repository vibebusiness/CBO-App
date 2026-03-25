import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import {
  getEvents, createEvent, updateEvent, deleteEvent,
  getCheckIns, removeCheckIn, createInviteLink, uploadImage,
} from '../lib/api';
import type { Event, CheckIn } from '../types/models';
import { fmtET, etInputToUtc, utcToEtInput } from '../lib/tz';
import { RaffleModal } from '../components/RaffleModal';

type EventForm = {
  title: string;
  description: string;
  start_at: string;
  end_at: string;
  location_name: string;
  location_address: string;
  status: 'draft' | 'published';
  image_url: string;
  has_raffle: boolean;
};

const EMPTY_FORM: EventForm = {
  title: '',
  description: '',
  start_at: '',
  end_at: '',
  location_name: '',
  location_address: '',
  status: 'draft',
  image_url: '',
  has_raffle: false,
};

function Input({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      <input
        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
        {...props}
      />
    </div>
  );
}

function Toggle({ label, sublabel, checked, onChange }: {
  label: string;
  sublabel?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div>
        <div className="text-sm font-medium text-slate-800">{label}</div>
        {sublabel && <div className="text-xs text-slate-400">{sublabel}</div>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={[
          'relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200',
          checked ? 'bg-slate-900' : 'bg-slate-300',
        ].join(' ')}
      >
        <span className={[
          'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200',
          checked ? 'translate-x-6' : 'translate-x-1',
        ].join(' ')} />
      </button>
    </div>
  );
}

function ImageUpload({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [uploading, setUploading] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadImage(file);
      onChange(url);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">Event image (optional)</label>
      {value ? (
        <div className="relative overflow-hidden rounded-xl border border-slate-200">
          <img src={value} alt="Event" className="h-36 w-full object-cover" />
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute right-2 top-2 rounded-lg bg-black/50 px-2 py-1 text-xs text-white hover:bg-black/70"
          >
            Remove
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 bg-slate-50 py-6 text-sm text-slate-500 hover:border-slate-400 hover:bg-slate-100 disabled:opacity-50"
        >
          {uploading ? <><span className="animate-spin">⟳</span> Uploading…</> : <><span>📷</span> Upload image</>}
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}

function exportCheckInsCSV(event: Event, checkins: CheckIn[]) {
  const safeTitle = event.title.replace(/[^a-z0-9]/gi, '_').replace(/_+/g, '_');
  const eventDate = fmtET(event.start_at, 'yyyy-MM-dd');
  const filename = `${safeTitle}_${eventDate}_checkins.csv`;

  const rows = [
    ['Name', 'Email', 'Check-in Time (ET)'],
    ...checkins.map((c) => [
      c.full_name ?? '',
      c.email ?? '',
      fmtET(c.checked_in_at, 'MMM d yyyy h:mm a'),
    ]),
  ];

  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\r\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function CheckInRoster({ event, onClose }: { event: Event; onClose: () => void }) {
  const [checkins, setCheckins] = React.useState<CheckIn[]>([]);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(() => {
    getCheckIns(event.id).then((rows) => { setCheckins(rows); setLoading(false); });
  }, [event.id]);

  React.useEffect(() => { load(); }, [load]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-900">{event.title}</h3>
            <p className="text-xs text-slate-500">
              {fmtET(event.start_at, 'MMM d · h:mm a')} ET
            </p>
          </div>
          <button onClick={onClose} className="text-xl text-slate-400 hover:text-slate-700">✕</button>
        </div>

        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm text-slate-600">
            {loading ? '—' : checkins.length} {checkins.length === 1 ? 'check-in' : 'check-ins'}
          </span>
          {!loading && checkins.length > 0 && (
            <button
              onClick={() => exportCheckInsCSV(event, checkins)}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 active:scale-95"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
              Export CSV
            </button>
          )}
        </div>

        {loading ? (
          <div className="py-6 text-center text-sm text-slate-400">Loading…</div>
        ) : checkins.length === 0 ? (
          <div className="py-6 text-center text-sm text-slate-400">No check-ins yet</div>
        ) : (
          <div className="max-h-72 space-y-2 overflow-y-auto">
            {checkins.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                <div>
                  <div className="text-sm font-medium text-slate-900">{c.full_name ?? c.email}</div>
                  {c.full_name && <div className="text-xs text-slate-500">{c.email}</div>}
                  <div className="text-xs text-slate-400">
                    {fmtET(c.checked_in_at, 'h:mm a')} ET
                  </div>
                </div>
                <button
                  onClick={async () => { await removeCheckIn(event.id, c.user_id); load(); }}
                  className="text-xs text-red-500 hover:text-red-700"
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

const TOOLBAR_BTN = 'rounded px-1.5 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-200 disabled:opacity-40';

function RichTextEditor({ value, onChange }: { value: string; onChange: (html: string) => void }) {
  const editor = useEditor({
    extensions: [StarterKit, Underline],
    content: value,
    onUpdate({ editor }) {
      onChange(editor.getHTML());
    },
  });

  React.useEffect(() => {
    if (editor && editor.getHTML() !== value) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50 focus-within:border-slate-400 focus-within:ring-2 focus-within:ring-slate-200">
      <div className="flex flex-wrap gap-1 border-b border-slate-200 bg-white px-2 py-1.5">
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()} className={[TOOLBAR_BTN, editor.isActive('bold') ? 'bg-slate-200' : ''].join(' ')}>B</button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()} className={[TOOLBAR_BTN, editor.isActive('italic') ? 'bg-slate-200' : ''].join(' ')}><em>I</em></button>
        <button type="button" onClick={() => editor.chain().focus().toggleUnderline().run()} className={[TOOLBAR_BTN, editor.isActive('underline') ? 'bg-slate-200' : ''].join(' ')}><u>U</u></button>
        <span className="mx-0.5 w-px self-stretch bg-slate-200" />
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={[TOOLBAR_BTN, editor.isActive('heading', { level: 2 }) ? 'bg-slate-200' : ''].join(' ')}>H2</button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={[TOOLBAR_BTN, editor.isActive('heading', { level: 3 }) ? 'bg-slate-200' : ''].join(' ')}>H3</button>
        <span className="mx-0.5 w-px self-stretch bg-slate-200" />
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()} className={[TOOLBAR_BTN, editor.isActive('bulletList') ? 'bg-slate-200' : ''].join(' ')}>• List</button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()} className={[TOOLBAR_BTN, editor.isActive('orderedList') ? 'bg-slate-200' : ''].join(' ')}>1. List</button>
      </div>
      <EditorContent
        editor={editor}
        className="prose prose-sm max-w-none px-3 py-2.5 text-sm text-slate-900 [&_.ProseMirror]:min-h-[80px] [&_.ProseMirror]:outline-none"
      />
    </div>
  );
}

type RaffleState = Event | null;

export function AdminPage() {
  const [events, setEvents] = React.useState<Event[]>([]);
  const [form, setForm] = React.useState<EventForm>(EMPTY_FORM);
  const [editingId, setEditingId] = React.useState<string | null>(null);
  const [showForm, setShowForm] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [rosterEvent, setRosterEvent] = React.useState<Event | null>(null);
  const [raffleState, setRaffleState] = React.useState<RaffleState>(null);
  const [inviteLink, setInviteLink] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<'events' | 'invite'>('events');

  const load = () => getEvents(true).then(setEvents);
  React.useEffect(() => { load(); }, []);

  const openNew = () => { setForm(EMPTY_FORM); setEditingId(null); setShowForm(true); };

  const openEdit = (event: Event) => {
    setForm({
      title: event.title,
      description: event.description,
      start_at: utcToEtInput(event.start_at),
      end_at: event.end_at ? utcToEtInput(event.end_at) : '',
      location_name: event.location_name ?? '',
      location_address: event.location_address ?? '',
      status: event.status,
      image_url: event.image_url ?? '',
      has_raffle: event.has_raffle ?? false,
    });
    setEditingId(event.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title || !form.start_at) return;
    setSaving(true);
    try {
      const payload = {
        title: form.title,
        description: form.description,
        start_at: etInputToUtc(form.start_at),
        end_at: form.end_at ? etInputToUtc(form.end_at) : undefined,
        location_name: form.location_name,
        location_address: form.location_address,
        status: form.status,
        image_url: form.image_url || undefined,
        has_raffle: form.has_raffle,
      };
      if (editingId) {
        await updateEvent(editingId, payload);
      } else {
        await createEvent(payload);
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

  const handleRunRaffle = (event: Event) => {
    setRaffleState(event);
  };

  const handleGenerateInvite = async () => {
    try {
      const res = await createInviteLink();
      setInviteLink(`${window.location.origin}${res.link}`);
    } catch (e) { alert((e as Error).message); }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-base font-semibold text-slate-900">Admin Dashboard</h1>

      {/* Tabs */}
      <div className="flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
        {(['events', 'invite'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              'flex-1 rounded-lg py-2 text-sm font-medium capitalize transition',
              tab === t ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700',
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
            className="w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            + Create event
          </button>

          {showForm && (
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-800">
                {editingId ? 'Edit event' : 'New event'}
              </h2>

              <ImageUpload value={form.image_url} onChange={(url) => setForm((f) => ({ ...f, image_url: url }))} />

              <Input
                label="Title *"
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Event title"
              />

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Description</label>
                <RichTextEditor
                  value={form.description}
                  onChange={(html) => setForm((f) => ({ ...f, description: html }))}
                />
              </div>

              <Input
                label="Start (Eastern Time) *"
                type="datetime-local"
                value={form.start_at}
                onChange={(e) => setForm((f) => ({ ...f, start_at: e.target.value }))}
              />

              <Input
                label="End — optional (Eastern Time)"
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
                <label className="mb-1 block text-xs font-medium text-slate-600">Status</label>
                <select
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400"
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as 'draft' | 'published' }))}
                >
                  <option value="draft">Draft (admins only)</option>
                  <option value="published">Published (visible to members)</option>
                </select>
              </div>

              <Toggle
                label="This event has a raffle"
                sublabel="Members who check in are automatically entered"
                checked={form.has_raffle}
                onChange={(v) => setForm((f) => ({ ...f, has_raffle: v }))}
              />

              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={saving || !form.title || !form.start_at}
                  className="flex-1 rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
                >
                  {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create event'}
                </button>
                <button
                  onClick={() => setShowForm(false)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Events list */}
          <div className="space-y-3">
            {events.length === 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-400 shadow-sm">
                No events yet. Create your first one above!
              </div>
            )}
            {events.map((event) => (
              <div key={event.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                {event.image_url && (
                  <div className="h-28 w-full overflow-hidden bg-slate-100">
                    <img src={event.image_url} alt={event.title} className="h-full w-full object-cover" />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-slate-900">{event.title}</div>
                      <div className="text-xs text-slate-500">
                        {fmtET(event.start_at, 'EEE, MMM d · h:mm a')} ET
                      </div>
                      {event.location_name && (
                        <div className="text-xs text-slate-400">📍 {event.location_name}</div>
                      )}
                      <div className="mt-1 flex flex-wrap gap-1">
                        <span className={[
                          'inline-block rounded-full px-2 py-0.5 text-xs font-medium',
                          event.status === 'published' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700',
                        ].join(' ')}>
                          {event.status}
                        </span>
                        {event.has_raffle && (
                          <span className="inline-block rounded-full bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-700">
                            🎟️ Raffle
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1.5">
                      <button onClick={() => setRosterEvent(event)} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50">
                        Check-ins
                      </button>
                      <a
                        href={`/door/${event.id}`}
                        className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-center text-xs font-medium text-blue-700 hover:bg-blue-100"
                      >
                        🚪 Door View
                      </a>
                      {event.has_raffle && (
                        <button
                          onClick={() => handleRunRaffle(event)}
                          className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-medium text-orange-700 hover:bg-orange-100"
                        >
                          🎲 Raffle
                        </button>
                      )}
                      <button onClick={() => openEdit(event)} className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50">
                        Edit
                      </button>
                      <button onClick={() => handleDelete(event.id)} className="rounded-xl border border-red-100 bg-red-50 px-3 py-1.5 text-xs text-red-600 hover:bg-red-100">
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === 'invite' && (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div>
            <h2 className="font-medium text-slate-900">Invite an admin</h2>
            <p className="mt-1 text-sm text-slate-500">
              Generate a one-time invite link. Anyone who signs up with this link will be granted admin access.
            </p>
          </div>
          <button onClick={handleGenerateInvite} className="w-full rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white transition hover:bg-slate-700">
            Generate invite link
          </button>
          {inviteLink && (
            <div className="space-y-2">
              <p className="text-xs text-slate-500">Share this link (one-time use):</p>
              <div className="flex gap-2">
                <input readOnly value={inviteLink} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 outline-none" />
                <button onClick={() => navigator.clipboard.writeText(inviteLink)} className="shrink-0 rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50">
                  Copy
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {rosterEvent && <CheckInRoster event={rosterEvent} onClose={() => setRosterEvent(null)} />}

      {raffleState && (
        <RaffleModal
          eventId={raffleState.id}
          eventTitle={raffleState.title}
          onClose={() => setRaffleState(null)}
        />
      )}
    </div>
  );
}
