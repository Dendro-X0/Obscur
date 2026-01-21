# Desktop PWA Integration

This document describes the desktop-specific optimizations and integrations implemented for the Obscur desktop app.

## Overview

The desktop app now includes comprehensive PWA integration with desktop-specific UI adaptations, offline functionality, and deep link handling.

## Features Implemented

### 1. Desktop-Specific UI Adaptations

#### Keyboard Shortcuts
- **Navigation shortcuts**: Ctrl+1-4 for quick navigation between main sections
- **Search focus**: Ctrl+K to focus search input
- **New message**: Ctrl+N to focus message input
- **Help**: Shift+? to show keyboard shortcuts help

**Files:**
- `apps/pwa/app/lib/desktop/keyboard-shortcuts.ts` - Keyboard shortcut manager
- `apps/pwa/app/lib/desktop/use-keyboard-shortcuts.ts` - React hook for shortcuts
- `apps/pwa/app/components/desktop/keyboard-shortcuts-help.tsx` - Help modal

#### Layout Adaptations
- Desktop mode detection and styling
- Window size-aware layouts (compact/wide modes)
- PWA-specific UI elements hidden in desktop mode
- Desktop-optimized navigation patterns

**Files:**
- `apps/pwa/app/lib/desktop/use-desktop-layout.ts` - Layout adaptation hook
- `apps/pwa/app/components/desktop/desktop-mode-provider.tsx` - Desktop mode provider
- `apps/pwa/app/components/app-shell.tsx` - Updated with desktop adaptations

### 2. Offline Functionality

#### Enhanced Service Worker
- Network-first strategy for API calls
- Cache-first strategy for static assets
- Runtime caching for dynamic content
- Offline fallback support
- Cache management commands

**Files:**
- `apps/pwa/app/sw.js/route.ts` - Enhanced service worker

#### Offline State Management
- Online/offline detection
- Pending action queue
- Last online timestamp tracking
- State persistence across restarts

**Files:**
- `apps/pwa/app/lib/desktop/offline-manager.ts` - Offline state manager
- `apps/pwa/app/lib/desktop/use-offline-state.ts` - React hook for offline state
- `apps/pwa/app/components/desktop/offline-indicator.tsx` - Visual offline indicator

#### Relay Connection Persistence
- Relay state persistence across app restarts
- Last connected timestamp tracking
- Priority-based relay sorting
- Connection state management

**Files:**
- `apps/pwa/app/lib/desktop/relay-persistence.ts` - Relay persistence utilities

### 3. Deep Link Handling

#### Protocol Registration
- Custom `obscur://` URL protocol
- System-level protocol registration
- Deep link event handling in Rust

**Configuration:**
- `apps/desktop/src-tauri/tauri.conf.json` - Added `deepLinkProtocols: ["obscur"]`
- `apps/desktop/src-tauri/Cargo.toml` - Added `tauri-plugin-deep-link` dependency

#### Deep Link Types
- **Invite links**: `obscur://invite?code=...`
- **Direct message links**: `obscur://dm?pubkey=...`
- **Group links**: `obscur://group?id=...`

**Files:**
- `apps/desktop/src-tauri/src/main.rs` - Rust deep link handler
- `apps/pwa/app/lib/desktop/use-deep-link.ts` - React hook for deep links
- `apps/pwa/app/lib/desktop/deep-link-generator.ts` - Deep link generation utilities
- `apps/pwa/app/components/desktop/deep-link-handler.tsx` - Deep link handler component

## Usage

### Keyboard Shortcuts

Users can press `Shift+?` to view all available keyboard shortcuts. The shortcuts are automatically registered when running in desktop mode.

### Offline Functionality

The app automatically detects online/offline status and shows an indicator when offline or when there are pending actions. The service worker caches assets for offline use.

### Deep Links

To create a deep link:

```typescript
import { generateInviteDeepLink } from "@/app/lib/desktop/deep-link-generator";

const link = generateInviteDeepLink({ code: "abc123" });
// Returns: "obscur://invite?code=abc123"
```

To handle deep links, the `DeepLinkHandler` component is automatically mounted in the app layout.

## Testing

### Keyboard Shortcuts
1. Run the desktop app
2. Press `Shift+?` to open the shortcuts help
3. Try navigation shortcuts (Ctrl+1, Ctrl+2, etc.)

### Offline Functionality
1. Run the desktop app
2. Disconnect from the internet
3. Verify the offline indicator appears
4. Try navigating the app - cached pages should load
5. Reconnect - indicator should disappear

### Deep Links
1. Build the desktop app
2. Install it on your system
3. Open a terminal and run: `open obscur://invite?code=test` (macOS) or `start obscur://invite?code=test` (Windows)
4. The app should open and navigate to the invite page

## Architecture

### Desktop Detection

All desktop-specific features use the `useIsDesktop()` hook to detect if running in Tauri:

```typescript
import { useIsDesktop } from "@/app/lib/desktop/use-tauri";

function MyComponent() {
  const isDesktop = useIsDesktop();
  
  if (!isDesktop) return null;
  
  // Desktop-specific UI
  return <DesktopFeature />;
}
```

### Event Flow

1. **Keyboard Shortcuts**: Browser keydown events → KeyboardShortcutManager → Registered actions
2. **Offline State**: Browser online/offline events → OfflineManager → React state updates
3. **Deep Links**: OS protocol handler → Tauri → Rust handler → Frontend event → React router

## Future Enhancements

- [ ] Add more keyboard shortcuts (e.g., Ctrl+W to close window)
- [ ] Implement offline message queue with retry logic
- [ ] Add deep link preview before navigation
- [ ] Support for custom keyboard shortcut configuration
- [ ] Enhanced offline sync indicators
