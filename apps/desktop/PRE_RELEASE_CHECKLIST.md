# Pre-Release Checklist

## Overview

This checklist ensures all features work correctly before releasing a new version of Obscur Desktop. Follow these steps before creating a release tag.

## Phase 1: Pre-Build Validation (5-10 minutes)

### 1.1 Configuration Check
```bash
cd apps/desktop
node validate-build-config.js
```

**Expected Result:** All checks should pass
- ✅ Tauri config loaded
- ✅ All icons present
- ✅ Bundle configuration valid
- ✅ Platform-specific config present

**If Failed:** Fix configuration issues before proceeding

### 1.2 Run All Test Suites
```bash
# From workspace root
pnpm test

# Desktop-specific tests
cd apps/desktop
node test-dev-build.js
node test-performance.js
node test-security.js
```

**Expected Result:** All tests pass with no critical errors

### 1.3 Update Version Number
```bash
# Update version in these files:
# 1. apps/desktop/src-tauri/tauri.conf.json
# 2. apps/desktop/package.json
# 3. apps/desktop/src-tauri/Cargo.toml

# Example: Update to v0.3.0
```

**Version Format:** Use semantic versioning (MAJOR.MINOR.PATCH)
- MAJOR: Breaking changes
- MINOR: New features (backward compatible)
- PATCH: Bug fixes

## Phase 2: Local Build Test (15-30 minutes)

### 2.1 Clean Build
```bash
cd apps/desktop

# Clean previous builds
rm -rf src-tauri/target/release/bundle

# Run production build
pnpm build
```

**Expected Result:** Build completes without errors

**Watch For:**
- ⚠️ Compilation warnings (review but may be acceptable)
- ❌ Build errors (must fix)
- ⚠️ Large bundle sizes (>150MB may be slow to download)

### 2.2 Verify Build Artifacts
```bash
# Check what was built
node test-e2e-pipeline.js
# When prompted, choose 'n' to skip the build (already done)
```

**Expected Artifacts:**
- **Windows:** `.msi` and/or `.exe` files
- **macOS:** `.dmg` file
- **Linux:** `.AppImage` and/or `.deb` files

**Check:**
- ✅ Files exist in `src-tauri/target/release/bundle/`
- ✅ File sizes are reasonable
- ✅ No corrupted files (size > 0)

## Phase 3: Manual Testing (30-60 minutes)

### 3.1 Installation Test

**On Your Platform:**
1. Locate the installer in `src-tauri/target/release/bundle/`
2. Install the application
3. Verify installation completes without errors
4. Check desktop shortcut was created
5. Launch the application

**Expected Result:**
- ✅ Installation completes smoothly
- ✅ App launches without errors
- ✅ No security warnings (or expected warnings for unsigned builds)

### 3.2 Core Functionality Test

**Test Checklist:**

#### Identity & Setup
- [ ] Create new identity works
- [ ] Identity is persisted after restart
- [ ] Can view public key
- [ ] Can export/backup identity

#### Messaging
- [ ] Can send direct messages
- [ ] Can receive direct messages
- [ ] Messages persist after restart
- [ ] Message timestamps are correct
- [ ] Can send messages while offline (queued)
- [ ] Queued messages send when back online

#### Invites & Contacts
- [ ] Can create invite links
- [ ] Can generate QR codes
- [ ] Can accept invite links
- [ ] Can view contact list
- [ ] Can manage contact requests
- [ ] Can block/unblock contacts

#### Relay Connectivity
- [ ] Connects to default relays
- [ ] Can add custom relays
- [ ] Shows connection status
- [ ] Reconnects after network interruption
- [ ] Handles relay failures gracefully

#### Desktop-Specific Features
- [ ] Window controls work (minimize, maximize, close)
- [ ] Window size/position persists
- [ ] Desktop notifications work
- [ ] System theme detection works
- [ ] Keyboard shortcuts work
- [ ] Deep links work (obscur:// URLs)

#### UI/UX
- [ ] All pages load correctly
- [ ] Navigation works smoothly
- [ ] Theme toggle works
- [ ] Responsive to window resizing
- [ ] No visual glitches
- [ ] Loading states display correctly

### 3.3 Performance Test

**Measure:**
- **Startup Time:** Should be < 5 seconds
- **Memory Usage:** Check Task Manager/Activity Monitor
  - Initial: Should be < 200MB
  - After 10 minutes: Should be < 300MB
- **CPU Usage:** Should be low when idle (< 5%)

**Test:**
```bash
# Monitor performance
node test-performance.js
```

### 3.4 Offline/Online Test

**Test Scenario:**
1. Start app with internet connection
2. Send a message (should work)
3. Disconnect internet
4. Try to send a message (should queue)
5. Reconnect internet
6. Verify queued message sends
7. Verify can receive new messages

**Expected Result:**
- ✅ App works offline
- ✅ Messages queue properly
- ✅ Sync works when reconnected

### 3.5 Multi-Device Test (If Possible)

**Test Scenario:**
1. Install on two devices
2. Create identity on Device A
3. Create identity on Device B
4. Exchange invite links
5. Send messages both ways
6. Verify messages appear on both devices

## Phase 4: Testing with a Friend (1-2 hours)

### 4.1 Prepare Test Build

**Option A: Share Local Build**
```bash
# Locate installer
cd apps/desktop/src-tauri/target/release/bundle

# Share the appropriate installer:
# - Windows: Share the .msi or .exe file
# - macOS: Share the .dmg file
# - Linux: Share the .AppImage or .deb file
```

**Option B: Create GitHub Release (Recommended)**
```bash
# 1. Commit all changes
git add .
git commit -m "Release v0.3.0"

# 2. Create and push tag
git tag v0.3.0
git push origin v0.3.0

# 3. GitHub Actions will build and create release
# 4. Share the release URL with your friend
```

### 4.2 Friend Installation Guide

**Send to Your Friend:**

```
Hi! I'd like you to test the new Obscur Desktop app. Here's how:

1. Download the installer:
   - Windows: Download the .msi file
   - macOS: Download the .dmg file
   - Linux: Download the .AppImage file

2. Install the app:
   - Windows: Double-click the .msi file
   - macOS: Open the .dmg and drag to Applications
   - Linux: Make the .AppImage executable and run it

3. You may see a security warning (app is not signed yet):
   - Windows: Click "More info" → "Run anyway"
   - macOS: Right-click → Open → Confirm
   - Linux: Should work without warnings

4. Launch the app and create your identity

5. Share your invite link with me so we can connect!
```

### 4.3 Joint Testing Scenarios

**Test Together:**

#### Scenario 1: Basic Messaging
1. Exchange invite links
2. Accept each other's invites
3. Send messages back and forth
4. Verify messages appear correctly
5. Test with different message lengths
6. Test with special characters/emojis

#### Scenario 2: Offline Resilience
1. One person goes offline
2. Other person sends messages
3. Offline person comes back online
4. Verify messages sync correctly

#### Scenario 3: Multi-Session
1. Both restart apps
2. Verify messages persist
3. Verify contacts persist
4. Send new messages
5. Verify everything still works

#### Scenario 4: Relay Switching
1. Add a custom relay
2. Verify messages still work
3. Remove default relay
4. Verify messages still work

### 4.4 Collect Feedback

**Ask Your Friend:**
- Was installation easy?
- Did anything confuse you?
- Were there any errors or crashes?
- How was the performance?
- What features would you like to see?
- Any bugs or issues?

**Document Issues:**
Create a file `TESTING_FEEDBACK.md` with:
- What worked well
- What didn't work
- Bugs found
- Feature requests
- Performance observations

## Phase 5: Post-Testing Actions

### 5.1 Fix Critical Issues

**If Critical Bugs Found:**
1. Document the bug
2. Fix the issue
3. Restart from Phase 2 (rebuild and retest)
4. Don't release until critical bugs are fixed

**Critical Bugs:**
- App crashes
- Can't send/receive messages
- Data loss
- Security vulnerabilities

**Non-Critical Bugs:**
- UI glitches
- Minor performance issues
- Feature requests
- Can be fixed in next release

### 5.2 Update Documentation

**Before Release:**
- [ ] Update CHANGELOG.md with new features
- [ ] Update README.md if needed
- [ ] Update version numbers everywhere
- [ ] Document known issues
- [ ] Update installation instructions

### 5.3 Create Release Notes

**Template:**
```markdown
# Obscur Desktop v0.3.0

## What's New
- Feature 1: Description
- Feature 2: Description
- Improvement: Description

## Bug Fixes
- Fixed: Issue description
- Fixed: Issue description

## Known Issues
- Issue 1: Description and workaround
- Issue 2: Description and workaround

## Installation
[Link to installation guide]

## Upgrade Notes
- Any special instructions for upgrading

## Testing
This release has been tested on:
- Windows 10/11
- macOS 12+
- Ubuntu 22.04

## Feedback
Please report issues at: [GitHub Issues URL]
```

## Phase 6: Release (5-10 minutes)

### 6.1 Create GitHub Release

**If Using GitHub Actions:**
```bash
# Tag triggers automatic build and release
git tag v0.3.0
git push origin v0.3.0

# Wait for GitHub Actions to complete (15-30 minutes)
# Check: https://github.com/your-repo/actions
```

**Manual Release:**
1. Go to GitHub → Releases → New Release
2. Choose tag: v0.3.0
3. Add release title: "Obscur Desktop v0.3.0"
4. Paste release notes
5. Upload build artifacts
6. Mark as pre-release if not stable
7. Publish release

### 6.2 Announce Release

**Share With:**
- Your friend (direct message)
- Project contributors
- Community (if applicable)

**Include:**
- Release notes
- Download links
- Installation instructions
- How to report issues

## Quick Reference: Common Issues

### Issue: Build Fails
**Solution:**
```bash
# Clean and rebuild
rm -rf src-tauri/target
pnpm install
pnpm build
```

### Issue: App Won't Launch
**Check:**
- Antivirus blocking the app
- Missing system dependencies
- Corrupted download
- Insufficient permissions

### Issue: Messages Not Sending
**Check:**
- Internet connection
- Relay connectivity (check status in app)
- Firewall blocking WebSocket connections
- Relay server status

### Issue: High Memory Usage
**Check:**
- How many messages in history
- How many relays connected
- Browser DevTools for memory leaks
- Close and restart app

### Issue: Security Warnings
**Expected:** Unsigned builds will show warnings
**Solution:** 
- For testing: Click through warnings
- For production: Set up code signing (see CODE_SIGNING.md)

## Testing Checklist Summary

**Before Release:**
- [ ] All tests pass
- [ ] Version numbers updated
- [ ] Local build successful
- [ ] Manual testing complete
- [ ] Tested with friend
- [ ] Critical bugs fixed
- [ ] Documentation updated
- [ ] Release notes written

**After Release:**
- [ ] GitHub release created
- [ ] Installers available
- [ ] Release announced
- [ ] Monitoring for issues

## Estimated Time

- **Quick Test:** 1 hour (Phases 1-2)
- **Thorough Test:** 2-3 hours (Phases 1-3)
- **Full Test with Friend:** 3-4 hours (All phases)

## Tips for Success

1. **Test on Clean System:** If possible, test on a fresh VM or clean install
2. **Document Everything:** Keep notes of what you test and results
3. **Don't Rush:** Better to find bugs before release than after
4. **Get Feedback:** Your friend's perspective is valuable
5. **Iterate:** It's okay to do multiple test releases before going public
6. **Monitor:** Watch for issues after release and be ready to patch

## Next Steps

After successful testing and release:
1. Monitor for user-reported issues
2. Plan next version features
3. Continue improving based on feedback
4. Consider setting up crash reporting
5. Build a community of testers

---

**Remember:** It's better to delay a release and fix issues than to release with known critical bugs. Your users will appreciate a stable, working app!
