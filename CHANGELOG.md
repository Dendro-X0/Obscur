# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog.

## [Unreleased]

## [0.1.0] - 2026-01-09

### Added

- Obscur branding (metadata + PWA manifest).
- Responsive mobile navigation for chat shell (hamburger / off-canvas sidebar).
- Settings mobile hamburger menu (quick navigation drawer).
- PWA assets and routes (manifest, icons, service worker endpoint).
- Delivery status UI, unread badges, and notification preference handling.
- `desktop/` placeholder for the future Tauri v2 wrapper.

### Fixed

- `useSyncExternalStore` snapshot caching to prevent infinite update loops.
- PWA icon route handlers to avoid JSX parsing issues.
