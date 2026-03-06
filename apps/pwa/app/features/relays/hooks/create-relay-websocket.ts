import { PrivacySettingsService } from "@/app/features/settings/services/privacy-settings-service";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";

/**
 * Creates a WebSocket connection to a relay
 * Requirement 1.3: Tor support for network privacy (Tauri only)
 */
import { NativeRelay } from "./native-relay";

/**
 * Creates a WebSocket connection to a relay
 * Requirement 1.3: Tor support for network privacy (Tauri only)
 */
const createRelayWebSocket = (url: string): WebSocket => {
  if (hasNativeRuntime()) {
    return new NativeRelay(url) as unknown as WebSocket;
  }
  return new WebSocket(url);
};

export { createRelayWebSocket };
