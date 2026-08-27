# CBO Events

Mobile-first member app for Charlotte Business Owners. Members can sign in, view events, check in, network with attendees, exchange event messages, and maintain a profile. Administrators manage events, attendance, networking rounds, raffles, and invitations.

## Stack

- React 19, TypeScript, Vite, Tailwind CSS, Wouter
- Express 5 and PostgreSQL
- Secure HTTP-only session cookie with temporary bearer-token compatibility
- Workbox service worker with network-first page navigation
- Replit Autoscale deployment; optional OpenAI Sites static preview

## Local development

1. Copy `.env.example` to `.env` and supply a local PostgreSQL URL and a random `JWT_SECRET` of at least 32 characters.
2. Install exactly the locked dependencies with `npm ci`.
3. Run `npm run migrate` once.
4. Run `npm run server` and `npm run dev` in separate terminals.

Vite serves the UI on port 5000 and proxies API/media requests to Express on port 3001.

## Validation

```sh
npm run check
```

This runs ESLint, unit tests, TypeScript, the production build, and PWA generation. GitHub Actions runs the same check for pushes and pull requests.

## Production

Replit runs `npm run start`, which applies pending idempotent SQL migrations and then starts the API. Required production environment variables:

- `DATABASE_URL`
- `JWT_SECRET` or Replit `SESSION_SECRET` (at least 32 random characters; never commit it)
- `APP_URL`

Optional integrations:

- `GHL_API_KEY` and `GHL_LOCATION_ID` for password-reset email
- `AI_INTEGRATIONS_OPENAI_API_KEY` and `AI_INTEGRATIONS_OPENAI_BASE_URL` for event connection suggestions

Health probes are available at `/health/live` and `/health/ready`. API logs are structured JSON and include a request ID without logging email addresses, tokens, or query strings.

## Reliability notes

- HTML and the service worker are never long-term cached.
- Navigations are network-first; only versioned assets and selected media are cached.
- Missing `/assets/*` files return 404 instead of the SPA HTML fallback, preventing the JavaScript MIME-error blank screen.
- A boot watchdog and React error boundary always provide a visible reload path.
- Admin/editor pages are route-split so members do not download them on startup.
- Event descriptions are sanitized before storage and response delivery.
- Database schema changes live in `server/db/migrations` rather than asynchronous startup DDL.

See [operations](docs/OPERATIONS.md) and [architecture](docs/ARCHITECTURE.md) for deployment, rollback, and module ownership.
