# Backend Ops Notes

## Healthcheck

- `GET /healthz`
- `GET /api/health`

Both endpoints return a small JSON payload with:
- `ok`
- `service`
- `env`
- `database`
- `uptimeSec`
- `timestamp`

Use this in uptime monitors.

## Rate Limits

The API uses two limiters:
- global API limiter (`/api/*`)
- stricter auth limiter (`/api/auth/*` for login/register/google/forgot/reset)

Environment variables:
- `API_RATE_LIMIT_MAX` (default: `400` in production, `1000` in development)
- `AUTH_RATE_LIMIT_MAX` (default: `12` in production, `80` in development)
- `TRUST_PROXY` (`true`/`false`, auto-true in production)
- `MONGO_CACHE_TTL_MS` (default: `300000`, 5 minutes)

## Backup / Restore

Create backup:

```bash
npm run backup:db
```

Restore backup:

```bash
npm run restore:db -- --file backups/backup-local-YYYY-MM-DDTHH-mm-ss.json
```

Notes:
- Scripts work with current `DATABASE` mode (`local` or `mongo`) through the shared DB adapter.
- Backup output is a JSON envelope with metadata and full DB content.

## Performance Notes

- HTTP compression is enabled globally.
- Static asset cache headers:
  - `/uploads/*` -> 30 days, immutable
  - `/characters/*` -> 7 days
- Character API response (`GET /api/characters`) has short public cache headers.
- Mongo mode now ensures basic indexes for hot collections at startup.

## Moderation Audit APIs

For admin/moderator accounts:
- `GET /api/moderation/logs?limit=200`
- `GET /api/moderation/reports-queue`

These endpoints power the moderation audit tab and report queue summary.

## Auth Hardening

- Email verification endpoints:
  - `POST /api/auth/verify-email`
  - `POST /api/auth/resend-verification`
- Staff (admin/moderator) 2FA endpoint:
  - `POST /api/auth/verify-2fa`

Environment variables:
- `REQUIRE_EMAIL_VERIFICATION` (`true`/`false`, default true in production)
- `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_SECURE`, `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_FROM`

## Push Delivery

Backend can send web push notifications when in-app notifications are created.

Environment variables:
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` (optional, e.g. `mailto:noreply@versusversevault.com`)

Helper endpoint:
- `GET /api/push/vapid-public-key`

## Upload Compression

- Avatar uploads are converted to `.jpg` (max 640x640).
- Profile backgrounds are converted to `.jpg` (max 1920x1080).
- Upload size limit is 8 MB.

## VPS Deploy (Webuzo)

If you deploy to a VPS with Webuzo, prefer SSH-based deploy (rsync) over FTP/FTPS.
The GitHub Actions workflows in `.github/workflows/` can deploy `build/` and `backend/` directly to the server.

Last updated: 2026-02-10
