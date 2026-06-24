import type { Event, CheckIn, NetworkingRound, NetworkingCurrent, EventFeedback } from '../types/models';

const BASE = '/api';

export function getToken(): string | null {
  return localStorage.getItem('cbo_token');
}

export function setToken(token: string) {
  localStorage.setItem('cbo_token', token);
}

export function clearToken() {
  localStorage.removeItem('cbo_token');
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { ...init, headers: authHeaders() });
  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    console.error(`[api] non-JSON from ${init?.method ?? 'GET'} ${path} (${res.status}):`, text.slice(0, 300));
    throw new Error(`Server error (${res.status}) on ${path}`);
  }
  if (!res.ok) throw new Error((data as Record<string, string>).error ?? 'Request failed');
  return data as T;
}

export type AppUser = {
  id: string;
  email: string;
  role: 'admin' | 'member';
  full_name: string | null;
  business_name: string | null;
  tagline: string | null;
  industry: string | null;
  phone: string | null;
  avatar_url: string | null;
  created_at: string;
};

// Auth
export async function signUp(email: string, password: string, inviteToken?: string) {
  return request<{ token: string; user: AppUser }>('/auth/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password, inviteToken }),
  });
}

export async function signIn(email: string, password: string) {
  return request<{ token: string; user: AppUser }>('/auth/signin', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function getMe(): Promise<AppUser | null> {
  if (!getToken()) return null;
  try {
    return await request<AppUser>('/auth/me');
  } catch {
    clearToken();
    return null;
  }
}

// Profile
export async function updateProfile(data: {
  full_name: string;
  business_name?: string;
  tagline?: string;
  industry?: string;
  phone?: string;
}): Promise<AppUser> {
  return request('/profile', { method: 'PATCH', body: JSON.stringify(data) });
}

// Avatar upload
export async function uploadAvatar(file: File): Promise<string> {
  const token = getToken();
  const form = new FormData();
  form.append('avatar', file);
  const res = await fetch('/api/profile/avatar', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Upload failed');
  return data.avatar_url as string;
}

// Image upload
export async function uploadImage(file: File): Promise<string> {
  const token = getToken();
  const form = new FormData();
  form.append('image', file);
  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Upload failed');
  return data.url as string;
}

// Events
export async function getEvents(all = false): Promise<Event[]> {
  return request(`/events${all ? '?all=true' : ''}`);
}

export async function getEvent(id: string): Promise<Event> {
  return request(`/events/${id}`);
}

export async function createEvent(data: Partial<Event>): Promise<Event> {
  return request('/events', { method: 'POST', body: JSON.stringify(data) });
}

export async function updateEvent(id: string, data: Partial<Event>): Promise<Event> {
  return request(`/events/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
}

export async function deleteEvent(id: string): Promise<void> {
  return request(`/events/${id}`, { method: 'DELETE' });
}

// Check-ins
export async function getCheckIns(eventId: string): Promise<CheckIn[]> {
  return request(`/events/${eventId}/checkins`);
}

export async function checkIn(eventId: string): Promise<CheckIn | { already_checked_in: boolean }> {
  return request(`/events/${eventId}/checkins`, { method: 'POST' });
}

export async function removeCheckIn(eventId: string, userId: string): Promise<void> {
  return request(`/events/${eventId}/checkins/${userId}`, { method: 'DELETE' });
}

// Raffle
export async function getRaffleParticipants(eventId: string): Promise<CheckIn[]> {
  return request(`/events/${eventId}/raffle/participants`);
}

export async function getRaffleWinners(eventId: string): Promise<CheckIn[]> {
  return request(`/events/${eventId}/raffle/winners`);
}

export async function recordRaffleWinner(eventId: string, userId: string): Promise<void> {
  return request(`/events/${eventId}/raffle/winner`, {
    method: 'POST',
    body: JSON.stringify({ user_id: userId }),
  });
}

// Networking
export async function getNetworkingRounds(eventId: string): Promise<NetworkingRound[]> {
  return request(`/events/${eventId}/networking/rounds`);
}

export async function runNetworkingRound(
  eventId: string,
  groupSize: number
): Promise<{ round_number: number }> {
  return request(`/events/${eventId}/networking/round`, {
    method: 'POST',
    body: JSON.stringify({ group_size: groupSize }),
  });
}

export async function getNetworkingCurrent(eventId: string): Promise<NetworkingCurrent | null> {
  return request(`/events/${eventId}/networking/current`);
}

export async function resetNetworkingRounds(eventId: string): Promise<void> {
  return request(`/events/${eventId}/networking/reset`, { method: 'DELETE' });
}

// Attendees directory
export async function getEventAttendees(eventId: string): Promise<{ full_name: string | null; industry: string | null; business_name: string | null; tagline: string | null; avatar_url: string | null }[]> {
  return request(`/events/${eventId}/attendees`);
}

// AI Match
export type AiMatchResult = {
  match: {
    id: string;
    full_name: string | null;
    business_name: string | null;
    tagline: string | null;
    industry: string | null;
  };
  reason: string;
  icebreaker: string;
};

export async function getAiMatch(eventId: string, excludeIds: string[] = []): Promise<AiMatchResult> {
  return request(`/events/${eventId}/ai-match`, {
    method: 'POST',
    body: JSON.stringify({ excludeIds }),
  });
}

// Feedback
export async function getMyFeedback(eventId: string): Promise<EventFeedback | null> {
  return request(`/events/${eventId}/my-feedback`);
}

export async function submitFeedback(eventId: string, data: {
  enjoyment_rating: number;
  event_size_preference: 'larger' | 'smaller' | null;
  one_change: string;
  additional_feedback: string;
}): Promise<EventFeedback> {
  return request(`/events/${eventId}/feedback`, { method: 'POST', body: JSON.stringify(data) });
}

export async function getEventFeedback(eventId: string): Promise<EventFeedback[]> {
  return request(`/events/${eventId}/feedback`);
}

// Admin invite
export async function createInviteLink(): Promise<{ token: string; link: string }> {
  return request('/admin/invite', { method: 'POST' });
}

export async function verifyInviteToken(token: string): Promise<{ valid: boolean }> {
  return request(`/admin/invite/verify?token=${token}`);
}

// Password reset
export async function forgotPassword(email: string): Promise<{ ok: boolean }> {
  const res = await fetch('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Request failed');
  return data;
}

export async function validateResetToken(token: string): Promise<{ valid: boolean }> {
  const res = await fetch(`/api/auth/reset-password/validate?token=${encodeURIComponent(token)}`);
  const data = await res.json();
  return data;
}

export async function resetPassword(token: string, password: string): Promise<{ ok: boolean }> {
  const res = await fetch('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Request failed');
  return data;
}
