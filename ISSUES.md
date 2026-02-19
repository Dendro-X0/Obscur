# Known Issues & Bug Reports - v0.7.6-alpha

The following critical issues have been reported by users and require immediate investigation and resolution.

## 1. Contact Stability & Data Loss (Critical)
- **Instability after restart:** Normal interaction ceases after the app is restarted following an initial invite acceptance.
- **One-way visibility:** User B (recipient) cannot find User A (sender) in their contact list after a restart.
- **Message delivery failure:** User B sometimes cannot receive messages from User A.
- **Contact deletion bug:** Getting "User B removed" when clicking their profile from User A's list (persisting issue despite recent fixes).
- **Conclusion:** The current contact handshake and persistence mechanism is fragile and fails to support long-term interaction.

## 2. Authentication & Session Management
- **Key entry fatigue:** Users are forced to re-enter their full key (nsec/npub) after every restart.
- **Key failures:** Entering the key sometimes fails, forcing a full data/account reset.
- **Feature Request:** Implement a **PIN/Password unlock** feature.
  - Allow users to set a local password/PIN encryption for their keys.
  - Use this password to unlock the session on app restart instead of pasting keys.

## 3. UI Freezing & Responsiveness
- **Scroll lock:** UI freezes prevent scrolling on Contacts and Settings pages (bottom elements become inaccessible).
- **Interaction blocking:** General UI freezes make the app unresponsive.

## 4. Settings & State Persistence
- **Settings lost on reload:** Language and other user preferences reset to default after reloading the app.
- **Instability on second load:** Reloading the app causes server disconnections and further UI scrolling issues.
