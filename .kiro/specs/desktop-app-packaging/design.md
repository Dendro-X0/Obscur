# Design Document

## Overview

This design document outlines the implementation of a complete desktop app packaging and distribution system for Obscur using Tauri v2. The design focuses on creating production-ready installers for Windows, macOS, and Linux, with automated builds, code signing, and distribution through GitHub Releases.

## Architecture

### Build Pipeline Architecture

```
Desktop App Packaging System
├── Tauri Configuration
│   ├── App metadata and icons
│   ├── Bundle format specifications
│   └── Security and permissions
├── GitHub Actions Workflow
│   ├── Multi-platform build matrix
│   ├── Code signing integration
│   └── Release automation
├── PWA Integration
│   ├── Frontend build optimization
│   ├── Asset bundling
│   └── Offline functionality
└── Distribution System
    ├── GitHub Releases
    ├── Auto-updater configuration
    └── Download verification
```

### Platform-Specific Considerations

**Windows:**
- MSI installer for enterprise deployment
- NSIS installer for consumer distribution
- Code signing with Authenticode certificates
- SmartScreen compatibility

**macOS:**
- DMG bundle for easy installation
- App notarization for Gatekeeper
- Universal binaries for Intel and Apple Silicon
- Keychain integration for secure storage

**Linux:**
- AppImage for universal compatibility
- DEB packages for Debian/Ubuntu
- Flatpak support for sandboxed distribution
- Desktop integration files

## Components and Interfaces

### Tauri Configuration

#### Enhanced tauri.conf.json

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "Obscur",
  "identifier": "app.obscur.desktop",
  "version": "1.0.0",
  "build": {
    "frontendDist": "../pwa/out",
    "beforeBuildCommand": "pnpm build:pwa",
    "beforeDevCommand": "pnpm dev:pwa"
  },
  "bundle": {
    "active": true,
    "targets": ["msi", "nsis", "deb", "appimage", "dmg"],
    "icon": [
      "icons/32x32.png",
      "icons/128x128.png",
      "icons/128x128@2x.png",
      "icons/icon.icns",
      "icons/icon.ico"
    ],
    "resources": ["assets/*"],
    "copyright": "Copyright © 2025 Obscur",
    "category": "Network",
    "shortDescription": "Private, decentralized messaging",
    "longDescription": "Obscur is a local-first Nostr messenger designed for small, invite-only micro-communities.",
    "windows": {
      "certificateThumbprint": null,
      "digestAlgorithm": "sha256",
      "timestampUrl": "http://timestamp.sectigo.com"
    },
    "macOS": {
      "frameworks": [],
      "minimumSystemVersion": "10.13",
      "signingIdentity": null,
      "providerShortName": null,
      "entitlements": null
    },
    "linux": {
      "deb": {
        "depends": ["libwebkit2gtk-4.0-37", "libgtk-3-0"]
      }
    }
  },
  "app": {
    "windows": [
      {
        "title": "Obscur",
        "width": 1200,
        "height": 800,
        "minWidth": 800,
        "minHeight": 600,
        "resizable": true,
        "fullscreen": false,
        "decorations": true,
        "transparent": false,
        "alwaysOnTop": false,
        "contentProtected": false,
        "skipTaskbar": false
      }
    ],
    "security": {
      "csp": "default-src 'self'; connect-src 'self' wss: https:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'"
    }
  },
  "plugins": {
    "updater": {
      "active": true,
      "endpoints": [
        "https://api.github.com/repos/{{owner}}/{{repo}}/releases/latest"
      ],
      "dialog": true,
      "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IEFBQUFBQUFBQUFBQUFBQUE="
    }
  }
}
```

### GitHub Actions Workflow

#### Complete Build and Release Workflow

```yaml
name: 'Build and Release Desktop App'

on:
  push:
    tags:
      - 'v*'
  workflow_dispatch:

jobs:
  build-and-release:
    permissions:
      contents: write
    strategy:
      fail-fast: false
      matrix:
        include:
          - platform: 'macos-latest'
            args: '--target aarch64-apple-darwin'
          - platform: 'macos-latest'
            args: '--target x86_64-apple-darwin'
          - platform: 'ubuntu-22.04'
            args: ''
          - platform: 'windows-latest'
            args: ''

    runs-on: ${{ matrix.platform }}
    steps:
      - name: Checkout repository
        uses: actions/checkout@v4

      - name: Install dependencies (ubuntu only)
        if: matrix.platform == 'ubuntu-22.04'
        run: |
          sudo apt-get update
          sudo apt-get install -y libwebkit2gtk-4.0-dev libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev patchelf

      - name: Rust setup
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: ${{ matrix.platform == 'macos-latest' && 'aarch64-apple-darwin,x86_64-apple-darwin' || '' }}

      - name: Rust cache
        uses: swatinem/rust-cache@v2
        with:
          workspaces: './apps/desktop/src-tauri -> target'

      - name: Sync node version and setup cache
        uses: actions/setup-node@v4
        with:
          node-version: 'lts/*'
          cache: 'pnpm'

      - name: Install pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Install frontend dependencies
        run: pnpm install

      - name: Build PWA
        run: pnpm build:pwa

      - name: Build the app
        uses: tauri-apps/tauri-action@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          TAURI_SIGNING_PRIVATE_KEY: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY }}
          TAURI_SIGNING_PRIVATE_KEY_PASSWORD: ${{ secrets.TAURI_SIGNING_PRIVATE_KEY_PASSWORD }}
          APPLE_CERTIFICATE: ${{ secrets.APPLE_CERTIFICATE }}
          APPLE_CERTIFICATE_PASSWORD: ${{ secrets.APPLE_CERTIFICATE_PASSWORD }}
          APPLE_SIGNING_IDENTITY: ${{ secrets.APPLE_SIGNING_IDENTITY }}
          APPLE_ID: ${{ secrets.APPLE_ID }}
          APPLE_PASSWORD: ${{ secrets.APPLE_PASSWORD }}
          APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
        with:
          tagName: ${{ github.ref_name }}
          releaseName: 'Obscur Desktop v__VERSION__'
          releaseBody: 'See the assets to download and install this version.'
          releaseDraft: true
          prerelease: false
          args: ${{ matrix.args }}
          projectPath: './apps/desktop'
```

### PWA Integration Layer

#### Frontend Build Configuration

```typescript
// next.config.ts modifications for desktop
const isDesktop = process.env.TAURI_PLATFORM !== undefined;

const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  assetPrefix: isDesktop ? undefined : process.env.ASSET_PREFIX,
  // Optimize for desktop packaging
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-avatar']
  }
};
```

#### Tauri-Specific Features

```typescript
// Desktop-specific functionality
interface DesktopFeatures {
  notifications: {
    show(title: string, body: string): Promise<void>;
    requestPermission(): Promise<boolean>;
  };
  updater: {
    checkForUpdates(): Promise<UpdateInfo | null>;
    installUpdate(): Promise<void>;
  };
  window: {
    minimize(): Promise<void>;
    maximize(): Promise<void>;
    close(): Promise<void>;
    setTitle(title: string): Promise<void>;
  };
  fileSystem: {
    saveFile(data: string, filename: string): Promise<void>;
    openFile(): Promise<string | null>;
  };
}
```

## Data Models

### Build Configuration Model

```typescript
interface BuildConfig {
  version: string;
  platforms: Array<'windows' | 'macos' | 'linux'>;
  bundleFormats: {
    windows: Array<'msi' | 'nsis'>;
    macos: Array<'dmg' | 'app'>;
    linux: Array<'deb' | 'appimage' | 'rpm'>;
  };
  signing: {
    enabled: boolean;
    certificates: {
      windows?: WindowsCertificate;
      macos?: MacOSCertificate;
    };
  };
  updater: {
    enabled: boolean;
    endpoint: string;
    publicKey: string;
  };
}

interface WindowsCertificate {
  thumbprint: string;
  timestampUrl: string;
  digestAlgorithm: 'sha256' | 'sha1';
}

interface MacOSCertificate {
  signingIdentity: string;
  providerShortName: string;
  appleId: string;
  teamId: string;
}
```

### Release Information Model

```typescript
interface ReleaseInfo {
  version: string;
  tagName: string;
  releaseNotes: string;
  assets: Array<{
    name: string;
    platform: string;
    architecture: string;
    downloadUrl: string;
    checksum: string;
    size: number;
  }>;
  publishedAt: Date;
  prerelease: boolean;
}

interface UpdateInfo {
  available: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseNotes: string;
  downloadUrl: string;
  signature: string;
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Cross-Platform Build Completeness
*For any* supported platform (Windows, macOS, Linux), the build system should generate appropriate installer formats without errors
**Validates: Requirements 1.1, 1.2, 1.3, 1.4**

### Property 2: Bundle Dependency Inclusion
*For any* generated bundle, all necessary runtime dependencies should be included and functional
**Validates: Requirements 1.4, 1.5**

### Property 3: Code Signing Verification
*For any* signed executable, the digital signature should be valid and verifiable by the target platform
**Validates: Requirements 2.1, 2.2, 2.3, 2.4**

### Property 4: GitHub Release Automation
*For any* version tag creation, the build system should automatically create and upload release artifacts
**Validates: Requirements 3.1, 3.2, 3.5, 7.2**

### Property 5: Update Verification System
*For any* available update, the auto-updater should verify signatures before installation
**Validates: Requirements 4.5, 2.3**

### Property 6: PWA Integration Consistency
*For any* desktop app launch, the PWA should load with the same functionality as the web version
**Validates: Requirements 5.1, 5.3**

### Property 7: Installation Experience Quality
*For any* installer execution, the process should complete successfully with appropriate shortcuts and file associations
**Validates: Requirements 6.1, 6.2, 6.3**

### Property 8: Build Automation Reliability
*For any* code push or tag creation, the CI/CD system should execute builds consistently and report status accurately
**Validates: Requirements 7.1, 7.2, 7.3, 7.4, 7.5**

### Property 9: Configuration Persistence
*For any* user preference or app setting, the data should persist correctly across app restarts
**Validates: Requirements 8.1, 8.4**

### Property 10: Native Feature Integration
*For any* desktop-specific feature (notifications, window controls, system theme), the functionality should work as expected on the target platform
**Validates: Requirements 8.2, 8.3, 8.5**

## Error Handling

### Build Failure Recovery
- **Dependency Issues**: Provide clear error messages for missing system dependencies
- **Signing Failures**: Graceful fallback to unsigned builds with appropriate warnings
- **Platform Compatibility**: Skip unsupported platforms with informative logging

### Distribution Error Handling
- **Upload Failures**: Retry mechanism for GitHub release uploads
- **Checksum Mismatches**: Automatic re-generation of corrupted assets
- **Network Issues**: Offline-capable installer with cached resources

### Update System Error Handling
- **Signature Verification**: Reject updates with invalid signatures
- **Download Interruption**: Resume capability for large update files
- **Installation Failures**: Rollback mechanism to previous version

## Testing Strategy

### Dual Testing Approach
This feature requires both unit tests and integration tests to ensure comprehensive coverage:

**Unit Tests** will verify:
- Build configuration parsing and validation
- Code signing certificate handling
- Update signature verification
- PWA integration layer functionality

**Integration Tests** will verify:
- Complete build pipeline execution
- Cross-platform installer functionality
- Auto-updater end-to-end workflow
- GitHub Actions workflow execution

### Property-Based Testing Configuration
- **Framework**: Use GitHub Actions matrix testing for cross-platform validation
- **Test Environments**: Windows Server 2022, macOS 12+, Ubuntu 22.04
- **Signing Testing**: Use test certificates for validation
- **Update Testing**: Mock GitHub API for update scenarios

### Manual Testing Requirements
- **Installation Testing**: Manual verification on clean systems
- **Update Testing**: Test update flow from previous versions
- **Security Testing**: Verify code signing and certificate validation
- **User Experience**: Test installation wizard flows

### Performance Testing
- **Build Times**: Monitor and optimize build duration
- **Bundle Sizes**: Track installer size across versions
- **Startup Performance**: Measure app launch time
- **Memory Usage**: Monitor desktop app resource consumption