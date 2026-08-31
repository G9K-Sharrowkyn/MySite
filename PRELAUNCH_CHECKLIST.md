# VersusVerseVault pre-launch checklist

The application deliberately refuses to start in production when a critical
runtime, email, legal or database setting is unsafe.

## 1. Infrastructure

- Use Node.js 24.
- Serve the frontend and API only through HTTPS.
- Use MongoDB as a replica set or sharded cluster; standalone MongoDB does not
  provide the transaction guarantees required by this application.
- Keep `backend/.env.production`, database credentials, uploads and backups
  outside Git.
- Configure a firewall, automatic operating-system security updates and an
  unprivileged deployment user.

## 2. Required production configuration

Copy `backend/.env.example` to a server-only `.env.production` and replace every
placeholder. In particular:

- generate a unique `JWT_SECRET` with at least 32 random bytes;
- set the exact HTTPS `FRONTEND_URL` and public HTTPS `API_ORIGIN`;
- configure `MONGO_URI`, `MONGO_DB_NAME` and `PRIMARY_ADMIN_EMAIL`;
- configure working SMTP credentials and `EMAIL_FROM`;
- enter the real operator identity, privacy/support addresses, jurisdiction,
  minimum age and policy version;
- set `REQUIRE_EMAIL_VERIFICATION=true`.

Donation provider URLs are optional. The donation page stays disabled until a
provider is configured. Google login and web push are also optional, but both
sides must use matching credentials if enabled. Translation is disabled by
default; enable `TRANSLATION_PROVIDER=mymemory` only after accepting and
disclosing that selected text is sent to that external provider.

## 3. Release gate

Run from the repository root:

```bash
npm ci
npm run lint
npm test -- --watchAll=false --runInBand
npm run build
npm audit --omit=dev --audit-level=high
npm --prefix SR run lint
npm --prefix SR test
npm audit --prefix SR --omit=dev --audit-level=high
cd backend
npm ci
npm test -- --runInBand
npm audit --omit=dev --audit-level=high
NODE_ENV=production npm run preflight:production
```

The GitHub quality-gate workflow also runs Chromium end-to-end tests. The
backend deployment runs the production preflight, migrations, PM2 restart and
a live `/readyz` verification.

## 4. Operational checks before promotion

- Have a Polish/EU-qualified adviser review the final Terms, Privacy Policy,
  cookie wording, age rule and donation/tax treatment.
- Send a real verification, password-reset and staff 2FA email through the
  production SMTP service.
- Test registration, login, logout, password reset, account export and account
  deletion against a disposable production-like account.
- Test post, comment, reaction, direct message, block, report and tournament
  flows on desktop and mobile.
- Verify that image uploads reject renamed non-images, SVG files and oversized
  pixel dimensions, and that share snapshots remain staff-only.
- Put `/healthz` behind an external liveness monitor and `/readyz` behind a
  dependency-aware readiness monitor and alerting.
- Create an encrypted off-site backup, restore it into a clean environment and
  document recovery time.
- Run a production-like load test for expected launch traffic and monitor CPU,
  memory, MongoDB connections, latency and error rate.
- Confirm upload storage capacity and retention, DNS, TLS renewal, error-log
  rotation and a rollback procedure.

Do not buy promotion traffic until all checks above have an owner, date and
recorded result.
