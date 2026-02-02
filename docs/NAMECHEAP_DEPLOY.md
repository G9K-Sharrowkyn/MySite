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
   - **Node.js version**: 18+ (or the newest available)
   - **Application mode**: production
   - **Application root**: `backend`
   - **Application URL**: `https://api.versusversevault.com`
   - **Application startup file**: `server.js`

4) Click **Create**.
5) Click **Run NPM Install**.

---

## 5) Set backend environment variables (cPanel)

In the same Node.js App screen, add env vars:

```
NODE_ENV=production
PORT=5000
DATABASE=mongo
MONGO_URI=your_atlas_uri_here
MONGO_DB_NAME=versusversevault
JWT_SECRET=your_long_random_secret
FRONTEND_URL=https://versusversevault.com
MONGO_CACHE_TTL_MS=300000
```

Save, then **Restart** the Node.js app.

---

## 6) MongoDB Atlas checklist

Make sure Atlas allows your hosting server IP:
- Atlas > Network Access > Add IP address
- Add your hosting server IP (or 0.0.0.0/0 for quick testing)

---

## 7) Verify

- Frontend: https://versusversevault.com
- Backend: https://api.versusversevault.com (should show "API is running..." or respond to /api)
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
