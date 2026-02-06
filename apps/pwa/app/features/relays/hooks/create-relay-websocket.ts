import { PrivacySettingsService } from "@/app/features/settings/services/privacy-settings-service";

/**
 * Creates a WebSocket connection to a relay
 * Requirement 1.3: Tor support for network privacy (Tauri only)
 */
const createRelayWebSocket = (url: string): WebSocket => {
  // Requirement 1.3: Tor support handled at the Tauri webview level (proxy_url)
  return new WebSocket(url);
};

export { createRelayWebSocket };
