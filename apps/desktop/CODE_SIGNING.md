# Code Signing Guide for Obscur Desktop

This document provides instructions for setting up code signing for the Obscur desktop application across all platforms.

## Overview

Code signing is essential for:
- **Windows**: Preventing SmartScreen warnings and establishing trust
- **macOS**: Passing Gatekeeper and enabling app distribution
- **Security**: Verifying app authenticity and preventing tampering

## Windows Code Signing

### Certificate Acquisition

#### Option 1: Purchase from Certificate Authority (Recommended for Production)

1. **Choose a Certificate Authority**
   - Sectigo (formerly Comodo) - https://sectigo.com/ssl-certificates-tls/code-signing
   - DigiCert - https://www.digicert.com/signing/code-signing-certificates
   - GlobalSign - https://www.globalsign.com/en/code-signing-certificate
   
2. **Certificate Types**
   - **Standard Code Signing Certificate**: $200-400/year
     - Requires business validation
     - Suitable for most applications
   - **EV Code Signing Certificate**: $400-600/year
     - Extended validation with hardware token
     - Immediate SmartScreen reputation
     - Recommended for production releases

3. **Validation Process**
   - Provide business documentation (articles of incorporation, business license)
   - Verify domain ownership
   - Complete identity verification (may require notarization for EV)
   - Processing time: 1-7 business days

4. **Certificate Delivery**
   - Standard: PFX/P12 file with password
   - EV: USB hardware token (FIPS 140-2 compliant)

#### Option 2: Self-Signed Certificate (Development/Testing Only)

**⚠️ Warning**: Self-signed certificates will trigger security warnings. Use only for internal testing.

```powershell
# Create a self-signed certificate (Windows PowerShell as Administrator)
$cert = New-SelfSignedCertificate `
    -Type CodeSigningCert `
    -Subject "CN=Obscur Development, O=Obscur, C=US" `
    -KeyAlgorithm RSA `
    -KeyLength 2048 `
    -Provider "Microsoft Enhanced RSA and AES Cryptographic Provider" `
    -CertStoreLocation "Cert:\CurrentUser\My" `
    -NotAfter (Get-Date).AddYears(2)

# Export the certificate
$password = ConvertTo-SecureString -String "YourPassword123" -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath "obscur-dev-cert.pfx" -Password $password

# Get the thumbprint
$cert.Thumbprint
```

### Configuration

#### 1. Configure tauri.conf.json

The Windows signing configuration is already set up in `apps/desktop/src-tauri/tauri.conf.json`:

```json
{
  "bundle": {
    "windows": {
      "certificateThumbprint": null,
      "digestAlgorithm": "sha256",
      "timestampUrl": "http://timestamp.sectigo.com"
    }
  }
}
```

**Configuration Options**:
- `certificateThumbprint`: Set via environment variable `TAURI_SIGNING_WINDOWS_CERTIFICATE_THUMBPRINT`
- `digestAlgorithm`: SHA-256 (recommended) or SHA-1 (legacy)
- `timestampUrl`: Timestamp server to prove signing time
  - Sectigo: `http://timestamp.sectigo.com`
  - DigiCert: `http://timestamp.digicert.com`
  - GlobalSign: `http://timestamp.globalsign.com`

#### 2. Install Certificate on Build Machine

**For Local Development**:
```powershell
# Import PFX certificate to Windows Certificate Store
Import-PfxCertificate -FilePath "path\to\certificate.pfx" `
    -CertStoreLocation Cert:\CurrentUser\My `
    -Password (ConvertTo-SecureString -String "YourPassword" -AsPlainText -Force)

# Get the thumbprint
Get-ChildItem -Path Cert:\CurrentUser\My | Where-Object {$_.Subject -like "*Obscur*"}
```

**For GitHub Actions**: See "GitHub Actions Configuration" section below.

#### 3. Set Environment Variables

**Local Build**:
```powershell
# Windows PowerShell
$env:TAURI_SIGNING_WINDOWS_CERTIFICATE_THUMBPRINT = "YOUR_CERTIFICATE_THUMBPRINT"

# Build the app
pnpm tauri build
```

**Command Prompt**:
```cmd
set TAURI_SIGNING_WINDOWS_CERTIFICATE_THUMBPRINT=YOUR_CERTIFICATE_THUMBPRINT
pnpm tauri build
```

### Verification

After building, verify the signature:

```powershell
# Check signature on the built executable
Get-AuthenticodeSignature "apps\desktop\src-tauri\target\release\Obscur.exe"

# Should show:
# Status: Valid
# SignerCertificate: CN=Your Company Name
```

### Troubleshooting

**Issue**: "Certificate not found"
- **Solution**: Ensure certificate is installed in `Cert:\CurrentUser\My` or `Cert:\LocalMachine\My`
- Verify thumbprint matches exactly (no spaces)

**Issue**: "Timestamp server unavailable"
- **Solution**: Try alternative timestamp servers:
  - `http://timestamp.digicert.com`
  - `http://timestamp.globalsign.com`
  - `http://timestamp.comodoca.com`

**Issue**: SmartScreen warnings persist
- **Solution**: 
  - Use EV certificate for immediate reputation
  - Build reputation over time with standard certificate
  - Submit app to Microsoft for SmartScreen review

## macOS Code Signing

### Certificate Acquisition

#### Requirements

1. **Apple Developer Account**
   - Individual: $99/year
   - Organization: $99/year
   - Sign up at: https://developer.apple.com/programs/

2. **Developer ID Application Certificate**
   - Used for apps distributed outside the Mac App Store
   - Automatically created when you join the Developer Program

#### Setup Process

1. **Join Apple Developer Program**
   - Visit https://developer.apple.com/programs/enroll/
   - Complete enrollment (requires Apple ID and payment)
   - Wait for approval (usually 24-48 hours)

2. **Create Certificates**
   - Open Xcode or visit https://developer.apple.com/account/resources/certificates
   - Create "Developer ID Application" certificate
   - Download and install in Keychain Access

3. **Get Team ID**
   - Visit https://developer.apple.com/account
   - Note your Team ID (10-character alphanumeric)

### Configuration

#### 1. Configure tauri.conf.json

The macOS signing configuration is already set up:

```json
{
  "bundle": {
    "macOS": {
      "frameworks": [],
      "minimumSystemVersion": "10.13",
      "signingIdentity": null,
      "providerShortName": null,
      "entitlements": null
    }
  }
}
```

**Configuration Options**:
- `signingIdentity`: Set via `APPLE_SIGNING_IDENTITY` environment variable
- `providerShortName`: Your Apple Team ID (set via `APPLE_TEAM_ID`)
- `entitlements`: Optional plist file for additional permissions

#### 2. Find Your Signing Identity

```bash
# List available signing identities
security find-identity -v -p codesigning

# Look for "Developer ID Application: Your Name (TEAM_ID)"
# Example: Developer ID Application: Obscur Inc (ABC1234567)
```

#### 3. Set Environment Variables

**Local Build**:
```bash
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAM_ID)"
export APPLE_TEAM_ID="ABC1234567"
export APPLE_ID="your-apple-id@example.com"
export APPLE_PASSWORD="app-specific-password"

pnpm tauri build
```

**App-Specific Password**:
1. Visit https://appleid.apple.com/account/manage
2. Sign in with your Apple ID
3. Generate an app-specific password under "Security"
4. Use this password (not your Apple ID password)

### Notarization

Notarization is required for macOS 10.15+ (Catalina and later):

```bash
# Tauri automatically notarizes when these are set:
export APPLE_ID="your-apple-id@example.com"
export APPLE_PASSWORD="app-specific-password"
export APPLE_TEAM_ID="ABC1234567"

# Build with notarization
pnpm tauri build
```

### Verification

```bash
# Check code signature
codesign -dv --verbose=4 "apps/desktop/src-tauri/target/release/bundle/macos/Obscur.app"

# Check notarization
spctl -a -vv "apps/desktop/src-tauri/target/release/bundle/macos/Obscur.app"

# Should show: "accepted" and "source=Notarized Developer ID"
```

### Troubleshooting

**Issue**: "No signing identity found"
- **Solution**: Install Xcode Command Line Tools: `xcode-select --install`
- Ensure certificate is in Keychain Access

**Issue**: "Notarization failed"
- **Solution**: 
  - Verify Apple ID and app-specific password
  - Check that app is properly signed first
  - Review notarization logs: `xcrun notarytool log <submission-id>`

**Issue**: "Gatekeeper blocks app"
- **Solution**: App must be notarized for macOS 10.15+
- Users can bypass: System Preferences → Security & Privacy → "Open Anyway"

## GitHub Actions Configuration

### Required Secrets

Add these secrets to your GitHub repository (Settings → Secrets and variables → Actions):

#### Windows Secrets

1. **TAURI_SIGNING_WINDOWS_CERTIFICATE_THUMBPRINT**
   - Value: Your certificate thumbprint (40-character hex string)
   - Example: `A1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q7R8S9T0`

2. **WINDOWS_CERTIFICATE** (Optional - for PFX-based signing)
   - Value: Base64-encoded PFX file
   - Generate: `[Convert]::ToBase64String([IO.File]::ReadAllBytes("cert.pfx"))`

3. **WINDOWS_CERTIFICATE_PASSWORD** (Optional)
   - Value: PFX file password

#### macOS Secrets

1. **APPLE_SIGNING_IDENTITY**
   - Value: Full signing identity string
   - Example: `Developer ID Application: Obscur Inc (ABC1234567)`

2. **APPLE_TEAM_ID**
   - Value: 10-character Team ID
   - Example: `ABC1234567`

3. **APPLE_ID**
   - Value: Your Apple ID email
   - Example: `developer@obscur.app`

4. **APPLE_PASSWORD**
   - Value: App-specific password (not your Apple ID password)
   - Generate at: https://appleid.apple.com/account/manage

5. **APPLE_CERTIFICATE** (Optional - for certificate installation)
   - Value: Base64-encoded P12 certificate
   - Generate: `base64 -i certificate.p12 | pbcopy`

6. **APPLE_CERTIFICATE_PASSWORD** (Optional)
   - Value: P12 certificate password

### Workflow Configuration

The GitHub Actions workflow (`.github/workflows/tauri-build.yml`) is already configured to use these secrets. The signing will be applied automatically when the secrets are available.

**Conditional Signing**: The workflow includes fallback logic:
- If signing secrets are present → Signs the app
- If signing secrets are missing → Builds unsigned (for development/testing)

### Testing Signing in CI

1. **Add Secrets**: Configure all required secrets in GitHub repository settings

2. **Create Test Tag**: 
   ```bash
   git tag v0.1.0-test
   git push origin v0.1.0-test
   ```

3. **Monitor Workflow**: Check Actions tab for build progress

4. **Verify Signatures**: Download artifacts and verify signatures locally

## Security Best Practices

### Certificate Storage

1. **Never commit certificates to version control**
   - Add `*.pfx`, `*.p12`, `*.cer` to `.gitignore`
   - Use environment variables or secret management

2. **Use strong passwords**
   - Minimum 16 characters
   - Mix of uppercase, lowercase, numbers, symbols
   - Store in password manager

3. **Rotate certificates before expiration**
   - Set calendar reminders 30 days before expiration
   - Test new certificates in development first

### Access Control

1. **Limit certificate access**
   - Only authorized team members
   - Use GitHub environment protection rules
   - Enable 2FA on all accounts

2. **Audit certificate usage**
   - Monitor signing activity
   - Review GitHub Actions logs
   - Track certificate installations

### Incident Response

If a certificate is compromised:

1. **Immediately revoke the certificate**
   - Contact Certificate Authority
   - Revoke through CA portal

2. **Notify users**
   - Publish security advisory
   - Recommend updating to new signed version

3. **Obtain new certificate**
   - Use different key pair
   - Update all build systems

## Cost Summary

### Windows
- **Standard Certificate**: $200-400/year
- **EV Certificate**: $400-600/year (recommended)

### macOS
- **Apple Developer Program**: $99/year (required)

### Total Annual Cost
- **Minimum**: $299/year (Standard Windows + Apple)
- **Recommended**: $499/year (EV Windows + Apple)

## Next Steps

1. **Immediate** (Development):
   - Use self-signed certificates for local testing
   - Configure unsigned builds in CI/CD

2. **Before Public Release**:
   - Purchase production certificates
   - Configure signing secrets in GitHub
   - Test signed builds on clean systems

3. **Ongoing**:
   - Monitor certificate expiration dates
   - Maintain SmartScreen reputation
   - Keep documentation updated

## Support Resources

- **Tauri Code Signing Docs**: https://tauri.app/v1/guides/distribution/sign-windows
- **Windows Authenticode**: https://docs.microsoft.com/en-us/windows-hardware/drivers/install/authenticode
- **Apple Notarization**: https://developer.apple.com/documentation/security/notarizing_macos_software_before_distribution
- **Sectigo Support**: https://sectigo.com/support
- **DigiCert Support**: https://www.digicert.com/support

## Updater Signing Keys

The Tauri updater uses separate signing keys to verify update packages. These keys are different from code signing certificates.

### Key Generation

Updater signing keys have been generated and stored in:
- **Private Key**: `apps/desktop/src-tauri/updater-key.txt` (⚠️ NEVER commit this!)
- **Public Key**: `apps/desktop/src-tauri/updater-key.txt.pub` (safe to commit)

The public key is already configured in `tauri.conf.json`.

### GitHub Actions Configuration

Add these secrets to your GitHub repository for automatic update signing:

1. **TAURI_SIGNING_PRIVATE_KEY**
   - Value: Contents of `updater-key.txt` file
   - Used to sign update packages during release builds

2. **TAURI_SIGNING_PRIVATE_KEY_PASSWORD** (Optional)
   - Value: Password for the private key (if you regenerate with a password)
   - Leave empty if no password was set

### Regenerating Keys

If you need to regenerate the updater signing keys:

```bash
# Generate new keys with password (recommended for production)
pnpm tauri signer generate -w src-tauri/updater-key.txt -p "YourStrongPassword"

# Or without password (development only)
pnpm tauri signer generate -w src-tauri/updater-key.txt --ci
```

**⚠️ Important**: 
- If you lose the private key, you cannot sign updates
- Users with the old public key won't be able to verify new updates
- Keep backups of the private key in secure storage (password manager, vault)

### Key Security

1. **Private Key Protection**:
   - Never commit to version control (already in `.gitignore`)
   - Store securely in password manager
   - Limit access to release managers only

2. **GitHub Secrets**:
   - Add private key content to `TAURI_SIGNING_PRIVATE_KEY` secret
   - Enable environment protection rules for production
   - Rotate keys if compromised

3. **Public Key Distribution**:
   - Public key is embedded in the app binary
   - Safe to commit and distribute
   - Used by app to verify update signatures

## Questions?

For questions about code signing setup, please:
1. Check the troubleshooting sections above
2. Review Tauri documentation
3. Open an issue in the repository
4. Contact the development team
