# Roadmap for v0.2.5 - Critical Fixes & UX Improvements

## 🚨 Critical Issues (Must Fix)

### 1. Vercel Deployment Sync Issue
**Problem**: Web version is outdated, showing old "Nostr Messenger" branding
**Root Cause**: Vercel might be caching or deploying from wrong branch
**Solution**:
- [ ] Check Vercel build settings
- [ ] Ensure it's deploying from `main` branch
- [ ] Clear Vercel cache and force redeploy
- [ ] Verify build command: `pnpm build:pwa`
- [ ] Check if `next.config.ts` has correct output settings

### 2. Code Signing (Windows SmartScreen)
**Problem**: "Unknown publisher" warning scares users away
**Current**: Unsigned builds trigger Windows Defender SmartScreen
**Solutions** (in order of preference):

#### Option A: Get Code Signing Certificate (Recommended)
- **Cost**: ~$100-400/year
- **Providers**: 
  - DigiCert (most trusted, $474/year)
  - Sectigo (affordable, $179/year)
  - SSL.com ($199/year)
- **Process**:
  1. Purchase certificate
  2. Verify company/identity
  3. Add certificate to GitHub Secrets
  4. Update workflow to use certificate
- **Result**: No warnings, builds trust

#### Option B: Build Reputation (Free but slow)
- Keep distributing unsigned builds
- After ~100+ downloads, Windows SmartScreen learns it's safe
- Takes weeks/months
- **Not recommended** for new apps

#### Option C: Temporary Workaround
- Add clear instructions in README:
  ```
  Windows may show "Unknown publisher" warning.
  This is normal for new apps. Click "More info" → "Run anyway"
  ```
- Create video tutorial showing safe installation
- Build trust through other means (website, documentation)

**Recommendation**: Start with Option C, plan for Option A as app grows

### 3. Installer Icon
**Problem**: Using default Tauri icon
**Solution**:
- [ ] Create/export Obscur logo in required formats:
  - `icon.ico` (Windows, 256x256)
  - `icon.icns` (macOS, 512x512)
  - `icon.png` (Linux, multiple sizes)
- [ ] Place in `apps/desktop/src-tauri/icons/`
- [ ] Update `tauri.conf.json` icon paths
- [ ] Rebuild and test

---

## 🎨 UX Improvements

### 4. Simplified User Discovery
**Problem**: Current flow is too complex (QR codes, invite links, public keys)
**Goal**: Make it as easy as adding a friend on Discord/Telegram

#### Proposed Solutions:

**A. Username Search (Like Discord)**
- Allow users to set a unique username (e.g., @alice)
- Search by username instead of public key
- Backend: Use NIP-05 (Nostr username verification)
- UX: Simple search bar → find user → add

**B. Invite Codes (Like Telegram)**
- Generate short invite codes (e.g., `OBSCUR-ABC123`)
- Share via text/email
- Recipient enters code → instant connection
- Store mapping in relay or local database

**C. Contact Import**
- Import from phone contacts (mobile)
- Scan email/phone → check if they're on Obscur
- Send invite if not

**D. Nearby Discovery (Bluetooth/Local Network)**
- Find users on same WiFi
- Bluetooth handshake for in-person adds
- Privacy-focused (opt-in only)

**Recommended Approach**: Implement A + B
- Username search for finding known people
- Invite codes for quick sharing

### 5. Onboarding Flow
**Problem**: Users don't understand identity creation, passphrases, relays
**Solution**:
- [ ] Create step-by-step wizard:
  1. Welcome screen (explain what Obscur is)
  2. Create identity (auto-generate, explain later)
  3. Set username (simple, memorable)
  4. Optional: Set passphrase (explain it's for encryption)
  5. Done! Show "Add your first contact" screen
- [ ] Add tooltips and help text
- [ ] Create video tutorial

### 6. Better Contact Management
**Current**: Scattered across Invites page tabs
**Proposed**:
- [ ] Dedicated "Contacts" page
- [ ] Search/filter contacts
- [ ] Contact cards with:
  - Avatar
  - Username
  - Last seen
  - Quick actions (message, block, remove)
- [ ] Contact groups/categories

---

## 🛠️ Technical Debt

### 7. Feature Parity (Web vs Desktop)
**Problem**: Desktop has features web doesn't
**Solution**:
- [ ] Audit feature differences
- [ ] Prioritize critical features for web
- [ ] Create feature flag system
- [ ] Ensure both use same codebase (they should already)

### 8. Build & Deploy Pipeline
**Current Issues**:
- Vercel deploys old version
- Manual tag creation for releases
- No automated testing before release

**Improvements**:
- [ ] Add pre-deployment checks
- [ ] Automated version bumping
- [ ] Staging environment for testing
- [ ] Automated E2E tests

---

## 📅 Implementation Plan

### Phase 1: Critical Fixes (v0.2.5 - This Week)
1. Fix Vercel deployment
2. Add installer icon
3. Update README with installation instructions
4. Add "Unknown publisher" workaround guide

### Phase 2: UX Improvements (v0.3.0 - Next 2 Weeks)
1. Implement username system (NIP-05)
2. Add username search
3. Create invite code system
4. Improve onboarding flow

### Phase 3: Code Signing (v0.3.1 - When Budget Allows)
1. Purchase code signing certificate
2. Set up signing in CI/CD
3. Release signed builds

### Phase 4: Advanced Features (v0.4.0 - Future)
1. Contact import
2. Nearby discovery
3. Group chats
4. Voice/video calls

---

## 🎯 Success Metrics

- **Installation friction**: Reduce from 5 clicks to 2 clicks
- **Time to first message**: < 2 minutes (currently ~5-10 min)
- **User retention**: Track how many users return after first install
- **Contact addition**: Make it possible in < 30 seconds

---

## 📝 Notes

- Keep backward compatibility with existing identities
- Don't break existing invite links/QR codes
- Maintain privacy-first approach
- All features should work offline-first
