import React from 'react';
import { Link, useRoute } from 'wouter';
import QRCode from 'qrcode';
import { getEvent } from '../lib/api';
import { eventCheckInPath } from '../lib/qrCheckIn';
import { fmtET } from '../lib/tz';
import type { Event } from '../types/models';

export function EventQrCodePage() {
  const [, params] = useRoute('/admin/events/:id/qr');
  const id = params?.id;
  const [event, setEvent] = React.useState<Event | null>(null);
  const [qr, setQr] = React.useState('');
  const [error, setError] = React.useState('');
  const [notice, setNotice] = React.useState('');
  const url = id ? new URL(eventCheckInPath(id), window.location.origin).href : '';

  React.useEffect(() => {
    let active = true;
    if (!id) return;
    Promise.all([getEvent(id), QRCode.toDataURL(url, { width: 1000, margin: 4, errorCorrectionLevel: 'M' })])
      .then(([data, image]) => { if (active) { setEvent(data); setQr(image); } })
      .catch(() => { if (active) setError('Could not load this event QR code. Please reload and try again.'); });
    return () => { active = false; };
  }, [id, url]);

  return (
    <main className="flex min-h-screen flex-col bg-white p-5 text-slate-900 md:p-8">
      <nav className="flex flex-wrap items-center justify-between gap-3 text-sm print:hidden">
        <Link href="/admin/events/all" className="underline">← All Events</Link>
        <div className="flex gap-3">
          <button className="rounded-lg border px-4 py-2" onClick={async () => {
            try { await navigator.clipboard.writeText(url); setNotice('Check-in link copied.'); }
            catch { setNotice('Copy the check-in link shown below.'); }
          }}>Copy check-in link</button>
          <button className="rounded-lg border px-4 py-2" onClick={async () => {
            try { await document.documentElement.requestFullscreen(); }
            catch { setNotice('Use your browser’s full-screen option or press F11.'); }
          }}>Full screen</button>
        </div>
      </nav>
      {notice && <p role="status" className="text-center text-sm">{notice}</p>}
      {error ? <p role="alert" className="m-auto text-center text-red-700">{error}</p> : !event ? <p role="status" className="m-auto">Loading QR code…</p> : (
        <section className="m-auto grid w-full max-w-7xl items-center gap-6 py-8 text-center md:grid-cols-2 md:text-left">
          <div>
            <img src="/cbo-logo.png" alt="Charlotte Business Owners" className="mx-auto mb-6 h-24 w-24 object-contain md:mx-0" />
            <h1 className="text-4xl font-black md:text-6xl">Scan to check in</h1>
            <h2 className="mt-5 break-words text-2xl font-bold md:text-3xl">{event.title}</h2>
            <p className="mt-3 text-lg text-slate-600">{fmtET(event.start_at, 'EEE, MMM d · h:mm a')} ET</p>
            <p className="mt-6 text-xl">Scan with your phone, then sign in or create an account. You’ll be checked in automatically.</p>
            {event.status !== 'published' && <p role="alert" className="mt-4 font-bold text-amber-800">Draft event — publish it before attendees check in.</p>}
          </div>
          <div>
            <img src={qr} alt={`Check-in QR code for ${event.title}`} className="mx-auto w-full max-w-[65vh]" />
            <a href={url} className="block break-all text-center text-sm text-blue-700 underline">{url}</a>
          </div>
        </section>
      )}
    </main>
  );
}
