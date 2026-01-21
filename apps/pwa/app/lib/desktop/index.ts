/**
 * Desktop Integration Module
 * Provides Tauri API access and desktop-specific features
 */

export { getTauriAPI, isDesktopEnvironment, createTauriAPI } from "./tauri-api";
export type { TauriAPI, TauriWindow, TauriNotification, TauriTheme, TauriUpdater, TauriFileSystem } from "./tauri-api";
export { useTauri, useIsDesktop } from "./use-tauri";
export { useDesktopNotifications } from "./use-desktop-notifications";
export { useDesktopTheme } from "./use-desktop-theme";
export { useDesktopLayout, useHidePWAUI } from "./use-desktop-layout";
export { useKeyboardShortcuts } from "./use-keyboard-shortcuts";
export { getKeyboardShortcutManager, formatShortcut } from "./keyboard-shortcuts";
export type { KeyboardShortcut } from "./keyboard-shortcuts";
export { getOfflineManager } from "./offline-manager";
export type { OfflineState } from "./offline-manager";
export { useOfflineState } from "./use-offline-state";
export { saveRelayState, loadRelayState, updateRelayLastConnected, getSortedRelays, clearRelayState } from "./relay-persistence";
export type { PersistedRelayState } from "./relay-persistence";
export { useDeepLink } from "./use-deep-link";
export { generateInviteDeepLink, generateDirectMessageDeepLink, generateGroupDeepLink, isObscurDeepLink, parseObscurDeepLink } from "./deep-link-generator";
export type { InviteLinkParams, DirectMessageLinkParams, GroupLinkParams } from "./deep-link-generator";

