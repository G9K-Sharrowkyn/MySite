# Prelaunch Test Checklist

This document captures the minimum tests to run before public launch.

## Automated E2E coverage (Playwright)
- Guest landing page loads and shows call-to-action.
- Register, login, and reach profile.
- Login and open global chat UI.
- Settings page access control (redirects to login when logged out).
- Change password, then log in with new password.
- Profile update: description and avatar upload.
- Forgot password + reset password flow.
- Create a discussion post and see it in the feed.
- Create a fight via API and vote in the UI.
- Send and receive a private message.
- Notification appears for a reply to a comment.
- Moderator panel access.
- Admin panel access (including divisions admin).

Run:
```bash
npm run test:e2e
```

Notes:
- Playwright starts the app via `npm run dev` and writes results to `test-results/`.
- E2E data is stored in `backend/.tmp/db.e2e.json` using the fixture copy from `e2e/fixtures/db.e2e.template.json`.

## Manual sanity checks (recommended before opening to users)
- Moderator panel access and key actions (create main fights, moderation actions).
- Admin panel access (if applicable).
- Notifications dropdown behavior and unread counts.
- Messaging: open conversations, send/receive messages.
- Global chat: connect, send, and see messages.
- Character selection and fight creation flow (community fights).
- Vote flow on fight posts and result visibility.
- File upload sanity: profile background upload and removal.
- Page navigation on mobile viewport (header, menus).
- Basic performance pass: first load and feed scroll feel responsive.
Note: the E2E suite now covers messaging, notifications, and fight voting flows.

## Release checklist (short)
- Verify env vars for production (`JWT_SECRET`, `FRONTEND_URL`, email SMTP).
- Run `npm run build` and smoke-test the built site.
- Backup production data before deploy.
- Clear test data (`backend/.tmp/db.e2e.json`) after test runs.

## Logs and evidence
- `test-results/` (Playwright artifacts: traces/screenshots/videos on failure).
- Console output from `npm run test:e2e`.
