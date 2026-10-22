import { checkIn, getEvent } from './api';

export const eventCheckInPath = (eventId: string) => `/checkin/${encodeURIComponent(eventId)}`;

// The server owns the attendance window and the unique event/user constraint.
export async function completeQrCheckIn(eventId: string) {
  const event = await getEvent(eventId);
  if (event.status !== 'published') throw new Error('This event is not open for check-in.');
  const result = await checkIn(eventId);
  return { event, alreadyCheckedIn: 'already_checked_in' in result };
}
