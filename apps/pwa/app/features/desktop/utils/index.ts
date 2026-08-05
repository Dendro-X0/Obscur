/**
 * Desktop utils barrel — leaf modules only.
 * Import React hooks from `@/app/features/desktop/hooks/*` (not here).
 */
export { getTauriAPI, isDesktopEnvironment, createTauriAPI } from "./tauri-api";
export type { TauriAPI, TauriWindow, TauriNotification, TauriTheme, TauriUpdater, TauriFileSystem } from "./tauri-api";
export { getKeyboardShortcutManager, formatShortcut } from "./keyboard-shortcuts";
export type { KeyboardShortcut } from "./keyboard-shortcuts";
export { getOfflineManager } from "./offline-manager";
export type { OfflineState } from "./offline-manager";
export { saveRelayState, loadRelayState, updateRelayLastConnected, getSortedRelays, clearRelayState } from "./relay-persistence";
export type { PersistedRelayState } from "./relay-persistence";
export { generateInviteDeepLink, generateDirectMessageDeepLink, generateGroupDeepLink, isObscurDeepLink, parseObscurDeepLink } from "./deep-link-generator";
export type { InviteLinkParams, DirectMessageLinkParams, GroupLinkParams } from "./deep-link-generator";
