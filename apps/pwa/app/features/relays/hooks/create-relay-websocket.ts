import { isLocalWorkspaceRelayHost } from "@/app/features/groups/services/workspace-relay-url";
import { hasNativeRuntime } from "@/app/features/runtime/runtime-capabilities";
import {
  releaseProcessPublicWarmupDial,
  tryClaimProcessPublicWarmupDial,
} from "@/app/features/relays/services/relay-warmup-dial-cap";

/**
 * Creates a WebSocket connection to a relay
 * Requirement 1.3: Tor support for network privacy (Tauri only)
 */
import { NativeRelay } from "./native-relay";

/**
 * Closed stub when process-wide Quiet dial cap refuses NativeRelay.
 * Callers that already claimed in connectRelay never hit this; other
 * createRelayWebSocket sites (discovery / standalone) must not stampede.
 */
class QuietDialRejectedSocket extends EventTarget {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;

  readonly url: string;
  readyState = QuietDialRejectedSocket.CLOSED;
  binaryType: BinaryType = "blob";
  bufferedAmount = 0;
  extensions = "";
  protocol = "";
  onopen: ((this: WebSocket, ev: Event) => void) | null = null;
  onmessage: ((this: WebSocket, ev: MessageEvent) => void) | null = null;
  onerror: ((this: WebSocket, ev: Event) => void) | null = null;
  onclose: ((this: WebSocket, ev: CloseEvent) => void) | null = null;

  constructor(url: string) {
    super();
    this.url = url;
    queueMicrotask(() => {
      const closeEvent = new CloseEvent("close", {
        wasClean: true,
        code: 4000,
        reason: "quiet_dial_cap",
      });
      this.dispatchEvent(closeEvent);
      this.onclose?.call(this as unknown as WebSocket, closeEvent);
    });
  }

  send(_data: string | ArrayBufferLike | Blob | ArrayBufferView): void {
    throw new Error("quiet_dial_cap");
  }

  close(): void {
    this.readyState = QuietDialRejectedSocket.CLOSED;
  }
}

/**
 * Creates a WebSocket connection to a relay.
 * Local workspace relays (localhost:7000) always use the WebView WebSocket so
 * NIP-20 OK frames are delivered on the same object that publish() awaits.
 *
 * Slice 2: public Quiet NativeRelay dials share a process-wide cap of 1.
 */
const createRelayWebSocket = (url: string): WebSocket => {
  const native = hasNativeRuntime() && !isLocalWorkspaceRelayHost(url);
  if (native) {
    // Claim here so every NativeRelay site shares the Quiet budget (not only mesh client).
    if (!tryClaimProcessPublicWarmupDial(url)) {
      return new QuietDialRejectedSocket(url) as unknown as WebSocket;
    }
    const socket = new NativeRelay(url) as unknown as WebSocket;
    const originalClose = socket.close.bind(socket);
    socket.close = ((code?: number, reason?: string) => {
      releaseProcessPublicWarmupDial(url);
      return originalClose(code, reason);
    }) as WebSocket["close"];
    return socket;
  }
  return new WebSocket(url);
};

export { createRelayWebSocket };
