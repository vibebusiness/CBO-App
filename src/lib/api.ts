const BASE = '/api';

function getToken(): string | null {
  return localStorage.getItem('cbo_token');
}

export function setToken(token: string) {
  localStorage.setItem('cbo_token', token);
}

export function clearToken() {
  localStorage.removeItem('cbo_token');
}

function headers(): Record<string, string> {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { ...init, headers: headers() });
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
  created_at: string;
};

export async function signUp(email: string, password: string): Promise<{ token: string; user: AppUser }> {
  return request('/auth/signup', { method: 'POST', body: JSON.stringify({ email, password }) });
}

export async function signIn(email: string, password: string): Promise<{ token: string; user: AppUser }> {
  return request('/auth/signin', { method: 'POST', body: JSON.stringify({ email, password }) });
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

export async function updateProfile(data: { full_name: string; business_name: string }): Promise<AppUser> {
  return request('/profile', { method: 'PATCH', body: JSON.stringify(data) });
}

export async function getEvents() {
  return request<import('../types/models').Event[]>('/events');
}

export async function createEvent(data: Omit<import('../types/models').Event, 'id' | 'created_at' | 'created_by'>) {
  return request<import('../types/models').Event>('/events', { method: 'POST', body: JSON.stringify(data) });
}

export async function checkIn(eventId: string) {
  return request(`/checkins/${eventId}`, { method: 'POST' });
}

export async function getCheckIns(eventId: string) {
  return request(`/checkins/${eventId}`);
}
