import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkIn, getEvent } from './api';
import { completeQrCheckIn, eventCheckInPath } from './qrCheckIn';
import type { Event, CheckIn } from '../types/models';

vi.mock('./api', () => ({ getEvent: vi.fn(), checkIn: vi.fn() }));
const event = { id: 'scanned-event', status: 'published', title: 'Scanned event' } as Event;

beforeEach(() => { vi.resetAllMocks(); vi.mocked(getEvent).mockResolvedValue(event); });

describe('QR arrival check-in', () => {
  it('checks into the exact scanned event, not a different upcoming event', async () => {
    vi.mocked(checkIn).mockResolvedValue({ event_id: event.id } as CheckIn);
    expect(await completeQrCheckIn(event.id)).toEqual({ event, alreadyCheckedIn: false });
    expect(checkIn).toHaveBeenCalledWith(event.id);
  });
  it('treats a duplicate scan as successful without a second attendance record', async () => {
    vi.mocked(checkIn).mockResolvedValue({ already_checked_in: true });
    expect((await completeQrCheckIn(event.id)).alreadyCheckedIn).toBe(true);
  });
  it('never submits attendance for a draft or missing event', async () => {
    vi.mocked(getEvent).mockResolvedValue({ ...event, status: 'draft' });
    await expect(completeQrCheckIn(event.id)).rejects.toThrow('not open');
    expect(checkIn).not.toHaveBeenCalled();
    vi.mocked(getEvent).mockRejectedValue(new Error('Event not found'));
    await expect(completeQrCheckIn('missing')).rejects.toThrow('Event not found');
    expect(checkIn).not.toHaveBeenCalled();
  });
  it.each(['Check-in is closed for this event', 'Please sign in', 'Network error'])(
    'does not report success when the server says %s', async message => {
      vi.mocked(checkIn).mockRejectedValue(new Error(message));
      await expect(completeQrCheckIn(event.id)).rejects.toThrow(message);
    },
  );
  it('encodes event IDs as a single local path segment', () => {
    expect(eventCheckInPath('a/b?next=https://example.com')).toBe('/checkin/a%2Fb%3Fnext%3Dhttps%3A%2F%2Fexample.com');
  });
});
