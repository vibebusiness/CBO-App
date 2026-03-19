# CBO Events + Check-in (MVP)

Mobile-first web app for Charlotte Business Owners:
- Free member profiles (auth)
- Events calendar + list
- One-tap event check-in (2 hours before → 6 hours after)
- Admin event creation + check-in counts/roster

## Setup
1) Copy env:
```bash
cp .env.example .env
```
2) Fill in:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

3) Run:
```bash
npm install
npm run dev
```

## Notes
- Supabase schema + RLS policies will be added once credentials are provided.
