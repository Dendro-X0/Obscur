# Desktop App Build & Install Guide

## Current Issue
The desktop app is showing "Nostr Messenger" (old UI) instead of "Obscur" (new UI).

## Root Cause
The installed desktop app (v0.2.4 or earlier) was built with:
- Old `devUrl` pointing to `https://obscur-lovat.vercel.app` (outdated Vercel deployment)
- No `beforeBuildCommand` to ensure fresh PWA build

## Solution

### For Users
**You MUST uninstall the old version and install the new one:**

1. **Uninstall** the current "Obscur" desktop app
2. **Download** the new installer from the latest v0.2.5 release
3. **Install** the new version
4. The new app will show "Obscur" and the updated onboarding wizard

### For Developers
The fix has been applied in commit `ed006b7`:
- Changed `devUrl` from Vercel to `http://localhost:3000`
- Added `beforeBuildCommand: "pnpm -C ../pwa build"`
- Added `beforeDevCommand: "pnpm -C ../pwa dev"`

### Build Process
```bash
# 1. Build PWA
cd apps/pwa
pnpm build

# 2. Verify PWA build
ls -la out/index.html  # Should show "Obscur" in title

# 3. Build desktop app
cd ../desktop
pnpm tauri build

# 4. The bundled app will include the fresh PWA build
```

### Verification
After installing the new desktop app:
- Window title should show "Obscur" (not "Nostr Messenger")
- Onboarding wizard should show the new design
- Settings → Appearance tab should have language selector

## Technical Details

### tauri.conf.json Changes
```json
{
  "build": {
    "beforeDevCommand": "pnpm -C ../pwa dev",
    "beforeBuildCommand": "pnpm -C ../pwa build",
    "devUrl": "http://localhost:3000",
    "frontendDist": "../../pwa/out"
  }
}
```

### Why This Matters
- **Development**: `devUrl` points to local dev server
- **Production**: `frontendDist` bundles the static PWA export
- **beforeBuildCommand**: Ensures PWA is always fresh before desktop build

## Auto-Update Note
The auto-updater URL has also been fixed to point to the correct GitHub repository:
```
https://github.com/Dendro-X0/Obscur/releases/latest/download/latest.json
```

Once you install v0.2.5, future updates will work automatically.
