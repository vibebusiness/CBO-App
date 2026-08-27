import { describe, expect, it } from 'vitest';
import type { Event } from '../types/models';
import { selectEventFeed } from './events';

function event(id: string, startAt: string): Event {
  return {
    id,
    title: id,
    description: '',
    start_at: startAt,
    end_at: null,
    location_name: '',
    location_address: '',
    image_url: null,
    has_raffle: false,
    has_networking: false,
    status: 'published',
    created_by: 'admin',
    created_at: startAt,
  };
}

describe('selectEventFeed', () => {
  it('shows no more than three events and orders past events newest first', () => {
    const now = new Date('2026-08-27T16:00:00.000Z');
    const result = selectEventFeed([
      event('older', '2026-08-20T13:00:00.000Z'),
      event('newest', '2026-08-26T13:00:00.000Z'),
      event('middle', '2026-08-25T13:00:00.000Z'),
      event('oldest', '2026-08-01T13:00:00.000Z'),
    ], now);

    expect(result.today).toEqual([]);
    expect(result.past.map(({ id }) => id)).toEqual(['newest', 'middle', 'older']);
  });

  it('reserves one of the three visible slots for today', () => {
    const now = new Date('2026-08-27T16:00:00.000Z');
    const result = selectEventFeed([
      event('today', '2026-08-27T13:00:00.000Z'),
      event('past-1', '2026-08-26T13:00:00.000Z'),
      event('past-2', '2026-08-25T13:00:00.000Z'),
      event('past-3', '2026-08-24T13:00:00.000Z'),
    ], now);

    expect(result.today.map(({ id }) => id)).toEqual(['today']);
    expect(result.past.map(({ id }) => id)).toEqual(['past-1', 'past-2']);
  });
});
