# Namecheap cPanel deploy (frontend + backend)

This guide assumes:
- You have Namecheap Shared Hosting with cPanel.
- You have "Setup Node.js App" available in cPanel.
- MongoDB Atlas is already created and accessible.

If you do NOT see "Setup Node.js App", skip to "Fallback" at the end.

---

## 0) Prepare production env for frontend

Create `.env.production` in the project root (same level as `package.json`):

```
REACT_APP_API_URL=https://api.versusversevault.com
REACT_APP_SOCKET_URL=https://api.versusversevault.com
REACT_APP_TRON_SOCKET_URL=https://api.versusversevault.com
REACT_APP_CCG_API_URL=https://api.versusversevault.com/api/ccg
```

Then build the frontend:

```
npm run build
```

This creates the `build/` folder.

---

## 1) Upload frontend to public_html

1) Log in to cPanel.
2) Open **File Manager**.
3) Go to `public_html/`.
4) Upload all files from local `build/` into `public_html/`.

Add SPA routing support by creating `public_html/.htaccess` with:

```
RewriteEngine On
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule ^ index.html [L]
```

---

## 2) Create API subdomain (api.versusversevault.com)

In cPanel:
1) Open **Domains** (or **Subdomains**).
2) Create subdomain: `api`
3) Document root: e.g. `public_html/api` (any folder is OK).

This will also create the DNS record if you use Namecheap hosting DNS.

---

## 3) Upload backend to the server

You can upload via File Manager or FTP:

- Upload the `backend/` folder to your hosting home directory.
  Example path: `/home/USERNAME/backend/`

Make sure `server.js`, `package.json`, and all backend files are inside that folder.

---


## 4) Create Node.js app in cPanel

1) Open **Setup Node.js App**.
2) Click **Create Application**.
3) Use these values:
   - **Node.js version**: 24
   - **Application mode**: production
   - **Application root**: `backend`
   - **Application URL**: `https://api.versusversevault.com`
   - **Application startup file**: `server.js`

4) Click **Create**.
5) Click **Run NPM Install**.

---

## 5) Set backend environment variables (cPanel)

In the same Node.js App screen, configure every value documented in
`backend/.env.example`. The abbreviated list below is not sufficient by itself:

```
NODE_ENV=production
PORT=5000
DATABASE=mongo
MONGO_URI=your_atlas_uri_here
MONGO_DB_NAME=versusversevault
JWT_SECRET=your_long_random_secret
FRONTEND_URL=https://versusversevault.com
API_ORIGIN=https://api.versusversevault.com
MONGO_CACHE_TTL_MS=0
UPLOADS_DIR=/home/USERNAME/site-uploads
TRON_REALTIME_ROLE=authority
BACKGROUND_JOBS_ROLE=authority
MULTI_INSTANCE=false
REDIS_URL=
```

Use a randomly generated JWT secret of at least 32 characters. Configure SMTP,
the legal operator/contact values and the primary administrator, then run
`npm run audit:mongo-scale` inside the backend directory first. The audit is
read-only and reports duplicate identities or missing unique indexes. If it
reports no duplicate groups, run `npm run ensure:mongo-indexes` once, then run
the audit again and finally `npm run preflight:production`. The index command
changes database indexes but never edits or deletes application records. Save
and **Restart** only after the audit and preflight both pass.

Create the directory configured as `UPLOADS_DIR` once in cPanel. It stores
avatars, profile backgrounds and uploaded character images outside the
replaceable backend application folder, so a new deployment does not erase
them. Database records contain only their public `/uploads/...` paths.

When the API is moved to more than one physical server, `UPLOADS_DIR` must be a
shared mounted volume or be replaced with object storage. A separate local
folder on each server is not sufficient because an image uploaded through one
instance would be missing on the others.

The Namecheap setup above runs one authoritative TRON simulation process. If
the HTTP API is later copied to multiple servers, keep exactly one separate
Node process with `TRON_REALTIME_ROLE=authority` and set the remaining API
processes to `TRON_REALTIME_ROLE=disabled`. Keep the tournament scheduler on
that same single process with `BACKGROUND_JOBS_ROLE=authority`; set it to
`disabled` on every additional API process. Point
`REACT_APP_TRON_SOCKET_URL` at that authority. Set `MULTI_INSTANCE=true` and
the same `REDIS_URL` on every process so Socket.IO events from chat,
notifications and HTTP workers are shared. This prevents two servers from
creating different versions of the same TRON room; MongoDB remains shared for
durable data and monthly leaderboards.

---

## 6) MongoDB Atlas checklist

Make sure Atlas allows your hosting server IP:
- Atlas > Network Access > Add IP address
- Add only the fixed outbound IP address of your hosting server. Do not expose
  the database to `0.0.0.0/0`.

---

## 7) Verify

- Frontend: https://versusversevault.com
- Backend readiness: https://api.versusversevault.com/readyz (must return JSON with
  `"ok": true`)
- Check cPanel Node.js logs if something fails.

---

## Fallback (if Node.js App is missing)

Shared hosting without Node.js App cannot run the backend.
Then you must:
- Keep frontend on Namecheap shared hosting.
- Move backend to a VPS / Node-friendly host.
- Point `api.versusversevault.com` to that VPS IP.

---

## Common problems

- **CORS error**: make sure `FRONTEND_URL` matches your real domain (https).
- **Mongo connect error**: check Atlas IP whitelist and `MONGO_URI`.
- **Socket.io not connecting**: some shared hosts block websockets. Use VPS if chat fails.
