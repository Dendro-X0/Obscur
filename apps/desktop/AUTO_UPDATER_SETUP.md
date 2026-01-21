# Auto-Updater Setup Guide

This document describes the auto-updater system that has been configured for the Obscur desktop application.

## Overview

The auto-updater system allows the desktop app to automatically check for and install updates from GitHub Releases. It uses Tauri's built-in updater plugin with cryptographic signature verification for security.

## Components

### 1. Tauri Configuration (`tauri.conf.json`)

The updater plugin is configured with:
- **Active**: Enabled for production builds
- **Endpoint**: GitHub Releases API endpoint
- **Dialog**: Built-in update dialog enabled
- **Public Key**: Embedded in the app for signature verification

```json
{
  "plugins": {
    "updater": {
      "active": true,
      "endpoints": [
        "https://github.com/obscur-app/obscur/releases/latest/download/latest.json"
      ],
      "dialog": true,
      "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDA2MUFCOTdBNTkxOTI4RTcKUldUbktCbFplcmthQmprMHRXbHVqNVZ6eDE4aVBYLzJ4SjVlai9MS2ZCRkl4ek9QM1orNnNuZjcK"
    }
  }
}
```

### 2. Rust Backend (`src-tauri/src/main.rs`)

The Rust backend implements:

#### Automatic Update Check on Startup
```rust
.setup(|app| {
    let app_handle = app.handle().clone();
    tauri::async_runtime::spawn(async move {
        if let Ok(updater) = app_handle.updater_builder().build() {
            if let Ok(Some(update)) = updater.check().await {
                println!("Update available: {}", update.version);
            }
        }
    });
    Ok(())
})
```

#### Manual Update Check Command
```rust
#[tauri::command]
async fn check_for_updates(app: tauri::AppHandle) -> Result<String, String>
```

#### Update Installation Command
```rust
#[tauri::command]
async fn install_update(app: tauri::AppHandle) -> Result<(), String>
```

### 3. React UI Component (`app/components/desktop-updater.tsx`)

The React component provides:

#### Features
- **Desktop Detection**: Only renders in Tauri desktop environment
- **Automatic Notifications**: Shows update notification when available
- **Manual Check**: Button to manually check for updates
- **Installation Flow**: User-friendly update installation with progress
- **Error Handling**: Displays errors if update check/install fails

#### UI States
1. **Hidden**: When running in web browser (not desktop)
2. **Update Available**: Floating notification with install/dismiss options
3. **Manual Check**: Button in settings to check for updates
4. **Installing**: Shows progress during update installation

### 4. Integration Points

#### Layout Integration (`app/layout.tsx`)
```tsx
import { DesktopUpdater } from "./components/desktop-updater"

// In body:
<DesktopUpdater />
```

#### Settings Page Integration (`app/settings/page.tsx`)
```tsx
<Card title="Desktop Updates" description="Check for and install desktop app updates.">
  <DesktopUpdater />
</Card>
```

## Signing Keys

### Key Generation

Signing keys were generated using:
```bash
pnpm tauri signer generate -w src-tauri/updater-key.txt --ci
```

### Key Files

- **Private Key**: `apps/desktop/src-tauri/updater-key.txt` (⚠️ NEVER commit!)
- **Public Key**: `apps/desktop/src-tauri/updater-key.txt.pub` (embedded in app)

### Security

The private key is:
- Added to `.gitignore` to prevent accidental commits
- Required for signing update packages in GitHub Actions
- Must be stored securely (password manager, vault)

## GitHub Actions Integration

### Required Secrets

Add these secrets to your GitHub repository:

1. **TAURI_SIGNING_PRIVATE_KEY**
   - Value: Contents of `updater-key.txt` file
   - Used to sign update packages during release builds

2. **TAURI_SIGNING_PRIVATE_KEY_PASSWORD** (Optional)
   - Value: Password for the private key (if regenerated with password)
   - Leave empty if no password was set

### Workflow Configuration

The GitHub Actions workflow automatically:
1. Signs update packages with the private key
2. Generates `latest.json` manifest
3. Uploads signed packages to GitHub Releases
4. Makes updates available to desktop app users

## Update Flow

### 1. User Experience

1. **App Startup**: Automatic check for updates in background
2. **Update Available**: Notification appears with version info
3. **User Action**: Click "Install Update" or "Later"
4. **Installation**: Update downloads and installs automatically
5. **Restart**: App restarts with new version

### 2. Manual Check

Users can manually check for updates:
1. Open Settings page
2. Navigate to "Desktop Updates" section
3. Click "Check for Updates" button
4. Follow installation prompts if update available

### 3. Security Verification

Every update is verified:
1. App downloads update package from GitHub
2. Verifies signature using embedded public key
3. Only installs if signature is valid
4. Rejects tampered or unsigned updates

## Testing

### Local Testing

1. **Build Desktop App**:
   ```bash
   cd apps/desktop
   pnpm tauri build
   ```

2. **Test Update Check**:
   - Run the built app
   - Check console for update check messages
   - Open Settings → Desktop Updates
   - Click "Check for Updates"

### Production Testing

1. **Create Test Release**:
   ```bash
   git tag v0.2.4-test
   git push origin v0.2.4-test
   ```

2. **Verify Workflow**:
   - Check GitHub Actions for successful build
   - Verify release assets include signed packages
   - Download and install test release

3. **Test Update Flow**:
   - Install older version
   - Create newer version release
   - Verify app detects and installs update

## Troubleshooting

### Update Check Fails

**Symptom**: "Failed to check for updates" error

**Solutions**:
1. Verify internet connection
2. Check GitHub Releases endpoint is accessible
3. Ensure `latest.json` exists in release assets
4. Review console logs for detailed error

### Signature Verification Fails

**Symptom**: Update downloads but won't install

**Solutions**:
1. Verify public key in `tauri.conf.json` matches private key
2. Ensure update was signed with correct private key
3. Check GitHub Actions logs for signing errors
4. Regenerate keys if compromised

### Update Not Detected

**Symptom**: App doesn't detect available updates

**Solutions**:
1. Verify version number in `tauri.conf.json` is lower than release
2. Check `latest.json` format is correct
3. Ensure endpoint URL is correct
4. Review network requests in developer tools

## Maintenance

### Key Rotation

If keys need to be rotated:

1. **Generate New Keys**:
   ```bash
   pnpm tauri signer generate -w src-tauri/updater-key-new.txt -p "StrongPassword"
   ```

2. **Update Configuration**:
   - Replace public key in `tauri.conf.json`
   - Update `TAURI_SIGNING_PRIVATE_KEY` secret in GitHub

3. **Release Transition Version**:
   - Build and release one version with old key
   - All subsequent releases use new key

4. **Secure Old Keys**:
   - Archive old private key securely
   - Document rotation date and reason

### Version Management

Follow semantic versioning:
- **Major**: Breaking changes (v2.0.0)
- **Minor**: New features (v1.1.0)
- **Patch**: Bug fixes (v1.0.1)

Update version in:
- `apps/desktop/src-tauri/tauri.conf.json`
- `apps/desktop/package.json`
- Git tag for release

## Documentation References

- **Tauri Updater**: https://tauri.app/v2/guides/distribution/updater/
- **Code Signing**: See `CODE_SIGNING.md`
- **GitHub Secrets**: See `GITHUB_SECRETS.md`
- **Build Process**: See `README.md`

## Support

For issues with the auto-updater:
1. Check this documentation
2. Review Tauri updater documentation
3. Check GitHub Actions logs
4. Open an issue in the repository
