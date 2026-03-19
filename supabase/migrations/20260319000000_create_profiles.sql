-- Create profiles table
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text,
  business_name text,
  created_at timestamptz not null default now(),
  role text not null default 'member' check (role in ('admin', 'member'))
);

-- Enforce at most one admin at the DB level (partial unique index)
create unique index if not exists profiles_single_admin
  on public.profiles (role)
  where role = 'admin';

-- Enable Row Level Security
alter table public.profiles enable row level security;

-- Users can read their own profile
create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- Users can update their own profile
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Function to handle new user registration
-- Uses INSERT ... ON CONFLICT to race-safely assign admin to the very first user.
-- We attempt to insert as 'admin'; if the unique partial index fires (admin already
-- exists), the ON CONFLICT clause silently falls back to 'member'.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  -- First, try inserting as admin (will succeed only if no admin row exists yet)
  begin
    insert into public.profiles (id, email, role)
    values (new.id, new.email, 'admin');
    return new;
  exception
    when unique_violation then
      -- An admin already exists; insert as member instead
      insert into public.profiles (id, email, role)
      values (new.id, new.email, 'member');
      return new;
  end;
end;
$$;

-- Trigger that fires after a new user is inserted into auth.users
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
