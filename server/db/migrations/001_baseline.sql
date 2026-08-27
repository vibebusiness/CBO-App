CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(320) NOT NULL UNIQUE,
  password_hash text NOT NULL,
  full_name varchar(200),
  business_name varchar(200),
  tagline varchar(120),
  industry varchar(200),
  phone varchar(50),
  avatar_url varchar(255),
  role varchar(20) NOT NULL DEFAULT 'member',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title varchar(300) NOT NULL,
  description text NOT NULL DEFAULT '',
  image_url text,
  start_at timestamptz NOT NULL,
  end_at timestamptz,
  location_name varchar(300) NOT NULL DEFAULT '',
  location_address text NOT NULL DEFAULT '',
  status varchar(20) NOT NULL DEFAULT 'draft',
  has_raffle boolean NOT NULL DEFAULT false,
  has_networking boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE events ADD COLUMN IF NOT EXISTS has_networking boolean DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS tagline varchar(120);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url varchar(255);

CREATE TABLE IF NOT EXISTS checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  user_id uuid NOT NULL,
  checked_in_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);

CREATE TABLE IF NOT EXISTS invite_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token varchar(128) NOT NULL UNIQUE,
  created_by uuid NOT NULL,
  used_by uuid,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS raffle_winners (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  user_id uuid NOT NULL,
  won_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, user_id)
);

CREATE TABLE IF NOT EXISTS event_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  data bytea NOT NULL,
  mime_type varchar(64) NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_avatars (
  user_id uuid PRIMARY KEY,
  data bytea NOT NULL,
  mime_type varchar(64) NOT NULL,
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS networking_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  round_number int NOT NULL,
  group_size int NOT NULL DEFAULT 5,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS networking_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid NOT NULL,
  user_id uuid NOT NULL,
  group_label varchar(4) NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  participant_a uuid NOT NULL,
  participant_b uuid NOT NULL,
  initiator_id uuid NOT NULL,
  a_last_read_at timestamptz DEFAULT now(),
  b_last_read_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(event_id, participant_a, participant_b)
);

CREATE TABLE IF NOT EXISTS event_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL,
  sender_id uuid NOT NULL,
  body text NOT NULL,
  sent_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS event_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL,
  user_id uuid NOT NULL,
  enjoyment_rating int NOT NULL,
  event_size_preference varchar(10),
  one_change text,
  additional_feedback text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(event_id, user_id)
);

CREATE TABLE IF NOT EXISTS password_resets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  token varchar(128) NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_events_status_start ON events (status, start_at);
CREATE INDEX IF NOT EXISTS idx_checkins_event_user ON checkins (event_id, user_id);
CREATE INDEX IF NOT EXISTS idx_networking_rounds_event ON networking_rounds (event_id, round_number);
CREATE INDEX IF NOT EXISTS idx_networking_assignments_round ON networking_assignments (round_id, user_id);
CREATE INDEX IF NOT EXISTS idx_event_messages_conv ON event_messages (conversation_id, sent_at);
CREATE INDEX IF NOT EXISTS idx_event_conversations_event ON event_conversations (event_id);
CREATE INDEX IF NOT EXISTS idx_password_resets_token ON password_resets (token) WHERE used_at IS NULL;
