# GitHub Secrets Configuration for Code Signing

This document provides step-by-step instructions for configuring GitHub repository secrets required for code signing the Obscur desktop application.

## Overview

The build workflow supports **conditional signing**:
- ✅ **If secrets are configured**: Builds will be signed and notarized
- ⚠️ **If secrets are missing**: Builds will be unsigned (development/testing only)

This allows development builds to proceed without certificates while ensuring production releases are properly signed.

## Required Secrets

### Windows Code Signing

#### TAURI_SIGNING_WINDOWS_CERTIFICATE_THUMBPRINT
- **Required for**: Windows code signing
- **Description**: SHA-1 thumbprint of your Windows code signing certificate
- **Format**: 40-character hexadecimal string (no spaces)
- **Example**: `A1B2C3D4E5F6789012345678901234567890ABCD`

**How to obtain**:
```powershell
# After installing your certificate, run:
Get-ChildItem -Path Cert:\CurrentUser\My | Where-Object {$_.Subject -like "*Obscur*"} | Select-Object Thumbprint

# Or for all certificates:
Get-ChildItem -Path Cert:\CurrentUser\My | Format-List Subject, Thumbprint
```

#### WINDOWS_CERTIFICATE (Optional)
- **Required for**: Installing certificate in GitHub Actions runner
- **Description**: Base64-encoded PFX certificate file
- **Format**: Base64 string

**How to generate**:
```powershell
# Windows PowerShell
$bytes = [System.IO.File]::ReadAllBytes("path\to\certificate.pfx")
$base64 = [System.Convert]::ToBase64String($bytes)
$base64 | Set-Clipboard
# Now paste from clipboard into GitHub secret
```

#### WINDOWS_CERTIFICATE_PASSWORD (Optional)
- **Required for**: Decrypting the PFX certificate
- **Description**: Password for the PFX certificate file
- **Format**: Plain text password

### macOS Code Signing and Notarization

#### APPLE_SIGNING_IDENTITY
- **Required for**: macOS code signing
- **Description**: Full Developer ID Application identity string
- **Format**: `Developer ID Application: Company Name (TEAM_ID)`
- **Example**: `Developer ID Application: Obscur Inc (ABC1234567)`

**How to obtain**:
```bash
# List all signing identities
security find-identity -v -p codesigning

# Look for "Developer ID Application" entry
```

#### APPLE_TEAM_ID
- **Required for**: macOS notarization
- **Description**: 10-character Apple Developer Team ID
- **Format**: Alphanumeric string (10 characters)
- **Example**: `ABC1234567`

**How to obtain**:
1. Visit https://developer.apple.com/account
2. Sign in with your Apple ID
3. Find "Team ID" in the membership details section

#### APPLE_ID
- **Required for**: macOS notarization
- **Description**: Apple ID email address
- **Format**: Email address
- **Example**: `developer@obscur.app`

**Note**: This is your Apple Developer account email.

#### APPLE_PASSWORD
- **Required for**: macOS notarization
- **Description**: App-specific password (NOT your Apple ID password)
- **Format**: Generated password string
- **Example**: `abcd-efgh-ijkl-mnop`

**How to generate**:
1. Visit https://appleid.apple.com/account/manage
2. Sign in with your Apple ID
3. Navigate to "Security" section
4. Click "Generate Password" under "App-Specific Passwords"
5. Enter a label (e.g., "Obscur GitHub Actions")
6. Copy the generated password

**⚠️ Important**: 
- Never use your actual Apple ID password
- App-specific passwords are required for 2FA-enabled accounts
- Store the password securely - you cannot view it again

#### APPLE_CERTIFICATE (Optional)
- **Required for**: Installing certificate in GitHub Actions runner
- **Description**: Base64-encoded P12 certificate file
- **Format**: Base64 string

**How to generate**:
```bash
# macOS/Linux
base64 -i certificate.p12 | pbcopy  # macOS (copies to clipboard)
base64 -i certificate.p12           # Linux (prints to terminal)
```

#### APPLE_CERTIFICATE_PASSWORD (Optional)
- **Required for**: Decrypting the P12 certificate
- **Description**: Password for the P12 certificate file
- **Format**: Plain text password

## Adding Secrets to GitHub

### Step-by-Step Instructions

1. **Navigate to Repository Settings**
   - Go to your GitHub repository
   - Click "Settings" tab
   - Click "Secrets and variables" → "Actions" in the left sidebar

2. **Add New Secret**
   - Click "New repository secret" button
   - Enter the secret name (exactly as shown above)
   - Paste the secret value
   - Click "Add secret"

3. **Repeat for All Secrets**
   - Add each required secret following the same process
   - Verify secret names match exactly (case-sensitive)

### Secret Priority

**Minimum for Signed Builds**:
- Windows: `TAURI_SIGNING_WINDOWS_CERTIFICATE_THUMBPRINT`
- macOS: `APPLE_SIGNING_IDENTITY`, `APPLE_TEAM_ID`, `APPLE_ID`, `APPLE_PASSWORD`

**Optional (for certificate installation)**:
- `WINDOWS_CERTIFICATE` + `WINDOWS_CERTIFICATE_PASSWORD`
- `APPLE_CERTIFICATE` + `APPLE_CERTIFICATE_PASSWORD`

## Verification

### Test Signing Configuration

1. **Create a Test Tag**:
   ```bash
   git tag v0.1.0-test
   git push origin v0.1.0-test
   ```

2. **Monitor Workflow**:
   - Go to "Actions" tab in GitHub
   - Watch the "Tauri Desktop Build & Release" workflow
   - Check for signing-related errors

3. **Check Build Logs**:
   - Expand "Build desktop app with release" step
   - Look for signing messages:
     - Windows: "Signing with certificate thumbprint..."
     - macOS: "Signing with identity..." and "Notarizing..."

4. **Verify Release Assets**:
   - Go to "Releases" in GitHub
   - Check the release notes for signing status
   - Download and verify signatures locally

### Verify Windows Signature

```powershell
# Download the .msi or .exe file, then:
Get-AuthenticodeSignature "path\to\Obscur.msi"

# Expected output:
# Status: Valid
# SignerCertificate: CN=Your Company Name
# TimeStamperCertificate: CN=Sectigo
```

### Verify macOS Signature

```bash
# Download the .dmg file, mount it, then:
codesign -dv --verbose=4 "/Volumes/Obscur/Obscur.app"

# Check notarization:
spctl -a -vv "/Volumes/Obscur/Obscur.app"

# Expected output:
# accepted
# source=Notarized Developer ID
```

## Troubleshooting

### Common Issues

#### "Secret not found" Error
**Symptom**: Workflow fails with "secret not found" or similar error

**Solutions**:
1. Verify secret name matches exactly (case-sensitive)
2. Check that secret is added to the correct repository
3. Ensure you have admin access to the repository

#### Windows Signing Fails
**Symptom**: "Certificate not found" or "Invalid thumbprint"

**Solutions**:
1. Verify thumbprint is correct (40 hex characters, no spaces)
2. If using `WINDOWS_CERTIFICATE`, ensure password is correct
3. Check certificate is not expired
4. Verify certificate is a code signing certificate

#### macOS Signing Fails
**Symptom**: "No identity found" or "Signing failed"

**Solutions**:
1. Verify `APPLE_SIGNING_IDENTITY` format is correct
2. Check that certificate is installed (if using `APPLE_CERTIFICATE`)
3. Ensure certificate is not expired
4. Verify Team ID matches the certificate

#### macOS Notarization Fails
**Symptom**: "Notarization failed" or "Invalid credentials"

**Solutions**:
1. Verify `APPLE_ID` is correct
2. Ensure `APPLE_PASSWORD` is an app-specific password (not Apple ID password)
3. Check that 2FA is enabled on Apple ID
4. Verify `APPLE_TEAM_ID` matches your developer account
5. Wait a few minutes and retry (Apple servers can be slow)

#### Unsigned Builds When Secrets Are Set
**Symptom**: Builds complete but are unsigned despite secrets being configured

**Solutions**:
1. Check workflow logs for signing errors
2. Verify all required secrets are set (not just some)
3. Ensure secret values don't have extra whitespace
4. Try regenerating secrets (especially app-specific password)

## Security Best Practices

### Secret Management

1. **Rotate Secrets Regularly**
   - Update app-specific passwords annually
   - Rotate certificates before expiration
   - Update secrets immediately if compromised

2. **Limit Access**
   - Only repository admins should access secrets
   - Use GitHub environment protection rules for production
   - Enable audit logging for secret access

3. **Use Environment Protection**
   ```yaml
   # In workflow file, add environment protection:
   jobs:
     build:
       environment: production  # Requires manual approval
   ```

4. **Monitor Usage**
   - Review workflow logs regularly
   - Check for unauthorized builds
   - Monitor certificate usage through CA portal

### Certificate Security

1. **Never Commit Certificates**
   - Add to `.gitignore`: `*.pfx`, `*.p12`, `*.cer`
   - Never store in repository, even temporarily
   - Use secret management only

2. **Secure Local Storage**
   - Store certificates in secure location
   - Use strong passwords (16+ characters)
   - Enable disk encryption

3. **Backup Certificates**
   - Keep secure backups of certificates
   - Store in password manager or secure vault
   - Document recovery procedures

## Fallback Strategy

### Development Builds (No Secrets)

When secrets are not configured, the workflow will:
1. Build unsigned installers
2. Add warning to release notes
3. Complete successfully without signing

**Use cases**:
- Development testing
- Internal builds
- Pre-release testing
- Fork repositories

### Production Builds (With Secrets)

When secrets are configured, the workflow will:
1. Sign Windows executables with Authenticode
2. Sign and notarize macOS applications
3. Add confirmation to release notes
4. Provide fully signed installers

**Use cases**:
- Public releases
- Production deployments
- Official distributions

## Migration Guide

### From Unsigned to Signed Builds

1. **Obtain Certificates**
   - Purchase Windows code signing certificate
   - Enroll in Apple Developer Program
   - Wait for certificate approval

2. **Configure Secrets**
   - Add all required secrets to GitHub
   - Verify secret values are correct
   - Test with a development tag

3. **Create Signed Release**
   - Create a new version tag
   - Monitor workflow execution
   - Verify signatures on downloaded installers

4. **Update Documentation**
   - Update README with signed build info
   - Inform users about signed releases
   - Update installation instructions

## Cost Considerations

### Certificate Costs
- **Windows Code Signing**: $200-600/year
- **Apple Developer Program**: $99/year
- **Total**: ~$300-700/year

### Free Alternatives (Development Only)
- Self-signed certificates (Windows)
- Ad-hoc signing (macOS)
- Unsigned builds (all platforms)

**⚠️ Warning**: Free alternatives will trigger security warnings for users.

## Support

### Getting Help

1. **Check Documentation**
   - Review this guide
   - Check `CODE_SIGNING.md` for certificate details
   - Read Tauri documentation

2. **Review Workflow Logs**
   - Check GitHub Actions logs
   - Look for specific error messages
   - Search for similar issues

3. **Contact Support**
   - Certificate Authority support (for certificate issues)
   - Apple Developer support (for notarization issues)
   - GitHub support (for Actions issues)

4. **Community Resources**
   - Tauri Discord: https://discord.gg/tauri
   - GitHub Discussions
   - Stack Overflow

## Quick Reference

### Minimum Required Secrets

**For Windows Signing**:
```
TAURI_SIGNING_WINDOWS_CERTIFICATE_THUMBPRINT
```

**For macOS Signing + Notarization**:
```
APPLE_SIGNING_IDENTITY
APPLE_TEAM_ID
APPLE_ID
APPLE_PASSWORD
```

### Optional Secrets

**For Certificate Installation**:
```
WINDOWS_CERTIFICATE
WINDOWS_CERTIFICATE_PASSWORD
APPLE_CERTIFICATE
APPLE_CERTIFICATE_PASSWORD
```

**For Tauri Auto-Updater**:
```
TAURI_SIGNING_PRIVATE_KEY
TAURI_SIGNING_PRIVATE_KEY_PASSWORD (optional)
```

### Tauri Auto-Updater Signing

The Tauri updater requires separate signing keys to verify update packages. These are different from code signing certificates.

#### TAURI_SIGNING_PRIVATE_KEY
- **Required for**: Signing update packages
- **Description**: Contents of the updater private key file
- **Format**: Multi-line text (entire file contents)
- **Location**: `apps/desktop/src-tauri/updater-key.txt`

**How to add**:
1. Open `apps/desktop/src-tauri/updater-key.txt` in a text editor
2. Copy the entire contents (including the header comment)
3. Paste into GitHub secret value
4. Click "Add secret"

**⚠️ Critical**: 
- Never commit this file to version control (already in `.gitignore`)
- If you lose this key, you cannot sign updates
- Users won't be able to verify updates without the matching public key

#### TAURI_SIGNING_PRIVATE_KEY_PASSWORD (Optional)
- **Required for**: Decrypting password-protected private keys
- **Description**: Password for the updater private key
- **Format**: Plain text password

**Note**: The current key was generated without a password. Only add this secret if you regenerate the key with a password.

**How to regenerate with password**:
```bash
cd apps/desktop
pnpm tauri signer generate -w src-tauri/updater-key.txt -p "YourStrongPassword"
```

#### Public Key Configuration

The public key is already configured in `tauri.conf.json`:
```json
{
  "plugins": {
    "updater": {
      "pubkey": "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDA2MUFCOTdBNTkxOTI4RTcKUldUbktCbFplcmthQmprMHRXbHVqNVZ6eDE4aVBYLzJ4SjVlai9MS2ZCRkl4ek9QM1orNnNuZjcK"
    }
  }
}
```

This public key is embedded in the app and used to verify update signatures.

### Verification Commands

**Windows**:
```powershell
Get-AuthenticodeSignature "Obscur.msi"
```

**macOS**:
```bash
codesign -dv --verbose=4 "Obscur.app"
spctl -a -vv "Obscur.app"
```

## Next Steps

1. ✅ Review this documentation
2. ✅ Obtain necessary certificates
3. ✅ Configure GitHub secrets
4. ✅ Test with development tag
5. ✅ Create signed production release
6. ✅ Verify signatures on all platforms
7. ✅ Update user documentation

## Questions?

For questions about GitHub secrets configuration:
1. Review troubleshooting section above
2. Check workflow logs for specific errors
3. Consult `CODE_SIGNING.md` for certificate details
4. Open an issue in the repository
