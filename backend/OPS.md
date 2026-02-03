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

