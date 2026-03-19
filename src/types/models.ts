export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  business_name: string | null;
  created_at: string;
  role: 'member' | 'admin';
};

export type Event = {
  id: string;
  title: string;
  description: string;
  start_at: string; // ISO
  location: string;
  created_at: string;
  created_by: string;
  status: 'published' | 'draft';
};

export type CheckIn = {
  id: string;
  event_id: string;
  user_id: string;
  checked_in_at: string;
};
