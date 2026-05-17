/**
 * Desktop Integration Module
 * Provides Tauri API access and desktop-specific features
 */

export { getTauriAPI, isDesktopEnvironment, createTauriAPI } from "./tauri-api";
export type { TauriAPI, TauriWindow, TauriNotification, TauriTheme, TauriUpdater, TauriFileSystem } from "./tauri-api";
export { useTauri, useIsDesktop } from "../hooks/use-tauri";
export { useDesktopNotifications } from "../hooks/use-desktop-notifications";
export { useDesktopTheme } from "../hooks/use-desktop-theme";
export { useDesktopLayout, useHidePWAUI } from "../hooks/use-desktop-layout";
export { useKeyboardShortcuts } from "../hooks/use-keyboard-shortcuts";
export { getKeyboardShortcutManager, formatShortcut } from "./keyboard-shortcuts";
export type { KeyboardShortcut } from "./keyboard-shortcuts";
export { getOfflineManager } from "./offline-manager";
export type { OfflineState } from "./offline-manager";
export { useOfflineState } from "../hooks/use-offline-state";
export { saveRelayState, loadRelayState, updateRelayLastConnected, getSortedRelays, clearRelayState } from "./relay-persistence";
export type { PersistedRelayState } from "./relay-persistence";
export { useDeepLink } from "../hooks/use-deep-link";
export { generateInviteDeepLink, generateDirectMessageDeepLink, generateGroupDeepLink, isObscurDeepLink, parseObscurDeepLink } from "./deep-link-generator";
export type { InviteLinkParams, DirectMessageLinkParams, GroupLinkParams } from "./deep-link-generator";

