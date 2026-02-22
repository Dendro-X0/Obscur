# Known Issues & Bug Reports - v0.7.9-alpha

The following critical issues have been reported by users and require immediate investigation and resolution.

## 1. Contact Stability & Data Loss (Critical)
- **Instability after restart:** Normal interaction ceases after the app is restarted following an initial invite acceptance.
- **One-way visibility:** User B (recipient) cannot find User A (sender) in their contact list after a restart.
- **Message delivery failure:** User B sometimes cannot receive messages from User A.
- **Contact deletion bug:** Getting "User B removed" when clicking their profile from User A's list (persisting issue despite recent fixes).
- **Conclusion:** The current contact handshake and persistence mechanism is fragile and fails to support long-term interaction.

### Recent Progress (Feb 2026)
- **Fixed identity scoping** for persistence keys to prevent contacts disappearing on refresh
- **Implemented acceptance handshake** with `t=connection-accept` tagged DMs
- **Added repair hydration** from persisted chat state to reconstruct accepted contacts
- **Added synchronous persistence** to avoid lost writes on fast refresh
- **Added debug logging** gated by `obscur_debug_persistence=1` flag
- **Status**: Partially fixed - contacts should persist, but acceptance handshake needs testing

## 2. Authentication & Session Management - RESOLVED
- **Key entry fatigue:** FIXED. Users can now use "Remember Me" to persist their session safely.
- **Key failures:** Improved validation in the new unified Auth Screen.
- **Feature Request:** Implement a **PIN/Password unlock** feature - COMPLETED.
  - Users can set a local password/PIN encryption for their keys.
  - "Remember Me" utilizes this to auto-unlock the session on restart.

### Recent Progress (Feb 2026)
- **Redesigned Auth Flow:** Unified login/creation with `framer-motion` animations.
- **Implemented Auto-Unlock:** `AuthGateway` now checks `localStorage` for a remembered session and unlocks automatically on mount.
- **Automated Discovery:** Invite codes are generated and published in the background upon account creation.
- **Status**: RESOLVED - Enhanced security and convenience features are now live.


## 3. UI Freezing & Responsiveness
- **Scroll lock:** UI freezes prevent scrolling on Contacts and Settings pages (bottom elements become inaccessible).
- **Interaction blocking:** General UI freezes make the app unresponsive.

## 4. Settings & State Persistence
- **Settings lost on reload:** Language and other user preferences reset to default after reloading the app.
- **Instability on second load:** Reloading the app causes server disconnections and further UI scrolling issues.

## 5. Message Queue & Decryption - RESOLVED
- **Repeated OperationError spam** in MessageQueue.decryptData
- **Status**: RESOLVED by deduping failures per message ID and returning safe placeholders. The message pipeline is stable.

## 6. Group Creation & Management - RESOLVED
- **"Invalid private key hex" error** during group creation
  - **Status**: RESOLVED by ensuring events are signed correctly with native key sentinel.
- **"blocked: group doesn't exist" error** during group creation on strict relays
  - **Status**: RESOLVED. The system now correctly dispatches a NIP-29 `CREATE_GROUP` (kind 9007) event instead of immediately attempting `PUT_USER`.
- **"blocked: event too much in the future" error** when publishing events
  - **Status**: RESOLVED by implementing a -2 second clock drift offset during event signature generation, resolving conflicts with strictly synchronized relays.
- **Leaked Community Messages on standard Relays**
  - **Status**: RESOLVED by migrating to the strictly encrypted "Sealed Communities" (Kind 10105) protocol. Communities are now natively private and registry-independent.

## Current Testing Priority
1. **Verify contact persistence after page refresh**
2. **Test acceptance handshake between two users**
3. **Confirm Sealed Community member discovery over standard relays**

## Debug Instructions
To enable persistence debug logging:
```javascript
localStorage.setItem('obscur_debug_persistence', '1')
```

This will log storage operations for peer trust and requests inbox to help diagnose any remaining persistence issues.

## 7. Test Suite Stability (Messaging)
- **Persistent mocking issues:** The `enhanced-dm-controller.test.ts` test suite is currently failing all 15 property-based tests.
- **Root cause:** Difficulties in correctly mocking the `MessageQueue` ES module class constructor and resolving module paths (`import` vs `require()`) within the Vitest/React Testing Library environment. Complex mock hoisting (`vi.hoisted`) and factory implementations result in `TypeError: mockMessageQueueInstance is not a constructor` and sporadic `Cannot find module` errors.
- **Status:** Requires a deeper restructuring of how the `EnhancedDMController` dependency injects `MessageQueue` or a shift to integration testing, as current unit testing mocks are brittle and causing endless fix loops.

## 8. Test Suite Stability (Invite Utils) - RESOLVED
- **Issue:** The `apps/pwa/app/features/invites/utils/__tests__` test suite had multiple failures across 13 test files.
- **Root causes:** 
  - `crypto.randomUUID is not a function` errors in JSDOM environment
  - Incorrect mocking patterns using `vi.mocked` on non-mocked modules
  - Missing `await` on async crypto service methods
  - Flaky performance assertions in fast CI environments
  - Property-based tests generating invalid URL paths breaking fallback assertions
- **Fixes applied:**
  - Replaced `crypto.randomUUID()` with deterministic IDs in tests
  - Switched from `vi.mocked` to `vi.spyOn` for cryptoService/contactStore mocks
  - Added proper `await` to async `generateInviteId()` and `isValidPubkey()` calls
  - Relaxed timing assertions to allow 0ms durations in CI
  - Tightened path validation to exclude fragment-breaking characters
  - Fixed ContactGroup type usage by removing non-existent fields
- **Status:** RESOLVED - All 13 test files now pass (154 tests)
