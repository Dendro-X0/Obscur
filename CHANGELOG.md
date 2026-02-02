# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Changed
- **Auto-Lock**: Changed default auto-lock timeout from `15m` to `Never` (0) for new accounts to improve initial user experience.

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
