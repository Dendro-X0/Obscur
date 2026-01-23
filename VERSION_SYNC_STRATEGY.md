# Version Synchronization Strategy

## Current Situation
- **Desktop App (v0.2.4)**: ✅ Up to date with latest UI ("Obscur" branding)
- **Vercel PWA**: ❌ Outdated (still showing "Nostr Messenger")
- **Decision**: Focus on desktop app, fix PWA sync later

## Root Cause Analysis

### Why is Vercel Outdated?

Let me investigate the possible causes:

1. **Build Configuration Issue**
   - Vercel might be building from wrong directory
   - Or using wrong build command

2. **Caching Issue**
   - Vercel's CDN might be serving old cached files
   - Service worker might be caching old version

3. **Branch Mismatch**
   - Vercel might be deploying from a different branch
   - Or an old commit

4. **Environment Variables**
   - Missing or incorrect env vars
   - Pointing to old configuration

## Action Plan for v0.2.5

### Phase 1: Desktop App Focus (This Week)
**Priority**: Improve core functionality before worrying about PWA sync

#### 1. UX Improvements
- [ ] Add username system (NIP-05)
- [ ] Implement simple invite codes
- [ ] Improve onboarding flow
- [ ] Better contact management
- [ ] In-app help/tooltips

#### 2. Bug Fixes
- [ ] Fix any relay connection issues
- [ ] Improve error messages
- [ ] Add loading states
- [ ] Handle edge cases

#### 3. Documentation
- [ ] Add user guide
- [ ] Create video tutorials
- [ ] Document common issues
- [ ] Add FAQ

### Phase 2: PWA Sync Investigation (Next Week)
**Goal**: Understand why Vercel is out of sync

#### Investigation Steps
1. Check Vercel dashboard settings
2. Review build logs
3. Compare build outputs
4. Test locally vs production
5. Identify the exact issue

#### Potential Fixes
- Update Vercel build configuration
- Clear all caches
- Redeploy from scratch
- Update deployment settings
- Fix service worker caching

### Phase 3: Unified Build Process (Future)
**Goal**: Ensure desktop and web always stay in sync

#### Strategy
1. **Single Source of Truth**
   - Both desktop and web use same codebase (already true)
   - Same version number in both
   - Same build process

2. **Automated Version Bumping**
   - Script to update version in both places
   - Prevent manual version mismatches

3. **Pre-deployment Checks**
   - Verify both builds before release
   - Automated testing
   - Visual regression testing

4. **Deployment Pipeline**
   ```
   Tag created (v0.x.x)
     ↓
   Build Desktop (GitHub Actions) ✓
     ↓
   Build PWA (Vercel) ✓
     ↓
   Run E2E Tests ✓
     ↓
   Create GitHub Release ✓
     ↓
   Deploy PWA to Vercel ✓
   ```

## Immediate Focus: Desktop App v0.2.5

### Feature Priorities

#### High Priority (Must Have)
1. **Username System**
   - Let users set @username
   - Search by username
   - Display username in UI
   - Store in Nostr profile (NIP-05)

2. **Invite Codes**
   - Generate short codes (OBSCUR-ABC123)
   - Share via text/email
   - Redeem code to add contact
   - Store mapping in relay

3. **Simplified Onboarding**
   - Welcome screen
   - Auto-create identity
   - Set username
   - Skip complex settings
   - "Add first contact" prompt

#### Medium Priority (Should Have)
1. **Better Contact Management**
   - Dedicated contacts page
   - Search/filter
   - Contact cards with avatars
   - Last seen status
   - Quick actions

2. **Improved Error Handling**
   - Clear error messages
   - Retry mechanisms
   - Offline indicators
   - Connection status

3. **In-App Help**
   - Tooltips
   - Help icons
   - FAQ section
   - Tutorial videos

#### Low Priority (Nice to Have)
1. **Contact Groups**
   - Organize contacts
   - Favorites
   - Categories

2. **Advanced Settings**
   - Relay management
   - Privacy settings
   - Data export

3. **Themes**
   - Custom colors
   - Light/dark mode toggle
   - Accent colors

## Version Numbering Strategy

### Current: v0.2.4
- Desktop: ✅ v0.2.4
- PWA: ❌ Unknown (old version)

### Next: v0.2.5 (Desktop Only)
- Focus: UX improvements
- Timeline: This week
- PWA: Skip for now

### Future: v0.3.0 (Desktop + PWA Sync)
- Focus: Feature parity
- Timeline: 2-3 weeks
- Ensure both versions match

## Testing Strategy

### Desktop App Testing
1. **Manual Testing**
   - Test all features
   - Try edge cases
   - Test on Windows, macOS, Linux

2. **User Testing**
   - Get feedback from real users
   - Identify pain points
   - Iterate based on feedback

3. **Automated Testing**
   - Unit tests for core logic
   - Integration tests for relay communication
   - E2E tests for critical flows

### PWA Testing (When We Fix It)
1. **Cross-Browser Testing**
   - Chrome, Firefox, Safari, Edge
   - Mobile browsers

2. **PWA Features**
   - Install prompt
   - Offline mode
   - Service worker
   - Push notifications

3. **Performance**
   - Load time
   - Bundle size
   - Lighthouse score

## Success Metrics

### v0.2.5 Goals
- [ ] Time to first message: < 2 minutes (currently ~5-10 min)
- [ ] User can add contact in < 30 seconds
- [ ] Zero confusion during onboarding
- [ ] 90%+ of users successfully send first message

### v0.3.0 Goals
- [ ] Desktop and PWA versions match
- [ ] Both deploy automatically
- [ ] No manual intervention needed
- [ ] Version numbers always in sync

## Next Steps

### Today
1. Review ROADMAP_v0.2.5.md
2. Prioritize features for v0.2.5
3. Start implementing username system

### This Week
1. Implement username search
2. Add invite code generation
3. Improve onboarding flow
4. Test with real users

### Next Week
1. Investigate Vercel PWA issue
2. Fix deployment pipeline
3. Ensure version sync for v0.3.0

---

**Decision**: Focus on desktop app quality over PWA sync for now. We'll fix the sync issue properly in v0.3.0 rather than rushing a fix that might not work.
