# Obscur Desktop

Cross-platform desktop application for Obscur, built with Tauri v2.

## Overview

This is the desktop wrapper for the Obscur PWA, providing native desktop features and improved performance across Windows, macOS, and Linux.

## Development

### Prerequisites

- Node.js 20+
- pnpm 9+
- Rust (latest stable)
- Platform-specific dependencies:
  - **Windows**: Visual Studio Build Tools
  - **macOS**: Xcode Command Line Tools
  - **Linux**: webkit2gtk, gtk3, libappindicator3

### Setup

```bash
# Install dependencies
pnpm install

# Run in development mode
pnpm dev:desktop
```

### Building

```bash
# Build for current platform
pnpm tauri build

# Build with verbose output
pnpm tauri build --verbose
```

## Code Signing

For production releases, code signing is required to avoid security warnings.

### Documentation

- **[CODE_SIGNING.md](./CODE_SIGNING.md)** - Complete guide to obtaining and configuring code signing certificates
- **[GITHUB_SECRETS.md](./GITHUB_SECRETS.md)** - Step-by-step instructions for configuring GitHub Actions secrets

### Quick Start

1. **Development/Testing**: Builds work without signing (will show security warnings)
2. **Production**: Follow the guides above to configure signing certificates

### Signing Status

The build workflow supports conditional signing:
- ✅ **With secrets configured**: Signed and notarized builds
- ⚠️ **Without secrets**: Unsigned builds (development only)

## Distribution

Releases are automatically built and published via GitHub Actions when version tags are pushed:

```bash
# Create and push a release tag
git tag v1.0.0
git push origin v1.0.0
```

The workflow will:
1. Build for Windows, macOS, and Linux
2. Sign executables (if certificates configured)
3. Create GitHub Release with installers
4. Upload build artifacts

## Platform Support

### Windows
- **Formats**: MSI, NSIS
- **Minimum**: Windows 10
- **Signing**: Authenticode (optional)

### macOS
- **Formats**: DMG, APP
- **Minimum**: macOS 10.13 (High Sierra)
- **Signing**: Developer ID + Notarization (optional)

### Linux
- **Formats**: AppImage, DEB
- **Minimum**: Ubuntu 20.04+ or equivalent
- **Signing**: Not required

## Configuration

### Tauri Configuration

Main configuration file: `src-tauri/tauri.conf.json`

Key settings:
- App metadata and version
- Bundle formats and icons
- Window configuration
- Security policies
- Plugin configuration

### Environment Variables

**Development**:
- `OBSCUR_DESKTOP_URL` - Override PWA URL (default: production URL)

**Build/Signing**:
- `TAURI_SIGNING_WINDOWS_CERTIFICATE_THUMBPRINT` - Windows certificate thumbprint
- `APPLE_SIGNING_IDENTITY` - macOS signing identity
- `APPLE_TEAM_ID` - Apple Developer Team ID
- `APPLE_ID` - Apple ID for notarization
- `APPLE_PASSWORD` - App-specific password

See [GITHUB_SECRETS.md](./GITHUB_SECRETS.md) for complete list.

## Troubleshooting

### Build Errors

**"webkit2gtk not found" (Linux)**:
```bash
sudo apt-get update
sudo apt-get install -y libwebkit2gtk-4.1-dev libgtk-3-dev
```

**"Xcode not found" (macOS)**:
```bash
xcode-select --install
```

**"MSVC not found" (Windows)**:
Install Visual Studio Build Tools with C++ workload

### Signing Issues

See the troubleshooting sections in:
- [CODE_SIGNING.md](./CODE_SIGNING.md#troubleshooting)
- [GITHUB_SECRETS.md](./GITHUB_SECRETS.md#troubleshooting)

## Resources

- [Tauri Documentation](https://tauri.app/)
- [Tauri v2 Guide](https://v2.tauri.app/start/)
- [Code Signing Guide](./CODE_SIGNING.md)
- [GitHub Secrets Setup](./GITHUB_SECRETS.md)

## License

See the main repository LICENSE file.
