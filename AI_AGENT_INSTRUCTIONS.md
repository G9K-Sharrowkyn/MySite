# AI Agent Instructions - MySite Project

## Critical Workflow

### Before Every Commit and Push
1. Always run `npm run build` before committing.
2. Fix all errors and warnings (`CI=true` treats warnings as build failures).
3. Commit and push only after a successful local build.

### Version Management (Frontend)
1. Increment `version` in root `package.json` for user-visible changes.
2. Run `node scripts/gen-build-info.cjs`.
3. Run `npm install` to keep `package-lock.json` in sync.
4. Commit all related version files together.

### Standard Deployment Workflow
```bash
# Make changes
npm run build

# If build succeeds
node scripts/gen-build-info.cjs
git add .
git commit -m "v0.XXX - Short description"
git push
```

## Database Policy

### Source of Truth
- Primary application data is MongoDB (Atlas).
- Do not add new runtime fallbacks to local JSON for production.
- Character catalog runtime is Mongo-backed.
- Character images are Mongo-backed via `/api/media/characters/:id`.

### Character Data and Media Migration
- Import static seed catalog into Mongo:
```bash
cd backend
node scripts/importStaticCharactersToMongo.js
```
- Migrate character images to Mongo media storage:
```bash
cd backend
node scripts/migrateCharacterImagesToMongo.js
```
- The image migration must complete with:
  - `failed=0`
  - `remainingStatic=0`

### Backups
- Keep automated Mongo backups enabled.
- Before major schema/media changes, create a manual backup snapshot.

## Build and CI Notes

### Build Info Generation
- `scripts/gen-build-info.cjs` reads:
  - root `package.json` version
  - git short SHA
  - git commit count (build number)
- Output file: `src/buildInfo.generated.js` (auto-generated).

### CI/CD
- Frontend and backend deploy through GitHub Actions.
- `CI=true` makes lint warnings fail the build.
- Backend deploy includes Mongo character import/migration scripts.

## Common Build Issues

### ESLint Failures
- Remove unused imports/variables.
- Remove duplicate declarations.
- Keep imports aligned with actual usage.

## Project Structure

### Frontend
- React 19.x
- Build output: `build/`

### Backend
- Node.js/Express in `backend/`
- MongoDB mode controlled by env (`MONGO_URI`, `MONGO_DB_NAME`)

### Key Directories
- `src/` frontend code
- `public/` static frontend assets
- `backend/` server code
- `docs/` documentation
- `e2e/` Playwright tests

## Quality Checklist Before Push

- [ ] `npm run build` passes locally
- [ ] Version updated (if user-visible change)
- [ ] `node scripts/gen-build-info.cjs` executed
- [ ] `package-lock.json` synchronized
- [ ] No unused imports/variables
- [ ] No duplicate declarations
- [ ] Commit message follows `v0.XXX - ...` format for versioned UI changes

