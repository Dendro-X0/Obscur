# Desktop Integration Module

This module provides seamless integration between the Obscur PWA and Tauri desktop environment, with automatic fallbacks for web environments.

## Features

- **Environment Detection**: Automatically detect if running in desktop or web environment
- **Window Controls**: Native window minimize, maximize, close, and fullscreen controls
- **Desktop Notifications**: Native desktop notifications with fallback to web notifications
- **System Theme Integration**: Automatic system theme detection and synchronization
- **Window State Persistence**: Save and restore window size, position, and maximized state
- **Graceful Fallbacks**: All features work in web environment with appropriate fallbacks

## Usage

### Basic Environment Detection

```typescript
import { useIsDesktop } from "@/app/lib/desktop";

function MyComponent() {
  const isDesktop = useIsDesktop();

  return (
    <div>
      {isDesktop ? (
        <p>Running in desktop app</p>
      ) : (
        <p>Running in web browser</p>
      )}
    </div>
  );
}
```

### Window Controls

```typescript
import { useTauri } from "@/app/lib/desktop";

function WindowControlsExample() {
  const { isDesktop, api } = useTauri();

  const handleMinimize = async () => {
    await api.window.minimize();
  };

  const handleMaximize = async () => {
    const isMaximized = await api.window.isMaximized();
    if (isMaximized) {
      await api.window.unmaximize();
    } else {
      await api.window.maximize();
    }
  };

  const handleClose = async () => {
    await api.window.close();
  };

  if (!isDesktop) return null;

  return (
    <div>
      <button onClick={handleMinimize}>Minimize</button>
      <button onClick={handleMaximize}>Maximize</button>
      <button onClick={handleClose}>Close</button>
    </div>
  );
}
```

### Pre-built Window Controls Component

```typescript
import { WindowControls } from "@/app/components/desktop/window-controls";
import { TitleBar } from "@/app/components/desktop/title-bar";

function AppHeader() {
  return (
    <div>
      {/* Simple window controls */}
      <WindowControls />

      {/* Or use the full title bar with drag region */}
      <TitleBar title="Obscur" showControls={true} />
    </div>
  );
}
```

### Desktop Notifications

```typescript
import { useDesktopNotifications } from "@/app/lib/desktop";

function NotificationExample() {
  const { showNotification, enabled, setEnabled } = useDesktopNotifications();

  const handleSendNotification = async () => {
    await showNotification("New Message", "You have a new message from Alice");
  };

  return (
    <div>
      <label>
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled({ enabled: e.target.checked })}
        />
        Enable notifications
      </label>
      <button onClick={handleSendNotification}>Send Test Notification</button>
    </div>
  );
}
```

### System Theme Integration

```typescript
import { useDesktopTheme } from "@/app/lib/desktop";

function ThemeExample() {
  const { preference, setPreference, systemTheme, effectiveTheme, isDesktop } = useDesktopTheme();

  return (
    <div>
      <p>Current preference: {preference}</p>
      {isDesktop && <p>System theme: {systemTheme}</p>}
      <p>Effective theme: {effectiveTheme}</p>

      <button onClick={() => setPreference("light")}>Light</button>
      <button onClick={() => setPreference("dark")}>Dark</button>
      <button onClick={() => setPreference("system")}>System</button>
    </div>
  );
}
```

### Direct API Access

```typescript
import { getTauriAPI, isDesktopEnvironment } from "@/app/lib/desktop";

// Check environment
if (isDesktopEnvironment()) {
  console.log("Running in desktop app");
}

// Get API instance
const api = getTauriAPI();

// Use API methods
await api.window.setTitle("My Custom Title");
await api.notification.show({ title: "Hello", body: "World" });
const theme = await api.theme.getTheme();
```

## API Reference

### `useTauri()`

Returns an object with:
- `isDesktop: boolean` - Whether running in desktop environment
- `api: TauriAPI` - The Tauri API instance

### `useIsDesktop()`

Returns `boolean` - Whether running in desktop environment

### `useDesktopNotifications()`

Returns an object with:
- `showNotification(title: string, body: string): Promise<void>` - Show a notification
- `enabled: boolean` - Whether notifications are enabled
- `setEnabled(params: { enabled: boolean }): void` - Enable/disable notifications
- `permission: NotificationPermission | "unsupported"` - Current permission state

### `useDesktopTheme()`

Returns an object with:
- `preference: "system" | "light" | "dark"` - User's theme preference
- `setPreference(preference: ThemePreference): void` - Set theme preference
- `systemTheme: "light" | "dark" | null` - Current system theme (desktop only)
- `effectiveTheme: "light" | "dark"` - The actual theme being used
- `isDesktop: boolean` - Whether running in desktop environment

### `TauriAPI`

The main API object with the following namespaces:

#### `api.window`
- `minimize(): Promise<void>`
- `maximize(): Promise<void>`
- `unmaximize(): Promise<void>`
- `close(): Promise<void>`
- `setTitle(title: string): Promise<void>`
- `isMaximized(): Promise<boolean>`
- `setFullscreen(fullscreen: boolean): Promise<void>`
- `isFullscreen(): Promise<boolean>`

#### `api.notification`
- `show(options: { title: string; body: string }): Promise<void>`
- `requestPermission(): Promise<"granted" | "denied" | "default">`
- `isPermissionGranted(): Promise<boolean>`

#### `api.theme`
- `getTheme(): Promise<"light" | "dark" | null>`
- `onThemeChanged(callback: (theme: "light" | "dark") => void): Promise<() => void>`

#### `api.updater`
- `checkForUpdates(): Promise<{ available: boolean; version?: string }>`
- `installUpdate(): Promise<void>`

#### `api.fileSystem`
- `saveFile(data: string, filename: string): Promise<void>`
- `openFile(): Promise<string | null>`

## Architecture

### Fallback Strategy

All desktop features have graceful fallbacks for web environments:

- **Window Controls**: Hidden in web, shown in desktop
- **Notifications**: Uses Web Notifications API in browser, native notifications in desktop
- **Theme Detection**: Uses `prefers-color-scheme` media query in browser, native system theme in desktop
- **File System**: Uses browser download/upload in web, native file dialogs in desktop

### State Persistence

Window state (size, position, maximized) is automatically saved when the app closes and restored on next launch. This is handled by the Rust backend and requires no additional code.

## Rust Backend

The desktop features are powered by Tauri commands in `apps/desktop/src-tauri/src/main.rs`:

- `window_minimize`, `window_maximize`, `window_unmaximize`, `window_close`
- `window_is_maximized`, `window_set_fullscreen`, `window_is_fullscreen`
- `show_notification`, `request_notification_permission`, `is_notification_permission_granted`
- `get_system_theme`
- `save_window_state` (automatic on close)

## Testing

To test desktop features:

1. Run the desktop app: `pnpm dev:desktop` (from workspace root)
2. Test window controls by clicking minimize/maximize/close buttons
3. Test notifications by enabling them in settings and triggering a notification
4. Test theme by changing system theme and observing the app update
5. Test window persistence by resizing/moving the window, closing, and reopening

## Requirements

- Tauri v2
- Rust toolchain
- Node.js and pnpm
- Platform-specific dependencies (see Tauri docs)

## Related Files

- `apps/pwa/app/lib/desktop/tauri-api.ts` - Core API implementation
- `apps/pwa/app/lib/desktop/use-tauri.ts` - React hooks
- `apps/pwa/app/components/desktop/window-controls.tsx` - Window control UI
- `apps/pwa/app/components/desktop/title-bar.tsx` - Custom title bar
- `apps/desktop/src-tauri/src/main.rs` - Rust backend commands
- `apps/desktop/src-tauri/Cargo.toml` - Rust dependencies
