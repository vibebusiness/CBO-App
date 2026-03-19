# CBO Events Check-in

Mobile-first web app for Charlotte Business Owners. Features member profiles (auth), events calendar, one-tap event check-in, and an admin panel.

## Tech Stack

- **Frontend**: React 19 + TypeScript + Vite
- **Styling**: Tailwind CSS
- **Routing**: Wouter
- **Forms**: React Hook Form + Zod
- **Backend/Auth/DB**: Supabase

## Environment Variables

Stored as Replit secrets:
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anonymous API key

## Project Structure

```
src/
  components/   # Shared UI components (Layout)
  lib/          # Supabase client, env helpers
  pages/        # Auth, Calendar, Events, Profile, Admin
  state/        # Auth context/provider
  types/        # Shared TypeScript models
```

## Development

- Dev server runs on port 5000 via `npm run dev`
- Workflow: "Start application"

## Deployment

Configured as a static site:
- Build: `npm run build`
- Public dir: `dist`
