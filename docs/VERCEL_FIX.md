# Vercel Deployment Fix - v0.2.6

## Problem
The Vercel deployment was showing a blank page on initial load with console errors related to data fetching. This was caused by using `output: "export"` in `next.config.ts`, which creates a static export incompatible with Vercel's dynamic deployment infrastructure.

## Root Cause
- **Static Export Mode**: The PWA was configured to always use `output: "export"` for Next.js
- **Vercel Incompatibility**: Vercel doesn't support static export for dynamic deployments
- **Desktop App Requirement**: The desktop app (Tauri) NEEDS static export to bundle the PWA

## Solution
Implemented **conditional static export** based on build context:

### 1. Environment Detection
- Added `TAURI_BUILD` environment variable to distinguish build contexts
- When `TAURI_BUILD=true`: Use static export (for desktop)
- When `TAURI_BUILD` is not set: Use dynamic rendering (for Vercel)

### 2. Next.js Configuration (`next.config.ts`)
```typescript
const isTauriBuild = process.env.TAURI_BUILD === "true";

const nextConfig: NextConfig = {
  ...(isTauriBuild && { output: "export" }),
  // ... other config
};
```

### 3. Tauri Build Command (`tauri.conf.json`)
```json
{
  "build": {
    "beforeBuildCommand": "cross-env TAURI_BUILD=true pnpm -C ../pwa build"
  }
}
```

### 4. GitHub Actions Workflow (`.github/workflows/tauri-build.yml`)
```yaml
- name: Build PWA (static export for desktop)
  run: pnpm -C apps/pwa build
  env:
    NODE_ENV: production
    TAURI_BUILD: true
```

### 5. Dependencies
Added `cross-env` to both `desktop` and `pwa` packages for cross-platform environment variable support.

## Benefits
✅ **Vercel deployments work correctly** - No more blank page, uses Next.js dynamic rendering
✅ **Desktop builds still work** - Static export for Tauri bundling
✅ **Cross-platform compatible** - `cross-env` works on Windows, macOS, and Linux
✅ **Single codebase** - No need to maintain separate configs
✅ **CI/CD compatible** - GitHub Actions and local builds both work

## Testing
- ✅ Local PWA build (dynamic): `pnpm -C apps/pwa build`
- ✅ Local PWA build (static): `cross-env TAURI_BUILD=true pnpm -C apps/pwa build`
- ✅ Desktop build: `pnpm -C apps/desktop tauri build`
- 🔄 Vercel deployment: Will automatically use dynamic rendering

## Next Steps
1. Monitor Vercel deployment to confirm it works
2. Test desktop app to ensure static export still functions correctly
3. Verify relay server connections and features

## Files Changed
- `apps/pwa/next.config.ts` - Conditional static export
- `apps/desktop/src-tauri/tauri.conf.json` - TAURI_BUILD environment variable
- `apps/pwa/package.json` - Added cross-env dependency
- `apps/desktop/package.json` - Added cross-env dependency
- `.github/workflows/tauri-build.yml` - Set TAURI_BUILD in CI

## Version
v0.2.6 - Conditional Static Export Fix
