# Operations

## Deploy through Replit

1. Confirm Replit Secrets contains `DATABASE_URL`, `SESSION_SECRET` (or `JWT_SECRET`), and `APP_URL`.
2. Pull `origin/main` in Replit.
3. Run `npm ci` if the post-merge hook did not complete.
4. Publish the Autoscale deployment.
5. Verify `/health/live`, `/health/ready`, sign-in, Events, Calendar, Profile, and one admin screen from a private mobile browser session.

`npm run start` applies each migration exactly once using the `schema_migrations` table before starting the server.

## Rollback

The annotated Git tag `pre-refactor-20260827` points to the production-compatible commit immediately before the reliability refactor.

To inspect the rollback version without changing production:

```sh
git switch --detach pre-refactor-20260827
```

To revert the refactor on `main`, use `git revert` on the refactor commit and push the new revert commit. Avoid force-pushing or resetting the shared branch. Database migration 001 is additive and safe to leave in place after an application rollback.

## Monitoring

- Liveness: `GET /health/live`
- Database readiness: `GET /health/ready`
- Application requests: JSON lines with `requestId`, path, status, and duration
- Client recovery: the app displays a reload action when booting exceeds 12 seconds or a JavaScript/CSS asset fails

Alert on sustained readiness failures, elevated HTTP 5xx rates, or a material increase in request duration. Replit deployment logs can be filtered by `requestId` to follow a single request.

## Secret rotation

Never store secrets in `.replit`, source control, or frontend environment variables. Rotate `JWT_SECRET` in Replit Secrets if it may have been exposed; rotation signs out existing sessions. Rotate database and integration credentials using their owning services.
