import { isLocalWorkspaceRelayHost } from "@/app/features/groups/services/workspace-relay-url";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";

/**
 * Creates a WebSocket connection to a relay
 * Requirement 1.3: Tor support for network privacy (Tauri only)
 */
import { NativeRelay } from "./native-relay";

/**
 * Creates a WebSocket connection to a relay.
 * Local workspace relays (localhost:7000) always use the WebView WebSocket so
 * NIP-20 OK frames are delivered on the same object that publish() awaits.
 */
const createRelayWebSocket = (url: string): WebSocket => {
  if (hasNativeRuntime() && !isLocalWorkspaceRelayHost(url)) {
    return new NativeRelay(url) as unknown as WebSocket;
  }
  return new WebSocket(url);
};

export { createRelayWebSocket };
