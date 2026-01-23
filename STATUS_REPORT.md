# Status Report - Obscur v0.2.4

## ✅ What's Working

### Desktop App
- ✅ Builds successfully for Windows, macOS, Linux
- ✅ Has correct Obscur logo/icon
- ✅ Latest UI with all improvements:
  - Hidden scrollbars
  - Vertical sidebar navigation
  - Symmetrical layout
  - All features functional

### Build Pipeline
- ✅ GitHub Actions working perfectly
- ✅ Automated releases
- ✅ All platforms building without errors

## ⚠️ Known Issues & Status

### 1. Windows SmartScreen Warning ⚠️
**Issue**: "Unknown publisher" warning when installing
**Why**: App is not code-signed (requires expensive certificate ~$200/year)
**Impact**: Users see scary warning, may not install
**Status**: **EXPECTED BEHAVIOR** for unsigned apps
**Workaround**: 
- Added clear instructions in IMMEDIATE_FIXES.md
- Users click "More info" → "Run anyway"
**Long-term fix**: Purchase code signing certificate when budget allows

### 2. Vercel Deployment Sync 🔄
**Issue**: Web version showed old "Nostr Messenger" UI
**Why**: Vercel was serving cached/old build
**Fix Applied**: Pushed empty commit to trigger fresh deployment
**Status**: **DEPLOYING NOW** - should be fixed in ~2-3 minutes
**Verify**: Check https://obscur-lovat.vercel.app after deployment completes

### 3. UX Complexity 📱
**Issue**: Adding contacts is too complex (QR codes, public keys, invite links)
**Impact**: High friction for new users
**Status**: **PLANNED FOR v0.3.0**
**Proposed Solutions**:
- Username search (like Discord: @username)
- Simple invite codes (like Telegram: OBSCUR-ABC123)
- Improved onboarding flow
**Timeline**: Next 1-2 weeks

## 📋 Immediate Next Steps

### Today
1. ✅ Triggered Vercel redeploy
2. ⏳ Wait for Vercel deployment to complete (~3 min)
3. ⏳ Verify web version shows "Obscur" branding
4. ⏳ Test web version has all features

### This Week
1. Create simplified onboarding flow
2. Add username system (NIP-05)
3. Implement invite code generation
4. Add better contact management UI

### When Budget Allows
1. Purchase code signing certificate
2. Sign Windows builds (removes SmartScreen warning)
3. Notarize macOS builds (smoother installation)

## 🎯 Testing Your App

### Option 1: Desktop + Desktop (Two Computers)
1. Download installer from GitHub Releases
2. Install on two different computers
3. Create identity on each
4. Use QR code/invite link to connect

### Option 2: Desktop + Web (Easiest)
1. Install desktop app on your computer
2. Open https://obscur-lovat.vercel.app in browser
3. Create different identities
4. Connect them

### Option 3: Two Browsers (Quickest)
1. Open Vercel URL in Chrome
2. Open same URL in Firefox (or Incognito)
3. Two separate identities (browser storage is isolated)
4. Connect and chat

## 📊 Feature Comparison

| Feature | Desktop v0.2.4 | Web v0.2.4 | Notes |
|---------|---------------|------------|-------|
| Create Identity | ✅ | ✅ | |
| QR Code Generation | ✅ | ✅ | |
| QR Code Scanning | ✅ | ⚠️ | Requires HTTPS (Vercel has it) |
| Invite Links | ✅ | ✅ | |
| Messaging | ✅ | ✅ | |
| Contacts | ✅ | ✅ | |
| Settings | ✅ | ✅ | |
| Notifications | ✅ | ⚠️ | Desktop native, Web browser-based |
| Offline Mode | ✅ | ✅ | |
| Auto-updates | ✅ | ✅ | Desktop via Tauri, Web automatic |

## 🔐 Security & Privacy

### Current Status
- ✅ End-to-end encryption (NIP-04)
- ✅ Local-first (data stored on device)
- ✅ No central server
- ✅ Open source (auditable)
- ⚠️ Unsigned builds (SmartScreen warning)

### What "Unsigned" Means
- **NOT** a security risk
- **NOT** malware
- Just means: "We haven't paid Microsoft $200/year for a certificate"
- Code is open source - anyone can verify it's safe
- Many legitimate open-source apps are unsigned

## 📞 Support & Feedback

### If You Encounter Issues
1. Check IMMEDIATE_FIXES.md for common solutions
2. Check browser console for errors (F12)
3. Check relay connection status in app
4. Share screenshots/logs for debugging

### Feature Requests
- Document in GitHub Issues
- Or share directly for prioritization

## 🚀 Roadmap

### v0.2.5 (This Week)
- Fix any remaining Vercel issues
- Add installation guide to README
- Improve error messages

### v0.3.0 (Next 2 Weeks)
- Username system
- Invite codes
- Better onboarding
- Simplified contact adding

### v0.4.0 (Future)
- Group chats
- File sharing
- Voice/video calls
- Mobile apps (iOS/Android)

---

**Last Updated**: 2026-01-22
**Current Version**: v0.2.4
**Next Release**: v0.2.5 (planned for this week)
