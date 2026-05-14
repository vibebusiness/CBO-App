import React from 'react';
import { useRoute, useLocation } from 'wouter';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import { getEvent, updateEvent, uploadImage } from '../lib/api';
import type { Event } from '../types/models';
import { etInputToUtc, utcToEtInput } from '../lib/tz';

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
  has_networking: boolean;
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

function eventToForm(event: Event): EventForm {
  return {
    title: event.title,
    description: event.description ?? '',
    start_at: utcToEtInput(event.start_at),
    end_at: event.end_at ? utcToEtInput(event.end_at) : '',
    location_name: event.location_name ?? '',
    location_address: event.location_address ?? '',
    status: event.status,
    image_url: event.image_url ?? '',
    has_raffle: event.has_raffle ?? false,
    has_networking: event.has_networking ?? false,
  };
}

export function AdminEventEditPage() {
  const [, params] = useRoute('/admin/events/:id/edit');
  const [, navigate] = useLocation();
  const id = params?.id;

  const [event, setEvent] = React.useState<Event | null>(null);
  const [form, setForm] = React.useState<EventForm | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [notFound, setNotFound] = React.useState(false);

  React.useEffect(() => {
    if (!id) return;
    getEvent(id)
      .then((ev) => { setEvent(ev); setForm(eventToForm(ev)); })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    if (!form || !id) return;
    if (!form.title || !form.start_at) return;
    setSaving(true);
    try {
      await updateEvent(id, {
        title: form.title,
        description: form.description,
        start_at: etInputToUtc(form.start_at),
        end_at: form.end_at ? etInputToUtc(form.end_at) : undefined,
        location_name: form.location_name,
        location_address: form.location_address,
        status: form.status,
        image_url: form.image_url || undefined,
        has_raffle: form.has_raffle,
        has_networking: form.has_networking,
      });
      navigate('/admin');
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="text-sm text-slate-400">Loading…</div>
      </div>
    );
  }

  if (notFound || !event || !form) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3">
        <div className="text-sm text-slate-500">Event not found</div>
        <button onClick={() => navigate('/admin')} className="text-sm text-slate-900 underline">
          Back to admin
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        onClick={() => navigate('/admin')}
        className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
      >
        ← Back to events
      </button>

      <h1 className="text-base font-semibold text-slate-900">Edit event</h1>

      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <ImageUpload value={form.image_url} onChange={(url) => setForm((f) => f && ({ ...f, image_url: url }))} />

        <Input
          label="Title *"
          value={form.title}
          onChange={(e) => setForm((f) => f && ({ ...f, title: e.target.value }))}
          placeholder="Event title"
        />

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Description</label>
          <RichTextEditor
            value={form.description}
            onChange={(html) => setForm((f) => f && ({ ...f, description: html }))}
          />
        </div>

        <Input
          label="Start (Eastern Time) *"
          type="datetime-local"
          value={form.start_at}
          onChange={(e) => setForm((f) => f && ({ ...f, start_at: e.target.value }))}
        />

        <Input
          label="End — optional (Eastern Time)"
          type="datetime-local"
          value={form.end_at}
          onChange={(e) => setForm((f) => f && ({ ...f, end_at: e.target.value }))}
        />

        <Input
          label="Location name"
          value={form.location_name}
          onChange={(e) => setForm((f) => f && ({ ...f, location_name: e.target.value }))}
          placeholder="Venue or restaurant name"
        />

        <Input
          label="Address"
          value={form.location_address}
          onChange={(e) => setForm((f) => f && ({ ...f, location_address: e.target.value }))}
          placeholder="123 Main St, Charlotte NC"
        />

        <div>
          <label className="mb-1 block text-xs font-medium text-slate-600">Status</label>
          <select
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400"
            value={form.status}
            onChange={(e) => setForm((f) => f && ({ ...f, status: e.target.value as 'draft' | 'published' }))}
          >
            <option value="draft">Draft (admins only)</option>
            <option value="published">Published (visible to members)</option>
          </select>
        </div>

        <Toggle
          label="This event has a raffle"
          sublabel="Members who check in are automatically entered"
          checked={form.has_raffle}
          onChange={(v) => setForm((f) => f && ({ ...f, has_raffle: v }))}
        />

        <Toggle
          label="Speed Networking"
          sublabel="Divide checked-in attendees into groups — run multiple rounds"
          checked={form.has_networking}
          onChange={(v) => setForm((f) => f && ({ ...f, has_networking: v }))}
        />

        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving || !form.title || !form.start_at}
            className="flex-1 rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
          <button
            onClick={() => navigate('/admin')}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
