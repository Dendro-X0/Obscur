# Obscur Mobile Release Guide

This guide documents the procedures for building, signing, and distributing Obscur for iOS and Android using Tauri V2 and GitHub Actions.

## 1. Android Release Process

### Generating a Release Keystore
If you don't have a release keystore yet, generate one using `keytool`:

```bash
keytool -genkey -v -keystore release.jks -alias obscur -keyalg RSA -keysize 2048 -validity 10000
```

### GitHub Secrets for Android
Store the following secrets in your GitHub repository settings:

| Secret Name | Description |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | The `release.jks` file encoded in base64 (`base64 -w 0 release.jks`) |
| `ANDROID_KEYSTORE_PASSWORD` | The password for the keystore |
| `ANDROID_KEYALIAS` | The alias used when generating the key (e.g., `obscur`) |
| `ANDROID_KEY_PASSWORD` | The password for the specific key alias |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` | The JSON key from your Google Play Service Account (for automated uploads) |

### Play Store Distribution
The CI pipeline is configured to upload the `.aab` (Android App Bundle) to the **Internal Testing** track on Google Play Console.

## 2. iOS Release Process

### Provisioning & Certificates
1. Create a **Distribution Certificate** in the Apple Developer Portal.
2. Create an **App ID** (e.g., `app.obscur.desktop`).
3. Create a **Provisioning Profile** (App Store) for that App ID.

### GitHub Secrets for iOS
Store the following secrets in your GitHub repository settings:

| Secret Name | Description |
|---|---|
| `APPLE_CERTIFICATE_BASE64` | Your `.p12` certificate file encoded in base64 |
| `APPLE_CERTIFICATE_PASSWORD` | The password for the `.p12` certificate |
| `APPLE_DEVELOPMENT_TEAM` | Your 10-character Apple Team ID |
| `APP_STORE_CONNECT_API_KEY_ISSUER_ID` | Issuer ID from App Store Connect API Keys |
| `APP_STORE_CONNECT_API_KEY_ID` | Key ID from App Store Connect API Keys |
| `APP_STORE_CONNECT_API_KEY_BASE64` | The `.p8` API Key file content encoded in base64 |

### TestFlight Distribution
The CI pipeline uses `apple-actions/upload-testflight-build` to upload the signed `.ipa` to **TestFlight** automatically upon a version tag push.

## 3. Versioning Strategy

Obscur uses a unified versioning strategy across the workspace.

### Bumping Versions
To bump the version across the entire project (root `package.json`, `apps/pwa`, `apps/desktop`, `tauri.conf.json`, etc.), use the provided script:

```bash
# Bumps patch version and syncs across workspace
pnpm run version:bump patch

# Or for minor/major
pnpm run version:bump minor
```

### Triggering a Release
A release build is triggered by pushing a git tag starting with `v`:

```bash
git tag v0.7.8-alpha
git push origin v0.7.8-alpha
```

This will trigger both `build-android.yml` and `build-ios.yml` workflows.
