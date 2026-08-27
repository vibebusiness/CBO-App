# Architecture

## Runtime flow

1. The browser receives non-cached `index.html`.
2. Vite loads a small application shell; route pages load on demand.
3. `AuthProvider` restores an HTTP-only cookie session and retries once during an Autoscale cold start.
4. Express validates the session against the current database user on every protected request, so role changes take effect immediately.
5. PostgreSQL stores application records and current image blobs.

## Source ownership

- `src/App.tsx`: route boundaries and startup states
- `src/state/auth.tsx`: session bootstrap and sign-out state
- `src/lib/api.ts`: typed same-origin HTTP client
- `src/lib/events.ts`: deterministic event-feed selection
- `src/pages/*`: route-level UI, loaded lazily
- `server/config.js`: validated runtime configuration
- `server/db.js`: bounded PostgreSQL pool and readiness check
- `server/http.js`: sessions, request context, content sanitization, media verification
- `server/index.js`: feature routes and server lifecycle
- `server/db/migrations/*`: canonical additive schema history

## Boundaries for future work

The remaining feature routes can be extracted from `server/index.js` one domain at a time (`auth`, `events`, `networking`, `messaging`, `admin`) behind Express routers. Preserve the existing API contract and add request-level integration tests before each extraction. Image blobs can later move to object storage without changing public URLs by retaining the current media routes as an indirection layer.
