# AI Agent Instructions - MySite Project

## 🚨 CRITICAL WORKFLOW - READ FIRST

### Before Every Commit & Push:
1. **ALWAYS run `npm run build` BEFORE committing**
2. Fix ALL errors and warnings (CI treats warnings as errors)
3. Only after successful build → commit + push

### Version Management:
1. Increment version in `package.json`
2. Run `node scripts/gen-build-info.cjs` to regenerate build info
3. Run `npm install` to sync `package-lock.json`
4. Commit all three files together

### Standard Deployment Workflow:
```bash
# Make code changes
# Test build locally FIRST:
npm run build

# If build succeeds:
node scripts/gen-build-info.cjs
git add .
git commit -m "v0.XXX - Description of changes"
git push
```

## 📋 Common Build Errors

### ESLint Errors (CI mode):
- **Unused imports/variables**: Remove them immediately
- **Duplicate declarations**: Check for copy-paste errors
- **Missing dependencies**: Verify all imports are used

### Example Fixes:
```javascript
// ❌ BAD - unused import
import { useCallback } from 'react';

// ✅ GOOD - only import what you use
import { useState, useRef } from 'react';

// ❌ BAD - duplicate declaration
const [boostActive, setBoostActive] = useState(false);
const [boostActive, setBoostActive] = useState(false);

// ✅ GOOD - single declaration
const [boostActive, setBoostActive] = useState(false);
```

## 🏗️ Build System Details

### Build Info Generation:
- `scripts/gen-build-info.cjs` reads `package.json` version + git SHA
- Generates `src/buildInfo.generated.js` (in .gitignore)
- Runs automatically via `prebuild` hook in CI
- Run manually after version changes during development

### CI/CD:
- GitHub Actions builds on every push to `main`
- `process.env.CI = true` makes ESLint treat warnings as errors
- Build artifacts deployed to live server automatically

## 📦 Project Structure

### Frontend:
- React 19.1.0
- Babylon.js 8.50.2 (3D engine)
- Build: `npm run build` → `build/` directory

### Backend:
- Node.js server in `backend/`
- Database: `backend/db.json`

### Key Directories:
- `src/` - React components
- `public/` - Static assets
- `build/` - Production build output
- `backend/` - Server code
- `docs/` - Documentation
- `e2e/` - Playwright tests

## 🎮 Current Project: Speed Racing (KOTOR-style)

### Location:
- Component: `src/speedRacing/SpeedRacingPage.js`
- Styles: `src/speedRacing/SpeedRacingPage.css`

### Tech Stack:
- Babylon.js for 3D rendering
- First-person camera (FreeCamera)
- React hooks for state management

### Game Mechanics:
- 5-gear shifting system with heat meter
- 800m straight track, 3 lanes
- 25 boost pads (+30 speed)
- 20 obstacles (×0.6 slowdown)
- Time trial format (target: 28.5s)

## 🔧 Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm start

# Build for production (TEST BEFORE COMMIT!)
npm run build

# Run tests
npm test

# Run E2E tests
npm run test:e2e

# Generate build info manually
node scripts/gen-build-info.cjs
```

## 📝 Commit Message Format

```
v0.XXX - Brief description of changes

Examples:
v0.303 - Complete KOTOR swoop racing game implementation
v0.304 - Fix: Remove duplicate boostActive declaration
v0.305 - Fix: Remove unused useCallback import
```

## ⚠️ Important Notes

1. **Never push without testing build locally first**
2. **Always increment version number for user-visible changes**
3. **CI is strict**: no warnings allowed, all imports must be used
4. **Triple-check for duplicate declarations** (common copy-paste error)
5. **Sync package-lock.json** after package.json version changes
6. **buildInfo.generated.js is auto-generated** - don't edit manually

## 🎯 Quality Checklist Before Push

- [ ] `npm run build` passes without errors or warnings
- [ ] Version incremented in package.json
- [ ] buildInfo.generated.js regenerated
- [ ] package-lock.json synchronized
- [ ] No unused imports or variables
- [ ] No duplicate declarations
- [ ] Code follows existing patterns
- [ ] Commit message follows format

---

**Remember**: One failed CI build = wasted time for everyone. Always test locally first! 🚀
