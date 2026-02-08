import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { nativeErrorStore } from "../../native/lib/native-error-store";
import { relayHealthMonitor } from "./relay-health-monitor";

interface RelayMessage {
    relay_url: string;
    payload: unknown;
}

interface RelayStatus {
    url: string;
    status: "connected" | "disconnected" | "error" | "starting";
}

interface RelayProbeReport {
    url: string;
    scheme: string;
    host: string | null;
    port: number | null;
    tor_enabled: boolean;
    proxy_url: string | null;
    dns_ok: boolean;
    dns_results: ReadonlyArray<string>;
    tcp_ok: boolean;
    ws_ok: boolean;
    error: string | null;
}

const formatRelayProbeReport = (report: RelayProbeReport): string => {
    const hostPort = `${report.host ?? "?"}:${report.port ?? "?"}`;
    const proxy = report.proxy_url ? ` proxy=${report.proxy_url}` : "";
    const dns = report.dns_ok ? `dns=ok(${report.dns_results.length})` : "dns=fail";
    const tcp = report.tcp_ok ? "tcp=ok" : "tcp=fail";
    const ws = report.ws_ok ? "ws=ok" : "ws=fail";
    const error = report.error ? ` error=${report.error}` : "";
    return `[RelayProbe] ${report.url} scheme=${report.scheme} host=${hostPort} tor=${String(report.tor_enabled)}${proxy} ${dns} ${tcp} ${ws}${error}`;
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
    private unlistenStatus: UnlistenFn | null = null;
    private unlistenMessage: UnlistenFn | null = null;

    static readonly CONNECTING = 0;
    static readonly OPEN = 1;
    static readonly CLOSING = 2;
    static readonly CLOSED = 3;

    constructor(url: string) {
        this.url = url;
        this.readyState = NativeRelay.CONNECTING;
        this.initAndConnect();
    }

    private async initAndConnect() {
        try {
            await this.initListeners();
            await this.connect();
        } catch (e) {
            console.error(`Failed to initialize NativeRelay for ${this.url}:`, e);
            nativeErrorStore.addError({
                code: "RELAY_INIT_FAILED",
                message: `Failed to initialize relay connection to ${this.url}`,
                retryable: true,
                retry: () => this.initAndConnect()
            });
            const errorEvent = new Event("error");
            this.dispatchEvent(errorEvent);
            if (this.onerror) {
                const wsThis = this as unknown as WebSocket;
                this.onerror.call(wsThis, errorEvent);
            }
        }
    }

    private async initListeners() {
        this.unlistenStatus = await listen<RelayStatus>("relay-status", (event) => {
            if (event.payload.url !== this.url) return;

            const status = event.payload.status;
            if (status === "connected") {
                this.readyState = NativeRelay.OPEN;
                relayHealthMonitor.recordConnectionSuccess(this.url);
                this.dispatchEvent(new Event("open"));
                if (this.onopen) {
                    const wsThis = this as unknown as WebSocket;
                    this.onopen.call(wsThis, new Event("open"));
                }
            } else if (status === "disconnected") {
                if (this.readyState !== NativeRelay.CLOSED) {
                    this.readyState = NativeRelay.CLOSED;
                    relayHealthMonitor.recordConnectionFailure(this.url, "Unexpected disconnect");
                    const closeEvent = new CloseEvent("close", { wasClean: true });
                    this.dispatchEvent(closeEvent);
                    if (this.onclose) {
                        const wsThis = this as unknown as WebSocket;
                        this.onclose.call(wsThis, closeEvent);
                    }
                }
            } else if (status === "error") {
                relayHealthMonitor.recordConnectionFailure(this.url, "Relay error");
                const errorEvent = new Event("error");
                this.dispatchEvent(errorEvent);
                if (this.onerror) {
                    const wsThis = this as unknown as WebSocket;
                    this.onerror.call(wsThis, errorEvent);
                }
            }
        });

        this.unlistenMessage = await listen<RelayMessage>("relay-event", (event) => {
            if (event.payload.relay_url !== this.url) return;

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
            await invoke("connect_relay", { url: this.url });
            relayHealthMonitor.recordConnectionSuccess(this.url);
        } catch (e) {
            console.error(`Failed to connect to native relay ${this.url}:`, e);
            relayHealthMonitor.recordConnectionFailure(this.url, String(e));

            let probeMessage: string | null = null;
            try {
                const report = await invoke<RelayProbeReport>("probe_relay", { url: this.url });
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

            const errorEvent = new Event("error");
            this.dispatchEvent(errorEvent);
            if (this.onerror) {
                const wsThis = this as unknown as WebSocket;
                this.onerror.call(wsThis, errorEvent);
            }

            this.readyState = NativeRelay.CLOSED;
            const closeEvent = new CloseEvent("close", { wasClean: false });
            this.dispatchEvent(closeEvent);
            if (this.onclose) {
                const wsThis = this as unknown as WebSocket;
                this.onclose.call(wsThis, closeEvent);
            }
        }
    }

    public async send(data: string | ArrayBufferLike | Blob | ArrayBufferView): Promise<void> {
        if (this.readyState !== NativeRelay.OPEN) {
            console.warn("WebSocket is not open: readyState " + this.readyState);
            return;
        }

        if (typeof data !== "string") {
            console.error("NativeRelay only supports string messages");
            return;
        }

        try {
            const parsed = JSON.parse(data);
            if (Array.isArray(parsed)) {
                if (parsed[0] === "REQ" && typeof parsed[1] === "string") {
                    await invoke("subscribe_relay", { url: this.url, subId: parsed[1], filter: parsed[2] });
                    return;
                }
                if (parsed[0] === "CLOSE" && typeof parsed[1] === "string") {
                    await invoke("unsubscribe_relay", { url: this.url, subId: parsed[1] });
                    return;
                }
            }
        } catch {
            // Not a JSON message or not a subscription command, send as raw
        }

        try {
            await invoke("send_relay_message", { url: this.url, message: data });
        } catch (e) {
            console.error(`Failed to send message to ${this.url}:`, e);
            nativeErrorStore.addError({
                code: "RELAY_SEND_FAILED",
                message: `Failed to send message to ${this.url}`,
                retryable: true,
                retry: () => this.send(data)
            });

            const errorEvent = new Event("error");
            this.dispatchEvent(errorEvent);
            if (this.onerror) {
                const wsThis = this as unknown as WebSocket;
                this.onerror.call(wsThis, errorEvent);
            }
        }
    }

    public async close(code?: number, reason?: string): Promise<void> {
        this.readyState = NativeRelay.CLOSING;
        try {
            await invoke("disconnect_relay", {
                url: this.url
            });
        } catch (e) {
            console.warn(`Error disconnecting native relay ${this.url}:`, e);
        } finally {
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

    private cleanup() {
        if (this.unlistenStatus) {
            this.unlistenStatus();
            this.unlistenStatus = null;
        }
        if (this.unlistenMessage) {
            this.unlistenMessage();
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
