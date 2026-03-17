import { nativeErrorStore } from "../../native/lib/native-error-store";
import { relayHealthMonitor } from "./relay-health-monitor";
import {
    relayNativeAdapter,
    type RelayMessagePayload,
    type RelayProbeReport,
    type RelayStatusPayload,
} from "./relay-native-adapter";
import { logRuntimeEvent } from "@/app/shared/runtime-log-classification";

const formatRelayProbeReport = (report: RelayProbeReport): string => {
    const hostPort = `${report.host ?? "?"}:${report.port ?? "?"}`;
    const proxy = report.proxy_url ? ` proxy=${report.proxy_url}` : "";
    const dns = report.dns_ok ? `dns=ok(${report.dns_results.length})` : "dns=fail";
    const tcp = report.tcp_ok ? "tcp=ok" : "tcp=fail";
    const ws = report.ws_ok ? "ws=ok" : "ws=fail";
    const error = report.error ? ` error=${report.error}` : "";
    return `[RelayProbe] ${report.url} scheme=${report.scheme} host=${hostPort} tor=${String(report.tor_enabled)}${proxy} ${dns} ${tcp} ${ws}${error}`;
};

const toErrorMessage = (error: unknown): string => (
    error instanceof Error ? error.message : String(error)
);

const NOT_CONNECTED_PATTERN = /\bnot connected\b/i;
const isNotConnectedError = (message: string): boolean => NOT_CONNECTED_PATTERN.test(message);
const TIMEOUT_PATTERN = /\b(timeout|timed out)\b/i;
const isTimeoutError = (message: string): boolean => TIMEOUT_PATTERN.test(message);
const SEND_QUEUE_SATURATED_PATTERN = /\b(send queue saturated|queue saturated)\b/i;
const isSendQueueSaturatedError = (message: string): boolean => SEND_QUEUE_SATURATED_PATTERN.test(message);

const createRelayErrorEvent = (message: string): Event => {
    try {
        return new CustomEvent("error", { detail: { message } });
    } catch {
        return new Event("error");
    }
};

export class NativeRelay implements EventTarget {
    public url: string;
    public readyState: number;
    public binaryType: BinaryType = "blob";
    public bufferedAmount: number = 0;
    public extensions: string = "";
    public protocol: string = "";
    public onclose: ((this: WebSocket, ev: CloseEvent) => void) | null = null;
    public onerror: ((this: WebSocket, ev: Event) => void) | null = null;
    public onmessage: ((this: WebSocket, ev: MessageEvent) => void) | null = null;
    public onopen: ((this: WebSocket, ev: Event) => void) | null = null;

    private listeners: Map<string, Set<EventListenerOrEventListenerObject>> = new Map();
    private unlistenStatus: (() => void) | null = null;
    private unlistenMessage: (() => void) | null = null;

    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;

    constructor(url: string) {
        this.url = url;
        this.readyState = NativeRelay.CONNECTING;
        this.initAndConnect();
    }

    private transportMode: "unknown" | "native" | "browser" = "unknown";
    private closeRequested: boolean = false;
    private socket: WebSocket | null = null;
    private nativeConnected: boolean = false;
    private nativeDisconnectInFlight: boolean = false;

    private async initAndConnect() {
        try {
            const torStatus = await relayNativeAdapter.getTorStatus();
            if (this.closeRequested || this.readyState === NativeRelay.CLOSING || this.readyState === NativeRelay.CLOSED) {
                return;
            }

            try {
                this.transportMode = "native";
                await this.initListeners();
                if (this.closeRequested || this.readyState === NativeRelay.CLOSING || this.readyState === NativeRelay.CLOSED) {
                    this.cleanup();
                    return;
                }
                await this.connect();
                return;
            } catch (nativeError) {
                this.cleanup();
                if (torStatus === "enabled") {
                    throw nativeError;
                }
                this.transportMode = "browser";
                logRuntimeEvent("native_relay.fallback_to_browser", "degraded", [
                    `[NativeRelay] Native relay path failed for ${this.url}; falling back to browser WebSocket`,
                    nativeError,
                ]);
                this.connectBrowser();
            }
        } catch (e) {
            if (this.closeRequested) {
                return;
            }
            const errorMessage = toErrorMessage(e);
            logRuntimeEvent("native_relay.init_failed", "actionable", [
                `Failed to initialize NativeRelay for ${this.url}: ${errorMessage}`,
                e,
            ]);
            nativeErrorStore.addError({
                code: "RELAY_INIT_FAILED",
                message: `Failed to initialize relay connection to ${this.url}`,
                retryable: true,
                retry: () => this.initAndConnect()
            });
            const errorEvent = createRelayErrorEvent(errorMessage);
            this.dispatchEvent(errorEvent);
            if (this.onerror) {
                const wsThis = this as unknown as WebSocket;
                this.onerror.call(wsThis, errorEvent);
            }
        }
    }

    private connectBrowser() {
        try {
            const browserSocket = new WebSocket(this.url);
            this.socket = browserSocket;
            browserSocket.binaryType = this.binaryType;
            let terminalHandled = false;

            const finalizeBrowserFailure = (event: Event): void => {
                if (terminalHandled || this.closeRequested) {
                    return;
                }
                terminalHandled = true;
                this.readyState = NativeRelay.CLOSED;
                if (this.socket === browserSocket) {
                    this.socket = null;
                }
                browserSocket.onopen = null;
                browserSocket.onmessage = null;
                browserSocket.onerror = null;
                browserSocket.onclose = null;
                this.dispatchEvent(new Event("error"));
                if (this.onerror) {
                    const wsThis = this as unknown as WebSocket;
                    this.onerror.call(wsThis, event);
                }
            };

            const finalizeBrowserClose = (event: CloseEvent): void => {
                if (terminalHandled) {
                    return;
                }
                terminalHandled = true;
                this.readyState = NativeRelay.CLOSED;
                if (this.socket === browserSocket) {
                    this.socket = null;
                }
                const closeEvent = new CloseEvent("close", { code: event.code, reason: event.reason, wasClean: event.wasClean });
                this.dispatchEvent(closeEvent);
                if (this.onclose) {
                    const wsThis = this as unknown as WebSocket;
                    this.onclose.call(wsThis, closeEvent);
                }
            };

            browserSocket.onopen = (event) => {
                if (terminalHandled || this.closeRequested) {
                    return;
                }
                this.readyState = NativeRelay.OPEN;
                relayHealthMonitor.recordConnectionSuccess(this.url);
                this.dispatchEvent(new Event("open"));
                if (this.onopen) {
                    const wsThis = this as unknown as WebSocket;
                    this.onopen.call(wsThis, event);
                }
            };

            browserSocket.onmessage = (event) => {
                if (terminalHandled || this.closeRequested) {
                    return;
                }
                const messageEvent = new MessageEvent("message", { data: event.data });
                this.dispatchEvent(messageEvent);
                if (this.onmessage) {
                    const wsThis = this as unknown as WebSocket;
                    this.onmessage.call(wsThis, messageEvent);
                }
            };

            browserSocket.onerror = (event) => {
                relayHealthMonitor.recordConnectionFailure(this.url, "WebSocket error");
                finalizeBrowserFailure(event);
            };

            browserSocket.onclose = (event) => {
                finalizeBrowserClose(event);
            };
        } catch (e) {
            const errorMessage = toErrorMessage(e);
            logRuntimeEvent("native_relay.browser_connect_failed", "actionable", [
                `Browser WebSocket connection failed for ${this.url}: ${errorMessage}`,
                e,
            ]);
            this.readyState = NativeRelay.CLOSED;
            const errorEvent = createRelayErrorEvent(errorMessage);
            this.dispatchEvent(errorEvent);
        }
    }

    private async initListeners() {
        this.unlistenStatus = await relayNativeAdapter.listenRelayStatus((event: { payload?: RelayStatusPayload }) => {
            if (!event.payload) return;
            if (event.payload.url !== this.url) return;

            const status = event.payload.status;
            if (status === "connected") {
                const wasOpen = this.readyState === NativeRelay.OPEN;
                this.nativeConnected = true;
                this.readyState = NativeRelay.OPEN;
                if (!wasOpen) {
                    relayHealthMonitor.recordConnectionSuccess(this.url);
                    this.dispatchEvent(new Event("open"));
                    if (this.onopen) {
                        const wsThis = this as unknown as WebSocket;
                        this.onopen.call(wsThis, new Event("open"));
                    }
                }
            } else if (status === "disconnected") {
                this.nativeConnected = false;
                if (this.readyState !== NativeRelay.CLOSED) {
                    const wasClosing = this.closeRequested || this.readyState === NativeRelay.CLOSING;
                    this.readyState = NativeRelay.CLOSED;
                    if (!wasClosing) {
                        relayHealthMonitor.recordConnectionFailure(this.url, "Unexpected disconnect");
                    }
                    const closeEvent = new CloseEvent("close", { wasClean: true });
                    this.dispatchEvent(closeEvent);
                    if (this.onclose) {
                        const wsThis = this as unknown as WebSocket;
                        this.onclose.call(wsThis, closeEvent);
                    }
                }
            } else if (status === "error") {
                this.nativeConnected = false;
                relayHealthMonitor.recordConnectionFailure(this.url, "Relay error");
                const errorEvent = createRelayErrorEvent("Relay status error");
                this.dispatchEvent(errorEvent);
                if (this.onerror) {
                    const wsThis = this as unknown as WebSocket;
                    this.onerror.call(wsThis, errorEvent);
                }
                // Keep wrapper state aligned with native transport lifecycle.
                // Otherwise upper layers can continue sending on a dead relay handle.
                this.emitCloseFromTransportFailure("Relay status error");
            }
        });

        this.unlistenMessage = await relayNativeAdapter.listenRelayEvent((event: { payload?: RelayMessagePayload }) => {
            if (!event.payload) return;
            // FIX: Normalize URLs for comparison to avoid mismatch issues
            const eventUrl = event.payload.relay_url.replace(/\/$/, "");
            const thisUrl = this.url.replace(/\/$/, "");

            if (eventUrl !== thisUrl) return;

            const data = JSON.stringify(event.payload.payload);
            const messageEvent = new MessageEvent("message", { data });
            this.dispatchEvent(messageEvent);
            if (this.onmessage) {
                const wsThis = this as unknown as WebSocket;
                this.onmessage.call(wsThis, messageEvent);
            }
        });
    }

    private async connect() {
        try {
            const result = await relayNativeAdapter.connectRelay(this.url);
            relayHealthMonitor.recordConnectionSuccess(this.url);
            this.nativeConnected = true;

            // CRITICAL FIX: Handle "Already connected" response
            if (result === "Already connected") {
                if (this.readyState !== NativeRelay.OPEN) {
                    this.readyState = NativeRelay.OPEN;
                    this.dispatchEvent(new Event("open"));
                    if (this.onopen) {
                        const wsThis = this as unknown as WebSocket;
                        this.onopen.call(wsThis, new Event("open"));
                    }
                }
            }
        } catch (e) {
            const errorMessage = toErrorMessage(e);
            logRuntimeEvent("native_relay.connect_failed", "actionable", [
                `Failed to connect to native relay ${this.url}: ${errorMessage}`,
                e,
            ]);
            relayHealthMonitor.recordConnectionFailure(this.url, errorMessage);
            this.nativeConnected = false;

            let probeMessage: string | null = null;
            try {
                const report = await relayNativeAdapter.probeRelay(this.url);
                probeMessage = formatRelayProbeReport(report);
            } catch (probeError) {
                probeMessage = `Relay probe failed: ${probeError instanceof Error ? probeError.message : String(probeError)}`;
            }

            nativeErrorStore.addError({
                code: "RELAY_CONNECT_FAILED",
                message: `Failed to connect to ${this.url}: ${e}${probeMessage ? `\n${probeMessage}` : ""}`,
                retryable: true,
                retry: () => this.connect()
            });

            const errorEvent = createRelayErrorEvent(
                probeMessage ? `${errorMessage} | ${probeMessage}` : errorMessage
            );
            this.dispatchEvent(errorEvent);
            if (this.onerror) {
                const wsThis = this as unknown as WebSocket;
                this.onerror.call(wsThis, errorEvent);
            }

            this.readyState = NativeRelay.CLOSED;
            const closeEvent = new CloseEvent("close", { wasClean: false, reason: errorMessage.slice(0, 120) });
            this.dispatchEvent(closeEvent);
            if (this.onclose) {
                const wsThis = this as unknown as WebSocket;
                this.onclose.call(wsThis, closeEvent);
            }
        }
    }

    public async send(data: string | ArrayBufferLike | Blob | ArrayBufferView): Promise<void> {
        if (this.readyState !== NativeRelay.OPEN) {
            logRuntimeEvent("native_relay.send_not_open", "expected", [
                `WebSocket is not open: readyState=${this.readyState}`,
            ]);
            return;
        }

        if (this.transportMode === "browser" && this.socket) {
            this.socket.send(data);
            return;
        }

        if (typeof data !== "string") {
            logRuntimeEvent("native_relay.send_non_string", "actionable", [
                "NativeRelay only supports string messages",
            ]);
            return;
        }

        try {
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) {
                if (parsed[0] === "REQ" && typeof parsed[1] === "string") {
                    await relayNativeAdapter.subscribeRelay(this.url, parsed[1], parsed[2]);
                    return;
                }
                if (parsed[0] === "CLOSE" && typeof parsed[1] === "string") {
                    await relayNativeAdapter.unsubscribeRelay(this.url, parsed[1]);
                    return;
                }
            }
        } catch {
            // Not a JSON message or not a subscription command, send as raw
        }

        try {
            await relayNativeAdapter.sendRelayMessage(this.url, data);
        } catch (e) {
            const errorMessage = toErrorMessage(e);
            const notConnected = isNotConnectedError(errorMessage);
            const timeout = isTimeoutError(errorMessage);
            const queueSaturated = isSendQueueSaturatedError(errorMessage);
            const transportFailure = notConnected || timeout || queueSaturated;
            logRuntimeEvent(
                notConnected
                    ? "native_relay.send_failed_not_connected"
                    : timeout
                        ? "native_relay.send_failed_timeout"
                        : queueSaturated
                            ? "native_relay.send_failed_queue_saturated"
                        : "native_relay.send_failed",
                transportFailure ? "degraded" : "actionable",
                [
                    `Failed to send message to ${this.url}: ${errorMessage}`,
                    e,
                ],
                transportFailure
                    ? {
                        windowMs: 30_000,
                        maxPerWindow: 1,
                        summaryEverySuppressed: 50,
                    }
                    : undefined
            );
            if (!transportFailure) {
                nativeErrorStore.addError({
                    code: "RELAY_SEND_FAILED",
                    message: `Failed to send message to ${this.url}`,
                    retryable: true,
                    retry: () => this.send(data)
                });
            }
            if (transportFailure) {
                this.nativeConnected = false;
            }

            const errorEvent = createRelayErrorEvent(errorMessage);
            this.dispatchEvent(errorEvent);
            if (this.onerror) {
                const wsThis = this as unknown as WebSocket;
                this.onerror.call(wsThis, errorEvent);
            }

            this.emitCloseFromTransportFailure(errorMessage);
        }
    }

    public async close(code?: number, reason?: string): Promise<void> {
        if (this.readyState === NativeRelay.CLOSED || this.nativeDisconnectInFlight) {
            return;
        }

        this.closeRequested = true;
        this.readyState = NativeRelay.CLOSING;

        if (this.transportMode !== "native") {
            this.cleanup();
            if (this.socket) {
                this.socket.close(code, reason);
                this.socket = null;
                return;
            }
            this.readyState = NativeRelay.CLOSED;
            const closeEvent = new CloseEvent("close", { code, reason, wasClean: true });
            this.dispatchEvent(closeEvent);
            if (this.onclose) {
                const wsThis = this as unknown as WebSocket;
                this.onclose.call(wsThis, closeEvent);
            }
            return;
        }

        if (this.socket) {
            this.socket.close(code, reason);
            this.socket = null;
        }

        if (!this.nativeConnected) {
            this.cleanup();
            this.readyState = NativeRelay.CLOSED;
            const closeEvent = new CloseEvent("close", { code, reason, wasClean: true });
            this.dispatchEvent(closeEvent);
            if (this.onclose) {
                const wsThis = this as unknown as WebSocket;
                this.onclose.call(wsThis, closeEvent);
            }
            return;
        }

        this.nativeDisconnectInFlight = true;
        try {
            await relayNativeAdapter.disconnectRelay(this.url);
            this.nativeConnected = false;
        } catch (e) {
            const errorMessage = toErrorMessage(e);
            this.nativeConnected = false;
            if (isNotConnectedError(errorMessage)) {
                logRuntimeEvent("native_relay.disconnect_not_connected", "expected", [
                    `Native relay already disconnected ${this.url}`,
                ]);
            } else {
                logRuntimeEvent("native_relay.disconnect_failed", "degraded", [
                    `Error disconnecting native relay ${this.url}: ${errorMessage}`,
                    e,
                ]);
            }
        } finally {
            this.nativeDisconnectInFlight = false;
            this.cleanup();
            this.readyState = NativeRelay.CLOSED;
            const closeEvent = new CloseEvent("close", { code, reason, wasClean: true });
            this.dispatchEvent(closeEvent);
            if (this.onclose) {
                const wsThis = this as unknown as WebSocket;
                this.onclose.call(wsThis, closeEvent);
            }
        }
    }

    private emitCloseFromTransportFailure(reason: string): void {
        if (this.readyState === NativeRelay.CLOSED) {
            return;
        }
        this.readyState = NativeRelay.CLOSED;
        const closeEvent = new CloseEvent("close", {
            wasClean: false,
            reason: reason.slice(0, 120),
        });
        this.dispatchEvent(closeEvent);
        if (this.onclose) {
            const wsThis = this as unknown as WebSocket;
            this.onclose.call(wsThis, closeEvent);
        }
    }

    /**
     * Dispose stale JS handle state without issuing a native disconnect.
     * Used by relay-pool generation gating when a newer socket instance already
     * owns the same URL-scoped native connection lifecycle.
     */
    public disposeStaleHandle(): void {
        this.closeRequested = true;
        if (this.transportMode === "browser" && this.socket) {
            try {
                this.socket.close();
            } catch {
                // Ignore browser close failures during stale-handle disposal.
            }
            this.socket = null;
        }
        this.cleanup();
        this.readyState = NativeRelay.CLOSED;
    }

    private cleanup() {
        this.nativeConnected = false;
        if (this.socket) {
            this.socket.onopen = null;
            this.socket.onmessage = null;
            this.socket.onerror = null;
            this.socket.onclose = null;
        }
        if (this.unlistenStatus) {
            try {
                this.unlistenStatus();
            } catch (error) {
                logRuntimeEvent("native_relay.unlisten_status_failed", "expected", [error]);
            }
            this.unlistenStatus = null;
        }
        if (this.unlistenMessage) {
            try {
                this.unlistenMessage();
            } catch (error) {
                logRuntimeEvent("native_relay.unlisten_message_failed", "expected", [error]);
            }
            this.unlistenMessage = null;
        }
    }

    public addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
        let set = this.listeners.get(type);
        if (!set) {
            set = new Set();
            this.listeners.set(type, set);
        }
        set.add(listener);
    }

    public removeEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
        const set = this.listeners.get(type);
        if (set) {
            set.delete(listener);
        }
    }

    public dispatchEvent(event: Event): boolean {
        const set = this.listeners.get(event.type);
        if (set) {
            set.forEach(listener => {
                if (typeof listener === "function") {
                    listener.call(this, event);
                } else {
                    listener.handleEvent(event);
                }
            });
        }
        return true;
    }
}
