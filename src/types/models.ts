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
  has_networking: boolean;
  status: 'published' | 'draft';
  created_by: string;
  created_at: string;
  checked_in?: boolean;
};

export type NetworkingRound = {
  id: string;
  event_id: string;
  round_number: number;
  group_size: number;
  created_at: string;
  groups: Array<{
    label: string;
    members: Array<{ user_id: string; full_name: string | null; email: string }>;
  }>;
};

export type NetworkingCurrent = {
  round_number: number;
  group_label: string;
  group_size: number;
  members: Array<{ user_id: string; full_name: string | null }>;
};

export type CheckIn = {
  id: string;
  event_id: string;
  user_id: string;
  checked_in_at: string;
  email?: string;
  full_name?: string | null;
};

export type EventFeedback = {
  id: string;
  event_id: string;
  user_id: string;
  enjoyment_rating: number;
  event_size_preference: 'larger' | 'smaller' | null;
  one_change: string | null;
  additional_feedback: string | null;
  created_at: string;
  full_name?: string | null;
  email?: string;
  business_name?: string | null;
};
