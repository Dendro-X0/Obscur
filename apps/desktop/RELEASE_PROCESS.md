# Obscur Desktop Release Process

This document provides a comprehensive guide for developers on how to build and release the Obscur desktop application.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Release Workflow Overview](#release-workflow-overview)
- [Version Management](#version-management)
- [Building Locally](#building-locally)
- [Creating a Release](#creating-a-release)
- [GitHub Actions Workflow](#github-actions-workflow)
- [Code Signing Setup](#code-signing-setup)
- [Post-Release Tasks](#post-release-tasks)
- [Troubleshooting](#troubleshooting)

## Prerequisites

### Required Tools

1. **Node.js and pnpm**
   ```bash
   # Node.js 20+ required
   node --version  # Should be v20.x or higher
   
   # pnpm 9+ required
   pnpm --version  # Should be 9.x or higher
   ```

2. **Rust Toolchain**
   ```bash
   # Install Rust (if not already installed)
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   
   # Verify installation
   rustc --version
   cargo --version
   ```

3. **Platform-Specific Dependencies**

   **Windows**:
   - Visual Studio Build Tools with C++ workload
   - Windows 10 SDK
   
   **macOS**:
   ```bash
   xcode-select --install
   ```
   
   **Linux (Ubuntu/Debian)**:
   ```bash
   sudo apt-get update
   sudo apt-get install -y \
     libwebkit2gtk-4.0-dev \
     libwebkit2gtk-4.1-dev \
     libappindicator3-dev \
     librsvg2-dev \
     patchelf
   ```

### Repository Access

- **Write access** to the GitHub repository
- **Permissions** to create tags and releases
- **Access** to GitHub Actions secrets (for signing)

### Code Signing Certificates

For production releases, you'll need:
- **Windows**: Code signing certificate (see [CODE_SIGNING.md](./CODE_SIGNING.md))
- **macOS**: Apple Developer account and certificates (see [CODE_SIGNING.md](./CODE_SIGNING.md))
- **Linux**: No signing required

## Release Workflow Overview

```
1. Version Bump → 2. Local Testing → 3. Create Tag → 4. Push Tag → 5. CI/CD Build → 6. Verify Release
```

### Workflow Steps

1. **Version Bump**: Update version numbers in configuration files
2. **Local Testing**: Build and test locally on target platforms
3. **Create Tag**: Create a Git tag with the version number
4. **Push Tag**: Push the tag to GitHub to trigger the build
5. **CI/CD Build**: GitHub Actions builds for all platforms
6. **Verify Release**: Test installers and publish release notes

## Version Management

### Semantic Versioning

Obscur follows [Semantic Versioning](https://semver.org/):

- **MAJOR.MINOR.PATCH** (e.g., `1.2.3`)
  - **MAJOR**: Breaking changes or major feature releases
  - **MINOR**: New features, backward compatible
  - **PATCH**: Bug fixes, backward compatible

### Pre-release Versions

For testing and beta releases:
- **Alpha**: `1.0.0-alpha.1`
- **Beta**: `1.0.0-beta.1`
- **Release Candidate**: `1.0.0-rc.1`

### Version Files to Update

When bumping the version, update these files:

1. **apps/desktop/src-tauri/tauri.conf.json**
   ```json
   {
     "version": "1.2.3"
   }
   ```

2. **apps/desktop/package.json**
   ```json
   {
     "version": "1.2.3"
   }
   ```

3. **apps/desktop/src-tauri/Cargo.toml**
   ```toml
   [package]
   version = "1.2.3"
   ```

### Automated Version Bump Script

Create a script to update all version files:

```bash
#!/bin/bash
# bump-version.sh

NEW_VERSION=$1

if [ -z "$NEW_VERSION" ]; then
  echo "Usage: ./bump-version.sh <version>"
  echo "Example: ./bump-version.sh 1.2.3"
  exit 1
fi

# Update tauri.conf.json
sed -i.bak "s/\"version\": \".*\"/\"version\": \"$NEW_VERSION\"/" apps/desktop/src-tauri/tauri.conf.json

# Update package.json
sed -i.bak "s/\"version\": \".*\"/\"version\": \"$NEW_VERSION\"/" apps/desktop/package.json

# Update Cargo.toml
sed -i.bak "s/^version = \".*\"/version = \"$NEW_VERSION\"/" apps/desktop/src-tauri/Cargo.toml

# Remove backup files
rm apps/desktop/src-tauri/tauri.conf.json.bak
rm apps/desktop/package.json.bak
rm apps/desktop/src-tauri/Cargo.toml.bak

echo "✅ Version bumped to $NEW_VERSION"
echo "Next steps:"
echo "1. Review changes: git diff"
echo "2. Commit: git commit -am 'chore: bump version to $NEW_VERSION'"
echo "3. Tag: git tag v$NEW_VERSION"
echo "4. Push: git push origin main --tags"
```

Usage:
```bash
chmod +x bump-version.sh
./bump-version.sh 1.2.3
```

## Building Locally

### Development Build

For testing during development:

```bash
# Navigate to desktop app directory
cd apps/desktop

# Run in development mode (hot reload)
pnpm dev:desktop
```

This will:
- Start the PWA development server
- Launch Tauri in development mode
- Enable hot reload for frontend changes
- Show developer tools

### Production Build

Build for your current platform:

```bash
# Navigate to desktop app directory
cd apps/desktop

# Build the PWA first
cd ../pwa
pnpm build
cd ../desktop

# Build the desktop app
pnpm tauri build
```

Build output locations:
- **Windows**: `src-tauri/target/release/bundle/msi/` and `src-tauri/target/release/bundle/nsis/`
- **macOS**: `src-tauri/target/release/bundle/dmg/` and `src-tauri/target/release/bundle/macos/`
- **Linux**: `src-tauri/target/release/bundle/appimage/` and `src-tauri/target/release/bundle/deb/`

### Testing Production Builds

After building, test the installer:

**Windows**:
```powershell
# Install the MSI
msiexec /i src-tauri\target\release\bundle\msi\Obscur_x.x.x_x64_en-US.msi

# Or run the NSIS installer
.\src-tauri\target\release\bundle\nsis\Obscur_x.x.x_x64-setup.exe
```

**macOS**:
```bash
# Open the DMG
open src-tauri/target/release/bundle/dmg/Obscur_x.x.x_x64.dmg

# Or run the app directly
open src-tauri/target/release/bundle/macos/Obscur.app
```

**Linux**:
```bash
# Run the AppImage
chmod +x src-tauri/target/release/bundle/appimage/Obscur_x.x.x_amd64.AppImage
./src-tauri/target/release/bundle/appimage/Obscur_x.x.x_amd64.AppImage

# Or install the DEB
sudo dpkg -i src-tauri/target/release/bundle/deb/Obscur_x.x.x_amd64.deb
```

### Build Validation Checklist

Before creating a release, verify:

- [ ] App launches successfully
- [ ] All core features work (messaging, identity, relays)
- [ ] No console errors or warnings
- [ ] UI renders correctly at different window sizes
- [ ] Offline functionality works
- [ ] Auto-updater configuration is correct
- [ ] App icon displays correctly
- [ ] Window controls work (minimize, maximize, close)
- [ ] System notifications work
- [ ] Theme switching works
- [ ] Deep links work (if applicable)

## Creating a Release

### Step-by-Step Release Process

#### 1. Prepare the Release

```bash
# Ensure you're on the main branch
git checkout main
git pull origin main

# Ensure working directory is clean
git status

# Run tests
pnpm test

# Build and test locally
cd apps/desktop
pnpm tauri build
```

#### 2. Update Version Numbers

```bash
# Use the bump-version script
./bump-version.sh 1.2.3

# Or manually update:
# - apps/desktop/src-tauri/tauri.conf.json
# - apps/desktop/package.json
# - apps/desktop/src-tauri/Cargo.toml
```

#### 3. Update Changelog

Create or update `CHANGELOG.md`:

```markdown
## [1.2.3] - 2025-01-14

### Added
- New feature X
- New feature Y

### Changed
- Improved performance of Z
- Updated dependency A to version B

### Fixed
- Fixed bug #123
- Fixed crash when doing X

### Security
- Updated vulnerable dependency
```

#### 4. Commit Changes

```bash
# Stage changes
git add apps/desktop/src-tauri/tauri.conf.json
git add apps/desktop/package.json
git add apps/desktop/src-tauri/Cargo.toml
git add CHANGELOG.md

# Commit with conventional commit message
git commit -m "chore: release v1.2.3"
```

#### 5. Create and Push Tag

```bash
# Create annotated tag
git tag -a v1.2.3 -m "Release v1.2.3"

# Push commit and tag
git push origin main
git push origin v1.2.3
```

#### 6. Monitor GitHub Actions

1. Go to: https://github.com/obscur-app/obscur/actions
2. Find the workflow run for your tag
3. Monitor the build progress for all platforms
4. Wait for all jobs to complete (typically 15-30 minutes)

#### 7. Verify and Publish Release

1. Go to: https://github.com/obscur-app/obscur/releases
2. Find the draft release created by the workflow
3. **Verify**:
   - All platform installers are attached
   - Checksums are present
   - Version number is correct
   - Release notes are accurate
4. **Edit release notes** if needed
5. **Publish the release**

### Release Checklist

Before publishing:

- [ ] All platform builds completed successfully
- [ ] Installers are attached to the release
- [ ] Checksums are present and correct
- [ ] Release notes are complete and accurate
- [ ] Version number matches the tag
- [ ] Code signing succeeded (if configured)
- [ ] Auto-updater manifest is present
- [ ] Pre-release flag is set correctly
- [ ] Release is marked as "Latest" if appropriate

## GitHub Actions Workflow

### Workflow File

The build workflow is defined in `.github/workflows/tauri-build.yml`.

### Workflow Triggers

The workflow runs when:
- A tag matching `v*` is pushed (e.g., `v1.2.3`)
- Manually triggered via workflow dispatch

### Build Matrix

The workflow builds for multiple platforms:

| Platform | Runner | Targets |
|----------|--------|---------|
| Windows | `windows-latest` | x64 |
| macOS | `macos-latest` | x64, ARM64 (Apple Silicon) |
| Linux | `ubuntu-22.04` | x64 |

### Workflow Steps

1. **Checkout**: Clone the repository
2. **Setup Dependencies**: Install system dependencies (Linux only)
3. **Setup Rust**: Install Rust toolchain with required targets
4. **Setup Node.js**: Install Node.js and pnpm
5. **Install Dependencies**: Run `pnpm install`
6. **Build PWA**: Run `pnpm build:pwa`
7. **Build Desktop**: Use `tauri-action` to build and sign
8. **Create Release**: Upload artifacts to GitHub Releases

### Environment Variables

The workflow uses these environment variables:

**Always Available**:
- `GITHUB_TOKEN`: Automatically provided by GitHub

**Code Signing** (from secrets):
- `TAURI_SIGNING_PRIVATE_KEY`: Updater signing key
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: Updater key password
- `APPLE_CERTIFICATE`: macOS signing certificate
- `APPLE_CERTIFICATE_PASSWORD`: Certificate password
- `APPLE_SIGNING_IDENTITY`: Signing identity name
- `APPLE_ID`: Apple ID for notarization
- `APPLE_PASSWORD`: App-specific password
- `APPLE_TEAM_ID`: Apple Developer Team ID

### Conditional Signing

The workflow supports conditional signing:
- **With secrets**: Builds are signed and notarized
- **Without secrets**: Builds are unsigned (development/testing)

This allows:
- Development builds without certificates
- Production builds with full signing

### Manual Workflow Dispatch

To manually trigger a build:

1. Go to: https://github.com/obscur-app/obscur/actions
2. Select "Build and Release Desktop App" workflow
3. Click "Run workflow"
4. Select branch and enter parameters
5. Click "Run workflow"

## Code Signing Setup

### Overview

Code signing is required for production releases to:
- Avoid security warnings on user systems
- Enable automatic updates
- Establish trust with users

### Quick Setup Guide

For detailed instructions, see [CODE_SIGNING.md](./CODE_SIGNING.md).

#### Windows Code Signing

1. **Obtain Certificate**:
   - Purchase from Sectigo, DigiCert, or GlobalSign
   - EV certificate recommended ($400-600/year)
   - Standard certificate acceptable ($200-400/year)

2. **Configure GitHub Secrets**:
   - `TAURI_SIGNING_WINDOWS_CERTIFICATE_THUMBPRINT`
   - `WINDOWS_CERTIFICATE` (optional)
   - `WINDOWS_CERTIFICATE_PASSWORD` (optional)

3. **Verify Configuration**:
   ```bash
   # Check certificate is installed
   Get-ChildItem -Path Cert:\CurrentUser\My
   ```

#### macOS Code Signing

1. **Obtain Certificate**:
   - Join Apple Developer Program ($99/year)
   - Create "Developer ID Application" certificate
   - Note your Team ID

2. **Configure GitHub Secrets**:
   - `APPLE_SIGNING_IDENTITY`
   - `APPLE_TEAM_ID`
   - `APPLE_ID`
   - `APPLE_PASSWORD` (app-specific password)
   - `APPLE_CERTIFICATE` (optional)
   - `APPLE_CERTIFICATE_PASSWORD` (optional)

3. **Verify Configuration**:
   ```bash
   # List signing identities
   security find-identity -v -p codesigning
   ```

#### Updater Signing Keys

Separate from code signing, updater keys are used to sign update packages:

1. **Generate Keys** (already done):
   ```bash
   pnpm tauri signer generate -w src-tauri/updater-key.txt --ci
   ```

2. **Configure GitHub Secrets**:
   - `TAURI_SIGNING_PRIVATE_KEY`: Contents of `updater-key.txt`
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`: Password (if set)

3. **Security**:
   - Private key is in `.gitignore`
   - Store backup in secure location
   - Never commit to version control

### Testing Signed Builds

#### Windows
```powershell
# Verify signature
Get-AuthenticodeSignature "path\to\Obscur.exe"
```

#### macOS
```bash
# Verify code signature
codesign -dv --verbose=4 /Applications/Obscur.app

# Verify notarization
spctl -a -vv /Applications/Obscur.app
```

## Post-Release Tasks

### 1. Verify Release

After publishing:

- [ ] Download installers for each platform
- [ ] Test installation on clean systems
- [ ] Verify app launches and core features work
- [ ] Test auto-updater (if updating from previous version)
- [ ] Check that signed builds don't show security warnings

### 2. Update Documentation

- [ ] Update version in README.md
- [ ] Update installation instructions if needed
- [ ] Update screenshots if UI changed
- [ ] Update feature documentation

### 3. Announce Release

- [ ] Post release announcement in GitHub Discussions
- [ ] Update website download links
- [ ] Notify community channels
- [ ] Update social media

### 4. Monitor for Issues

- [ ] Watch GitHub Issues for bug reports
- [ ] Monitor community channels for feedback
- [ ] Check analytics for crash reports
- [ ] Review auto-updater metrics

### 5. Plan Next Release

- [ ] Review feedback and issues
- [ ] Plan features for next version
- [ ] Update project roadmap
- [ ] Create milestone for next release

## Troubleshooting

### Build Failures

#### "Failed to build PWA"

**Symptoms**:
- Build fails during PWA build step
- Error: "Command failed: pnpm build:pwa"

**Solutions**:
1. Check PWA builds locally: `cd apps/pwa && pnpm build`
2. Verify all dependencies are installed: `pnpm install`
3. Check for TypeScript errors: `pnpm type-check`
4. Review build logs for specific errors

#### "Rust compilation failed"

**Symptoms**:
- Build fails during Rust compilation
- Error: "error: could not compile..."

**Solutions**:
1. Update Rust toolchain: `rustup update`
2. Clean build cache: `cargo clean`
3. Check Cargo.toml for dependency issues
4. Verify platform-specific dependencies are installed

#### "Tauri build failed"

**Symptoms**:
- Build fails during Tauri bundling
- Error: "Error: Command failed..."

**Solutions**:
1. Check tauri.conf.json for syntax errors
2. Verify all required icons are present
3. Check bundle configuration for platform
4. Review Tauri logs for specific errors

### Signing Failures

#### Windows: "Certificate not found"

**Symptoms**:
- Build succeeds but signing fails
- Warning: "Skipping Windows signing"

**Solutions**:
1. Verify certificate thumbprint is correct
2. Check certificate is installed in correct store
3. Ensure `TAURI_SIGNING_WINDOWS_CERTIFICATE_THUMBPRINT` secret is set
4. Verify certificate hasn't expired

#### macOS: "Notarization failed"

**Symptoms**:
- Build succeeds but notarization fails
- Error: "Error: Unable to notarize app"

**Solutions**:
1. Verify Apple ID and app-specific password
2. Check signing identity is correct
3. Ensure app is properly signed first
4. Review notarization logs: `xcrun notarytool log <id>`
5. Check Apple Developer account status

#### "Updater signing failed"

**Symptoms**:
- Build succeeds but update manifest is missing
- Error: "Failed to sign update"

**Solutions**:
1. Verify `TAURI_SIGNING_PRIVATE_KEY` secret is set
2. Check private key format is correct
3. Verify password is correct (if set)
4. Regenerate keys if corrupted

### Release Failures

#### "Failed to create release"

**Symptoms**:
- Build succeeds but release creation fails
- Error: "Error: Failed to create release"

**Solutions**:
1. Check GitHub token permissions
2. Verify tag doesn't already exist
3. Ensure repository has releases enabled
4. Check for API rate limits

#### "Failed to upload assets"

**Symptoms**:
- Release created but assets missing
- Error: "Error: Failed to upload asset"

**Solutions**:
1. Check asset file sizes (GitHub limit: 2GB)
2. Verify network connectivity
3. Retry upload manually if needed
4. Check GitHub status page for outages

### Workflow Failures

#### "Workflow not triggered"

**Symptoms**:
- Tag pushed but workflow doesn't run
- No workflow run appears in Actions tab

**Solutions**:
1. Verify tag matches pattern `v*`
2. Check workflow file syntax
3. Ensure workflows are enabled in repository settings
4. Verify you have permissions to trigger workflows

#### "Job timed out"

**Symptoms**:
- Workflow runs but times out
- Error: "The job running on runner... has exceeded the maximum execution time"

**Solutions**:
1. Check for infinite loops or hanging processes
2. Optimize build steps to reduce time
3. Split into multiple jobs if needed
4. Contact GitHub support if persistent

#### "Runner out of disk space"

**Symptoms**:
- Build fails with disk space error
- Error: "No space left on device"

**Solutions**:
1. Clean up build artifacts in workflow
2. Use `actions/cache` to cache dependencies
3. Remove unnecessary files before building
4. Use larger runner if available

### Testing Failures

#### "Installer won't run on test system"

**Symptoms**:
- Installer downloads but won't execute
- Security warnings or errors

**Solutions**:
1. Verify installer is signed (production builds)
2. Check system requirements are met
3. Test on clean VM or fresh install
4. Review installer logs for errors

#### "App crashes on launch"

**Symptoms**:
- Installer succeeds but app crashes
- Error dialog or silent crash

**Solutions**:
1. Check system dependencies are installed
2. Review app logs for crash details
3. Test on multiple systems
4. Verify build configuration is correct

#### "Auto-updater not working"

**Symptoms**:
- App doesn't detect updates
- Update check fails

**Solutions**:
1. Verify updater configuration in tauri.conf.json
2. Check update manifest is present in release
3. Verify signature is correct
4. Test with older version to newer version

## Best Practices

### Version Control

1. **Always work on main branch** for releases
2. **Use feature branches** for development
3. **Tag releases** with annotated tags
4. **Keep tags immutable** - never delete or move tags

### Testing

1. **Test locally** before creating release
2. **Test on clean systems** to catch dependency issues
3. **Test upgrades** from previous versions
4. **Test on all supported platforms**

### Security

1. **Never commit secrets** to version control
2. **Rotate certificates** before expiration
3. **Keep signing keys secure** in password manager
4. **Review dependencies** for vulnerabilities

### Communication

1. **Write clear release notes** for users
2. **Document breaking changes** prominently
3. **Announce releases** in community channels
4. **Respond to feedback** quickly

### Automation

1. **Use scripts** to automate repetitive tasks
2. **Validate builds** before releasing
3. **Monitor workflows** for failures
4. **Keep workflows updated** with latest actions

## Additional Resources

### Documentation

- **Tauri Documentation**: https://tauri.app/
- **Tauri v2 Guide**: https://v2.tauri.app/
- **GitHub Actions**: https://docs.github.com/en/actions
- **Semantic Versioning**: https://semver.org/

### Internal Documentation

- **[README.md](./README.md)**: General desktop app documentation
- **[CODE_SIGNING.md](./CODE_SIGNING.md)**: Detailed code signing guide
- **[GITHUB_SECRETS.md](./GITHUB_SECRETS.md)**: GitHub secrets setup
- **[AUTO_UPDATER_SETUP.md](./AUTO_UPDATER_SETUP.md)**: Auto-updater configuration

### Support

- **GitHub Issues**: https://github.com/obscur-app/obscur/issues
- **GitHub Discussions**: https://github.com/obscur-app/obscur/discussions
- **Development Team**: Contact via repository

## Changelog

### 2025-01-14
- Initial release process documentation
- Added comprehensive troubleshooting guide
- Documented GitHub Actions workflow
- Added code signing setup instructions

---

**Questions?** Open an issue or discussion in the GitHub repository.
