# Native Mobile App Implementation Plan

## Objective
Deploy "Obscur" as a high-performance native generic mobile application for iOS and Android, achieving 100% feature parity with the PWA and Desktop experience.

## Strategy: Tauri Mobile
We will leverage `apps/desktop` as the base for the mobile app, using Tauri v2's mobile capabilities. This allows us to reuse the exact same Next.js frontend and Rust backend configuration.

## Phase 1: Environment Readiness
- [x] **Android Setup**: JDK installed on Drive E, SDK/NDK managed on Drive E.
- [x] **Rust Targets**: Added necessary mobile targets.

## Phase 2: Project Initialization
- [x] **Initialize Android**: Project created successfully in `apps/desktop/src-tauri/gen/android`.
- [x] **Configure Permissions**: `AndroidManifest.xml` updated with Internet, Storage, and Deep Link support.
- [x] **Generate Icons**: Icons generated for all platforms using `pnpm tauri icon`.

## Phase 3: UI/UX Adaptation
- [x] **Safe Areas**: `viewport-fit=cover` added to `layout.tsx`.
- [x] **Notch Support**: Global CSS utilities added to `globals.css`.
- [x] **Status Bar**: `tauri-plugin-statusbar` integrated and synced in `ThemeController`.

## Phase 4: Core Features & Parity
- [ ] **Crypto Service**: Ensure `@dweb/crypto` (WASM) loads correctly in mobile WebViews.
- [ ] **File System**: Verify NIP-96 generic file upload works via native file pickers.
- [ ] **Deep Links**: Register custom scheme `obscur://` for magic link invites.

## Phase 5: Notifications strategy
1. **Short Term**: Foreground Polling
   - Keep the WebSocket connection alive while app is open.
2. **Medium Term**: Local Background Service
   - Use Tauri background plugin to wake up periodically.
3. **Long Term**: UnifiedPush
   - Implement a distributor for truly decentralized push notifications.

## Execution Timeline
- **v0.5.0-alpha**: Internal Android build (APK) with basic messaging.
- **v0.5.0-beta**: Polished UI with Safe Area support.
- **v0.5.0**: Public F-Droid / Play Store release.
