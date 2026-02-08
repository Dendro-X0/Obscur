# Changelog

All notable changes to this project will be documented in this file.

## [v0.6.3-alpha] - 2026-02-08

### Added
- **Native Key Management**: Secure storage for Nostr private keys (nsec) using the operating system's native keychain (Windows Credential Manager, macOS Keychain) via `keyring`.
- **Native Signing**: Optimized cryptographic signing of Nostr events in Rust for improved performance and security.
- **Auto-Unlock**: Automatic detection and authentication using native keys on startup, providing a seamless login experience.
- **Improved Security Boundaries**: The private key is now isolated at the native layer, never touching the frontend/WebView memory once stored.

### Fixed
- **Relay Stability**: Fixed "Future is not Send" errors and deadlock issues in the native relay transport by ensuring MutexGuards are not held across await points.
- **Desktop Permissions**: Refactored capability management to use explicit permission identifiers, ensuring native features work correctly in production bundles.
- **Dependency Optimization**: Updated `nostr` and `tokio` dependencies for better cross-platform compatibility and performance.


## [v0.5.0-alpha] - 2026-02-06

### Added
- **Tor Network Integration**: Full Tor support for desktop, routing all application traffic through a bundled Tor sidecar for enhanced privacy and censorship resistance.
- **Native Mobile Support (Android)**: Initial alpha release for Android.
- **Mobile UI Polishing**: Implemented safe area insets for notches and dynamic islands, ensuring content isn't obscured.
- **Deep Linking**: Support for `obscur://` and `nostr:` links to open invites, profiles, and conversations directly in the app.
- **Native File Uploads**: Integrated NIP-96 file upload support using native file pickers and camera.
- **Native Notifications**: Implemented foreground polling and native system notifications for new messages.
- **Status Bar Sync**: The system status bar now automatically syncs with the app's theme (light/dark mode).
- **Core Feature Parity**: Validated WASM crypto fallback and essential features on mobile environment.
- **CI/CD**: Automated Android APK building via GitHub Actions (`mobile-release.yml`).


## [v0.4.0] - 2026-02-03

### Added
- **Mobile Experience Polish**: Added Swipe-to-Reply gestures, larger touch targets for better accessibility, and fixed virtual keyboard occlusion with `100dvh`.
- **Core Refinements**: Theme synchronization fix (FOUC), message deduplication, and v0.4.0 versioning.
- **Auto-Storage Configuration**: Automatically enables NIP-96 storage with `nostr.build` as default when hosted on Vercel to resolve "Local upload" errors out-of-the-box.
- **Improved Settings UI**: Recommended storage providers are now always visible with clear descriptions and one-tap selection.
- **Group Management Extensions**: Admins can now add members via public key, remove members from the settings sheet, and see role-based badges (Owner/Mod).
- **Group Chat Avatar Upload**: Support for uploading a group avatar during the creation process.
- **Group Metadata Editing**: Admins can now edit group name, description, and picture from the group settings sheet.
- **Group Invite ID**: Added "Copy Invite ID" functionality to easily share group joining information.
- **Native Avatar Upload**: Support for NIP-96 file uploads. Users can now upload profile pictures directly to Nostr storage providers or local storage.
- **NIP-05 Verification**: Built-in verification flow for NIP-05 identifiers (e.g., alice@domain.com). Displays verification status in settings.
- **DM Privacy Controls**: New granular privacy settings in "Privacy & Trust" tab. Users can now choose to Receive DMs from "Everyone" or "Contacts Only".
- **Enhanced DM Filtering**: Client-side filtering of direct messages from strangers when "Contacts Only" is enabled.

### Fixed
- **Theme Sync**: Resolved the "white flash" (FOUC) on initial load by implementing a blocking theme script in the root layout.
- **Message Deduplication**: Fixed a bug where duplicate group messages were rendered by implementing event ID filtering.
- **Profile Save Timeout**: Fixed an issue where saving the profile on Desktop would hang indefinitely.

### Changed
- **Profile Management**: Refactored profile settings with immediate local previews and NIP-05 integration.
- **Auto-Lock**: Changed default auto-lock timeout from `15m` to `Never` (0) for new accounts to improve initial user experience.

## [v0.3.7] - 2026-02-02

### Added
- **Message Reactions**: Support for NIP-25 reactions. Hover over a message to react with emojis. UI updates optimistically.
- **Multiple File Uploads**: Users can now select and upload multiple images/videos at once in the composer.
- **Automated Connection Requests**: Messaging an unaccepted peer now automatically triggers a formal connection request, improving the first-contact experience.
- **Request Notifications**: Visual feedback (Toasts and Sidebar Badges) for connection request status.

### Fixed
- **Desktop Uploads**: Fixed a 500 error in the desktop app by replacing `uuid` with `crypto.randomUUID()` to resolve bundling issues.
- **Inbox Deduplication**: Fixed a bug where the unread request count would increment infinitely by implementing event ID deduplication.
- **Sidebar Badges**: Fixed incorrect unread counts in the Sidebar "Requests" tab.

### Changed
- **Type Safety**: Refactored `ReactionsByEmoji` and `RequestsInboxItem` for better type safety and cleaner code.

## [v0.3.6] - 2026-02-01

### Fixed
- **SemVer Compliance**: Fixed build issue where version `0.3.5.1` was rejected by Tauri/Cargo. Bumping to `0.3.6` resolves this.

## [v0.3.5.1] - 2026-02-01

### Fixed
- **Build Error**: Fixed a TypeScript error in `lock-screen.tsx` where `onForget` was not destructured.
- **Identity Reset**: Added a "Forgot passphrase? Reset account" button to the Lock Screen and Locked Identity View. This allows users to manually clear their local data and start over.

## [v0.3.5] - 2026-02-01

### Added
- **Desktop/PWA Parity**: ensured feature parity between the Desktop app and PWA.

### Fixed
- **Profile Save Timeout**: Fixed an issue where saving the profile on Desktop would hang indefinitely due to a deadlock in the Crypto Worker.
- **Crypto Worker**: Forced the Crypto Service to use the main thread when running in Tauri context to avoid worker loading issues.
- **Connection Reliability**: Increased timeouts for Relay connection (5s -> 15s) and Publishing (5s -> 10s) to handle slower network conditions.
- **UI Popup Fixes**:
    - Removed the non-functional "Virtual Keyboard" help button from the Settings header.
    - Fixed the "Delete Account" dialog positioning by using React Portals to ensure it is always centered.

### Changed
- **Versioning**: Synchronized version across PWA, Desktop, and Tauri configuration.
