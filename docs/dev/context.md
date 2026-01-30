Conversation Summary: Desktop & Vercel Sync Fixes
Objectives Overview
The main goal of this session was to fix version synchronization issues between the Desktop application and the PWA, specifically addressing a "blank page" error on Vercel deployments and outdated UI in the desktop application. We also streamlined the release process and improved the download experience.

Key Achievements
1. Fixed Vercel Blank Page Issue (v0.2.6)
Problem: The Vercel deployment was showing a blank page because output: "export" (static export) was hardcoded in 
next.config.ts
. Vercel's dynamic infrastructure doesn't support basic static exports for dynamic routes. Solution:

Implemented Conditional Static Export: The app now detects the build context using the TAURI_BUILD environment variable.
Vercel/Web: Uses dynamic rendering (standard Next.js behavior).
Desktop (Tauri): Forces output: "export" via cross-env TAURI_BUILD=true.
Added cross-env dependency to ensure cross-platform compatibility for environment variables.
Updated 
tauri.conf.json
 and GitHub Actions workflows to set TAURI_BUILD=true during desktop builds.
2. Resolved Desktop Sync & Update Issues
Problem: The desktop app was loading the old Vercel URL instead of the local bundle and required a manual reinstall to pick up new configurations. Solution:

Removed devUrl from production builds: Configured 
tauri.conf.json
 to strictly use the local frontendDist (../../pwa/out) for production builds, preventing any remote loading.
Verification Step: Added a CI check in GitHub Actions to grep for "Obscur" in the PWA output, failing the build if old branding ("Nostr Messenger") is detected.
Action Required: Users on version < 0.2.5 must uninstall and reinstall manually. Future updates will work automatically via the fixed auto-updater.
3. Streamlined Releases & Downloads
Changes:

Reduced Bundle Targets: Modified 
tauri.conf.json
 to only build essential installers:
Windows: .exe (NSIS)
macOS: .dmg
Linux: .AppImage
Branding: Updated the Windows installer to use the Obscur logo (icon.ico).
Download Page: Enhanced the /download page in the PWA to:
Automatically detect the user's OS.
Show a "Mobile App Coming Soon" section.
Filter downloads to only show the essential installers.
Current State (v0.2.6)
Version: 0.2.6
Codebase: Fully synced between Desktop and PWA.
Build System:
PWA: Dynamic for web, Static for Desktop.
Desktop: Bundles local static export, no external dependency.
Documentation:
docs/VERCEL_FIX.md
: Detailed explanation of the conditional export logic.
CHANGELOG.md
: Updated with v0.2.5 and v0.2.6 notes.
Next Steps
Monitor Vercel: Confirm the latest deployment loads correctly without errors.
Test Desktop Features: Verify end-to-end encryption, relay connections, and settings persistence on the new v0.2.6 build.
Mobile Development: Proceed with mobile app development now that the core platform is stable.