export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  business_name: string | null;
  industry: string | null;
  phone: string | null;
  role: 'member' | 'admin';
  created_at: string;
};

export type Event = {
  id: string;
  title: string;
  description: string;
  start_at: string;
  end_at: string | null;
  location_name: string;
  location_address: string;
  image_url: string | null;
  has_raffle: boolean;
  status: 'published' | 'draft';
  created_by: string;
  created_at: string;
};

export type CheckIn = {
  id: string;
  event_id: string;
  user_id: string;
  checked_in_at: string;
  email?: string;
  full_name?: string | null;
};
