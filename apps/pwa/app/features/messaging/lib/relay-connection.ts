export type RelayConnectionStatus = "connecting" | "open" | "closed" | "error";

export interface RelayConnection {
    url: string;
    status: RelayConnectionStatus;
    error?: string;
}
