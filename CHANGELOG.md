# Changelog

All notable changes to this project will be documented in this file.

The format is based on Keep a Changelog.

## [Unreleased]

## [0.2.3] - 2026-01-11

### Fixed

- **Desktop App Crash**: Fixed immediate crash on startup by resolving configuration conflicts
  - Removed conflicting window creation in main.rs
  - Updated Tauri configuration to properly load external PWA URL
  - Configured build settings for external URL loading

## [0.2.2] - 2026-01-11

### Fixed

- **GitHub Workflow**: Fixed pnpm version mismatch between workflow and package.json

## [0.2.1] - 2026-01-11

### Fixed

- **GitHub Workflow**: Fixed pnpm installation order in release workflow to resolve build failures

## [0.2.0] - 2026-01-11

### Added

- **Enhanced UI/UX System**: Complete visual overhaul with subtle gradients and smooth animations
  - Gradient system with theme-aware backgrounds for main areas, sidebar, cards, and buttons
  - Enhanced empty states with illustrations and engaging copy for chats, search, relays, and requests
  - Comprehensive loading states including skeleton screens, progress indicators, and message status
  - Toast notification system with success, error, info, and warning types
  - Smooth theme transitions with reduced motion support
  - Enhanced micro-interactions for buttons and inputs with hover animations
  - Page transition animations with fade-in effects
  - Navigation feedback animations with active state indicators
  - Toggle switch animations for settings controls
  - Cross-browser compatibility with CSS fallbacks
  - Consistent shadow and border system for visual hierarchy

- **Automated Release System**: GitHub workflow for creating desktop app releases
  - Automatic release creation when version tags are pushed
  - Cross-platform builds (Windows MSI, macOS DMG, Linux AppImage/DEB)
  - Comprehensive release notes with feature highlights
  - Proper Tauri bundle configuration with metadata

### Improved

- **Visual Polish**: Subtle warm gradients in light theme, deep rich gradients in dark theme
- **User Feedback**: Better visual feedback for all interactive elements and loading states
- **Accessibility**: Maintained WCAG contrast ratios and added reduced motion support
- **Component Library**: Enhanced Button, Input, Card, and other UI components with gradient backgrounds
- **Performance**: Optimized animations for mobile devices and reduced motion preferences
- **Code Quality**: Fixed all linting issues and improved component structure
- **Repository Structure**: Cleaned up large files and improved .gitignore for better maintainability

### Fixed

- **Large File Issues**: Removed Rust build artifacts from Git history to enable GitHub pushes
- **Missing Assets**: Recovered logos and UI enhancements that were lost during repository cleanup

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
