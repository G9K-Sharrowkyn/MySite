# VPS (Webuzo) deploy via GitHub Actions (SSH)

Your old workflows deployed to **cPanel via FTP**. On a VPS/Webuzo setup you typically have **SSH/SFTP**, not FTP, so the FTP deploy action fails.

This repo now deploys via **rsync over SSH**.

## 1) Create GitHub Secrets

In GitHub: **Settings -> Secrets and variables -> Actions -> New repository secret**

Required:
- `VPS_HOST`: your server IP or hostname (example: `203.161.52.204`)
- `VPS_USER`: linux user for SSH (example: `root` or a Webuzo user)
- `VPS_SSH_KEY`: private key (PEM) that can SSH into the server
- `VPS_PORT`: SSH port (usually `22`)
- `VPS_FRONTEND_DIR`: absolute path to website docroot (example: `/home/USERNAME/public_html/`)
- `VPS_BACKEND_DIR`: absolute path to backend folder (example: `/home/USERNAME/backend/`)

Optional:
- `VPS_BACKEND_RESTART_CMD`: command executed on the VPS after backend deploy.
  Examples:
  - `pm2 restart versusversevault-backend`
  - `systemctl restart your-backend.service`

## 2) Webuzo: point domain to the correct docroot

In Webuzo, make sure `versusversevault.com` is mapped to the same path as `VPS_FRONTEND_DIR` and that your Apache vhost serves that directory.

If you see the Webuzo “Default Website Page”, it means your domain is still mapped to the default docroot.

## 3) SSL: fix ERR_CERT_AUTHORITY_INVALID

`ERR_CERT_AUTHORITY_INVALID` means the server is presenting a self-signed / untrusted certificate.

In Webuzo:
- Install a Let's Encrypt certificate for `versusversevault.com` (and `www` if used).

Verify:
- `https://versusversevault.com` should open without browser warnings.

## 4) API topology (important)

Frontend calls `/api/...` endpoints. You need one of:
1. API on a subdomain: `api.versusversevault.com` (simpler, no reverse proxy).
2. API on the same domain: Apache/Nginx reverse proxy that forwards `/api` and websockets to Node.

## 5) Health check

Once backend is reachable:
- `GET /healthz` or `GET /api/health`

The response includes flags:
- `mongoUriPresent`
- `googleAuthConfigured`
- `database`

## Troubleshooting: First Deploy

If a GitHub Actions deploy fails, the most common causes are:
- `VPS_SSH_KEY` is missing/invalid.
- `VPS_FRONTEND_DIR` / `VPS_BACKEND_DIR` point to a path that does not exist or is not writable for `VPS_USER`.
- SSH is blocked by firewall or uses a non-standard port (update `VPS_PORT`).

