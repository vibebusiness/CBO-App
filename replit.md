# CBO Events Check-in

Mobile-first web app for Charlotte Business Owners. Members sign up, build a profile, view an events calendar, and tap once to check in. Admins create/edit events and see live check-in rosters.

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite (port 5000)
- **Styling**: Tailwind CSS
- **Routing**: Wouter
- **Forms**: React Hook Form + Zod + @hookform/resolvers
- **Date handling**: date-fns
- **Backend**: Express (port 3001) — `npm run server`
- **Database**: Replit PostgreSQL (via `DATABASE_URL`)
- **Auth**: bcryptjs password hashing + JWT (stored in localStorage as `cbo_token`)

## Environment Variables

- `DATABASE_URL` — Replit PostgreSQL connection string (auto-provided)
- `JWT_SECRET` — Secret for signing/verifying tokens

## Database Schema

```sql
users         — id, email, password_hash, full_name, business_name, industry, phone, role (admin|member), created_at
events        — id, title, description, image_url, start_at, end_at, location_name, location_address, status (draft|published), has_raffle, created_by, created_at
checkins      — id, event_id, user_id, checked_in_at  [UNIQUE(event_id, user_id)]
invite_tokens — id, token, created_by, used_by, used_at, created_at
raffle_winners — id, event_id, user_id, won_at
event_images  — id (uuid), data (bytea), mime_type, created_at
               ↑ Image blobs stored in DB so they persist across deployments.
               ↑ image_url in events is /uploads/{uuid}, served via GET /uploads/:id
```

## Project Structure

```
server/
  index.js          # Express API (auth, profile, events, check-ins, invite tokens)

src/
  components/
    AuthedLayout.tsx  # Top header + bottom nav for authenticated pages
  lib/
    api.ts            # Typed fetch-based API client
  pages/
    Auth.tsx          # Login / sign-up (handles ?invite= token)
    Setup.tsx         # First-login profile setup (onboarding)
    Calendar.tsx      # Month calendar + upcoming list
    Events.tsx        # Event list with one-tap check-in
    Profile.tsx       # Edit personal profile
    Admin.tsx         # Create/edit events + check-in rosters + invite links
  state/
    auth.tsx          # AuthProvider + useAuth hook (user, loading, signOut, refresh)
  types/
    models.ts         # Profile, Event, CheckIn types
```

## Auth & Onboarding Flow

1. User signs up → JWT issued → `full_name` is null → redirected to `/setup`
2. User completes profile setup → redirected to `/calendar`
3. All future logins skip setup (full_name is set)
4. First user to sign up = admin automatically
5. Admins generate one-time invite links → recipients sign up with admin role

## Check-in Rules

- Window: 2 hours before event start → 6 hours after start
- Duplicate check-ins are silently ignored (ON CONFLICT DO NOTHING)
- Admins can remove any check-in from the roster

## Development

- Vite proxies `/api/*` → `http://localhost:3001` (see `vite.config.ts`)
- Workflow "Start application": `npm run dev`
- Workflow "Backend API": `npm run server`
