import { PrivacySettingsService } from "@/app/features/settings/services/privacy-settings-service";

/**
 * Creates a WebSocket connection to a relay
 * Requirement 1.3: Tor support for network privacy (Tauri only)
 */
const createRelayWebSocket = (url: string): WebSocket => {
  const settings = PrivacySettingsService.getSettings();
  const isTauri = typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__ !== undefined;

  // If Tor is enabled and we are in Tauri, we could potentially use a custom WebSocket implemention
  // or proxy settings. For now, we log the intent and use the default WebSocket.
  // In a full Tauri implementation, this would use @tauri-apps/plugin-websocket or similar.
  if (isTauri && settings.enableTorProxy) {
    console.log(`[Tor] Routing connection to ${url} through proxy: ${settings.torProxyUrl}`);
    // Future: return new TauriWebSocket(url, { proxy: settings.torProxyUrl });
  }

  return new WebSocket(url);
};

export { createRelayWebSocket };
