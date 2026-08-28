# Backend Ops Notes

## Healthcheck

- `GET /healthz`
- `GET /api/health`

Both endpoints return a small JSON payload with:
- `ok`
- `service`
- `uptimeSec`
- `timestamp`

Use this in uptime monitors.

## Rate Limits

The API uses several scoped limiters:
- global API limiter (`/api/*`)
- stricter auth limiter (`/api/auth/*` for login/register/google/forgot/reset)
- share-render limiter (`/share/post/*` and `/api/share/post/*`)
- feedback and optional translation limiters

Environment variables:
- `API_RATE_LIMIT_MAX` (default: `300` in production, `2000` in development)
- `LOGIN_RATE_LIMIT_MAX` (default: `15` in production)
- `REGISTER_RATE_LIMIT_MAX` (default: `20` in production)
- `AUTH_RATE_LIMIT_MAX` for password/email flows (default: `5` in production)
- `SHARE_RENDER_RATE_LIMIT_MAX` (default: `30` per minute in production)
- `TRANSLATION_RATE_LIMIT_MAX` (default: `30` per 15 minutes)
- `TRUST_PROXY` (`true`/`false`, auto-true in production)
- `MONGO_CACHE_TTL_MS` (default: `0`; enable only after measuring consistency needs)

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
- The deployment workflow preserves `uploads/` and `backups/` on the VPS.
- Keep a second, encrypted backup outside the VPS and test restoration before launch.

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
- Character uploads and approved suggestion images are decoded, bounded and
  re-encoded before they are stored or served.
- PNG, JPEG, WebP and GIF signatures are verified; SVG and renamed non-images
  are rejected.
- Upload size limit is 8 MB.

## VPS Deploy (Webuzo)

If you deploy to a VPS with Webuzo, prefer SSH-based deploy (rsync) over FTP/FTPS.
The GitHub Actions workflows in `.github/workflows/` can deploy `build/` and `backend/` directly to the server.

## Production Gate

Before restart, deployment runs `npm run preflight:production`. It rejects:

- a short JWT secret or non-HTTPS frontend/API URL;
- missing SMTP or legal operator settings;
- local-file persistence in production;
- MongoDB without transaction support.

Use Node.js 24 and a MongoDB replica set or sharded cluster.
After PM2 starts or reloads the process, `npm run verify:deployment` polls the
local `/healthz` endpoint and fails the deployment if the API does not become
healthy within 30 seconds.

Last updated: 2026-07-28
