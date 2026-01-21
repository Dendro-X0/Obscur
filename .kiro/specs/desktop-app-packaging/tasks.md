# Implementation Plan: Desktop App Packaging

## Overview

This implementation plan creates a complete desktop app packaging and distribution system for Obscur using Tauri v2. The approach focuses on getting a working desktop app that can be built, signed, and distributed through GitHub Releases as quickly as possible.

## Tasks

- [x] 1. Configure Tauri for production builds
  - [x] 1.1 Update tauri.conf.json with complete configuration
    - Add proper app metadata and bundle settings
    - Configure bundle formats for all platforms
    - Set up security and permissions
    - _Requirements: 1.1, 1.2, 1.3, 6.1, 6.2_

  - [x] 1.2 Create app icons and assets
    - Generate icons in all required sizes and formats
    - Add Windows ICO, macOS ICNS, and Linux PNG icons
    - Create installer assets and branding
    - _Requirements: 6.1, 6.2_

  - [ ] 1.3 Configure PWA build for desktop packaging
    - Update Next.js config for static export
    - Add build script to generate static PWA output
    - Update tauri.conf.json to point to PWA build output
    - Ensure offline functionality works in desktop context
    - _Requirements: 5.1, 5.3, 5.4_

- [x] 2. Set up GitHub Actions build pipeline
  - [x] 2.1 Create multi-platform build workflow
    - Set up build matrix for Windows, macOS, and Linux
    - Configure Rust and Node.js environments
    - Add system dependency installation steps
    - _Requirements: 7.1, 7.2, 7.3_

  - [x] 2.2 Integrate tauri-action for automated builds
    - Configure tauri-action with proper parameters
    - Set up release creation and asset uploads
    - Add build artifact organization
    - _Requirements: 3.1, 3.2, 7.4_

  - [x] 2.3 Configure build triggers and versioning
    - Set up tag-based release triggers
    - Implement semantic versioning
    - Add manual workflow dispatch option
    - _Requirements: 3.5, 7.2_

- [x] 3. Implement code signing (initial setup)
  - [x] 3.1 Set up Windows code signing configuration
    - Configure Authenticode signing in tauri.conf.json
    - Add certificate placeholder and timestamp URL
    - Document certificate acquisition process
    - _Requirements: 2.1, 2.3, 2.4_

  - [x] 3.2 Set up macOS code signing configuration
    - Configure Apple Developer signing identity
    - Add notarization settings
    - Document Apple Developer account requirements
    - _Requirements: 2.2, 2.3, 2.4_

  - [x] 3.3 Add signing secrets to GitHub Actions
    - Document required GitHub secrets
    - Add conditional signing based on secret availability
    - Implement fallback for unsigned development builds
    - _Requirements: 2.3, 2.4, 2.5_

- [x] 4. Configure auto-updater system
  - [x] 4.1 Set up updater plugin configuration
    - Enable Tauri updater plugin in tauri.conf.json
    - Configure GitHub Releases endpoint
    - Generate and configure signing keys
    - _Requirements: 4.1, 4.2, 4.5_

  - [x] 4.2 Implement update checking in the app
    - Add Tauri updater API integration in Rust
    - Create update check on app startup
    - Add manual update check command
    - _Requirements: 4.1, 4.3, 4.4_

  - [x] 4.3 Add update notification UI in PWA
    - Create update notification component
    - Implement update installation flow
    - Add restart mechanism for updates
    - _Requirements: 4.2, 4.3, 4.5_

- [x] 5. Enhance desktop-specific features
  - [x] 5.1 Add Tauri API integration layer
    - Create TypeScript types for Tauri APIs
    - Add detection for desktop vs web environment
    - Implement feature detection and fallbacks
    - _Requirements: 5.1, 5.2, 8.2_

  - [x] 5.2 Implement native window controls
    - Add Tauri window API commands in Rust
    - Create window control UI components
    - Implement window minimize, maximize, close
    - Configure window size and position persistence
    - _Requirements: 8.2, 8.1_

  - [x] 5.3 Implement desktop notifications
    - Add Tauri notification plugin
    - Integrate with existing PWA notification system
    - Handle notification permissions and preferences
    - _Requirements: 8.2, 8.5_

  - [x] 5.4 Add system theme integration
    - Add Tauri theme detection API
    - Sync with existing theme system
    - Maintain theme preferences across restarts
    - _Requirements: 8.3, 8.1_

- [x] 6. Optimize PWA for desktop integration
  - [x] 6.1 Add desktop-specific UI adaptations
    - Adjust layouts for desktop window sizes
    - Add keyboard shortcuts for desktop users
    - Implement desktop-specific navigation patterns
    - Hide PWA-specific UI elements in desktop mode
    - _Requirements: 5.1, 8.2_

  - [x] 6.2 Ensure offline functionality
    - Verify service worker works in Tauri context
    - Test offline message storage and sync
    - Maintain relay connections across app restarts
    - _Requirements: 5.3, 5.4, 8.4_

  - [x] 6.3 Add deep link handling
    - Configure custom URL scheme in tauri.conf.json
    - Implement deep link handler in Rust
    - Add invite link handling for desktop
    - _Requirements: 5.4, 8.2_

- [x] 7. Test and validate builds
  - [x] 7.1 Test local development builds
    - Verify `pnpm dev:desktop` works with local PWA
    - Test hot reload and development features
    - Ensure PWA integration works in dev mode
    - _Requirements: 5.1, 5.2_

  - [x] 7.2 Test production builds locally
    - Build and test Windows installer (MSI/NSIS)
    - Build and test macOS bundle (DMG)
    - Build and test Linux packages (AppImage/DEB)
    - _Requirements: 1.1, 1.2, 1.3, 6.1_

  - [x] 7.3 Validate GitHub Actions workflow
    - Test workflow with dummy releases
    - Verify all platforms build successfully
    - Check release asset uploads and organization
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

- [x] 8. Create distribution documentation
  - [x] 8.1 Document installation process
    - Create installation guides for each platform
    - Document system requirements
    - Add troubleshooting section
    - _Requirements: 6.1, 6.2, 6.4_

  - [x] 8.2 Document build and release process
    - Create developer guide for releases
    - Document code signing certificate setup
    - Add CI/CD troubleshooting guide
    - _Requirements: 7.1, 7.2, 7.5_

  - [x] 8.3 Create user migration guide
    - Document how to migrate from PWA to desktop
    - Explain data synchronization between versions
    - Add feature comparison between PWA and desktop
    - _Requirements: 5.1, 8.1_

- [x] 9. Final integration and testing
  - [x] 9.1 End-to-end testing
    - Test complete build and release pipeline
    - Verify installers work on clean systems
    - Test auto-updater with real releases
    - _Requirements: All requirements_

  - [x] 9.2 Performance optimization
    - Optimize app startup time
    - Reduce bundle sizes where possible
    - Test memory usage and performance
    - _Requirements: 1.5, 5.5_

  - [x] 9.3 Security validation
    - Verify code signing works correctly
    - Test update signature verification
    - Validate security permissions and CSP
    - _Requirements: 2.1, 2.2, 2.3, 4.5_

## Notes

- Tasks 1.1, 1.2, 2.1, 2.2, and 2.3 are already completed
- The main gap is PWA integration - desktop currently points to remote URL instead of local build
- Code signing and auto-updater need to be configured
- Desktop-specific features (window controls, notifications, theme) need implementation
- The build pipeline exists but needs PWA build integration
- Initial releases can be unsigned for testing purposes
- Auto-updater requires proper signing keys for security