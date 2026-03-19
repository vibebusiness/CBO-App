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
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? 'Request failed');
  return data as T;
}

export type AppUser = {
  id: string;
  email: string;
  role: 'admin' | 'member';
  full_name: string | null;
  business_name: string | null;
  industry: string | null;
  phone: string | null;
  created_at: string;
};

import type { Event, CheckIn } from '../types/models';

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
  industry?: string;
  phone?: string;
}): Promise<AppUser> {
  return request('/profile', { method: 'PATCH', body: JSON.stringify(data) });
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

// Admin invite
export async function createInviteLink(): Promise<{ token: string; link: string }> {
  return request('/admin/invite', { method: 'POST' });
}

export async function verifyInviteToken(token: string): Promise<{ valid: boolean }> {
  return request(`/admin/invite/verify?token=${token}`);
}
