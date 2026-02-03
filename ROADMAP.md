# Roadmap

## 🚀 Upcoming Release: v0.4.0 (Community & Polish)

The next major release focuses on expanding social features and refining the mobile experience to ensure Obscur feels like a mature, native-quality application.

### 👥 Group Chat V1
- **Objective**: Deliver a robust group chat experience comparable to Signal/Telegram groups.
- [x] **Creation Flow**: Enhanced UI for creating groups with avatars and descriptions.
- [ ] **Member Management**: Add/Remove members, role assignments (Admin/Member).
- [x] **Metadata Propagation**: Ensure group updates (name changes, avatar updates) sync correctly to all members.

### 👤 Profile & Settings Overhaul
- **Objective**: Give users full control over their identity and application preferences.
- [x] **Avatar Upload**: Native upload support for profile pictures (currently text-only).
- [x] **NIP-05 Management**: Built-in verification flow for NIP-05 identifiers.
- [x] **Privacy Controls**: Granular settings for who can DM you (Everyone / Contacts Only / No One).

### 📱 Mobile Experience
- **Objective**: Reach parity with the desktop experience and squash mobile-specific bugs.
- [ ] **Gestures**: Swipe-to-reply and long-press menus for messages.
- [ ] **Touch Targets**: Audit and increase hit areas for buttons in the Composer and headers.
- [ ] **Virtual Keyboard**: ensure the view resizes correctly when the keyboard opens/closes (avoiding occlusion).

### ⚡ Performance
- **Objective**: Maintain 60fps scrolling even with complex message types.
- [ ] **Virtualization**: Verify and tune `@tanstack/react-virtual` settings for lists with varying item heights (images + text).
- [ ] **Image Optimization**: Implement better lazy loading and blurred placeholders for heavy media.

## 🔮 Future Horizons (v0.5.0+)

- **Voice/Video Calls**: leveraging WebRTC for P2P calling.
- **Desktop notifications**: Native OS notification integration.
- **Nostr Wallet Connect**: Tipping and lightning integration.
