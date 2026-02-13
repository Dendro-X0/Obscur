# Roadmap

## 🚀 Current Release: v0.7.6-alpha (Invite System & Stability)

This release focuses on streamlining the user connection flow and hardening the messaging core against network instability.

### 👥 Group Chat V1
- **Objective**: Deliver a robust group chat experience comparable to Signal/Telegram groups.
- [x] **Creation Flow**: Enhanced UI for creating groups with avatars and descriptions.
- [x] **Member Management**: Add/Remove members, role assignments (Admin/Member).
- [x] **Metadata Propagation**: Ensure group updates (name changes, avatar updates) sync correctly to all members.

### 👤 Profile & Settings Overhaul
- **Objective**: Give users full control over their identity and application preferences.
- [x] **Avatar Upload**: Native upload support for profile pictures (currently text-only).
- [x] **NIP-05 Management**: Built-in verification flow for NIP-05 identifiers.
- [x] **Privacy Controls**: Granular settings for who can DM you (Everyone / Contacts Only / No One).

### 📱 Mobile Experience (v0.4.0)
- **Objective**: Reach parity with the desktop experience and squash mobile-specific bugs.
- [x] **Gestures**: Swipe-to-reply and long-press menus for messages.
- [x] **Touch Targets**: Audit and increase hit areas for buttons in the Composer and headers.
- [x] **Virtual Keyboard**: ensure the view resizes correctly when the keyboard opens/closes (avoiding occlusion).

### ⚡ Performance
- **Objective**: Maintain 60fps scrolling even with complex message types.
- [x] **Virtualization**: Verify and tune `@tanstack/react-virtual` settings for lists with varying item heights (images + text).
- [x] **Image Optimization**: Implement better lazy loading and blurred placeholders for heavy media.

## 📱 Native Mobile App (v0.5.0)
- **Objective**: Deploy "Obscur" as a native iOS and Android application using the existing codebase.
- **Strategy**: Leverage Tauri v2 Mobile to wrap the PWA with native capabilities.
- [x] **Infrastructure**: Initialize Android/iOS projects within `apps/desktop/src-tauri`.
- [x] **UI Adaptation**: Handle mobile safe areas (notches/home indicators) and native status bar styling.
- [ ] **Push Notifications**: Implement local background polling or UnifiedPush for notifications.
- [ ] **Deep Linking**: Support `nostr:` links opening directly in the app.

## 🔮 Future Horizons (v0.5.0+)

- **Voice/Video Calls**: leveraging WebRTC for P2P calling.
- **Desktop notifications**: Native OS notification integration.
- **Nostr Wallet Connect**: Tipping and lightning integration.
