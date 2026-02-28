import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { ConnectionRequest, ConnectionRequestStatusValue } from "@/app/features/messaging/types";

export type StoredConnectionRequests = Readonly<{
    requests: ReadonlyArray<ConnectionRequest>;
}>;

const STORAGE_KEY_PREFIX = "obscur.connection_requests.v1.";

type StoredConnectionRequestRecord = Readonly<{
    id: string;
    status: ConnectionRequestStatusValue;
    isOutgoing: boolean;
    introMessage?: string;
    timestamp: string;
}>;

const isStoredConnectionRequestRecord = (value: unknown): value is StoredConnectionRequestRecord => {
    if (!value || typeof value !== "object") {
        return false;
    }
    const v = value as Record<string, unknown>;
    if (typeof v.id !== "string") {
        return false;
    }
    if (typeof v.status !== "string") {
        return false;
    }
    if (typeof v.isOutgoing !== "boolean") {
        return false;
    }
    if (typeof v.timestamp !== "string") {
        return false;
    }
    return true;
};

const parseStoredRequest = (value: unknown): ConnectionRequest | null => {
    if (!isStoredConnectionRequestRecord(value)) {
        return null;
    }
    const parsedDate: Date = new Date(value.timestamp);
    if (Number.isNaN(parsedDate.getTime())) {
        return null;
    }
    return {
        id: value.id as PublicKeyHex,
        status: value.status,
        isOutgoing: value.isOutgoing,
        introMessage: typeof value.introMessage === "string" ? value.introMessage : undefined,
        timestamp: parsedDate
    };
};

export class ConnectionRequestService {
    private static getStorageKey(myPubkey: string): string {
        return `${STORAGE_KEY_PREFIX}${myPubkey}`;
    }

    static async getRequests(myPubkey: string): Promise<ConnectionRequest[]> {
        if (typeof window === "undefined") return [];
        const raw = localStorage.getItem(this.getStorageKey(myPubkey));
        if (!raw) return [];
        try {
            const parsed: unknown = JSON.parse(raw);
            if (!parsed || typeof parsed !== "object") {
                return [];
            }
            const record = parsed as Record<string, unknown>;
            const requestsRaw: unknown = record.requests;
            if (!Array.isArray(requestsRaw)) {
                return [];
            }
            return requestsRaw
                .map((candidate: unknown): ConnectionRequest | null => parseStoredRequest(candidate))
                .filter((v: ConnectionRequest | null): v is ConnectionRequest => v !== null);
        } catch {
            return [];
        }
    }

    static async saveRequests(myPubkey: string, requests: ConnectionRequest[]): Promise<void> {
        if (typeof window === "undefined") return;
        localStorage.setItem(this.getStorageKey(myPubkey), JSON.stringify({ requests }));
    }

    static async addRequest(myPubkey: string, request: ConnectionRequest): Promise<void> {
        const requests = await this.getRequests(myPubkey);
        const filtered = requests.filter(r => r.id !== request.id);
        await this.saveRequests(myPubkey, [...filtered, request]);
    }

    static async updateRequestStatus(myPubkey: string, peerPubkey: string, status: ConnectionRequestStatusValue): Promise<void> {
        const requests = await this.getRequests(myPubkey);
        const updated = requests.map(r => r.id === peerPubkey ? { ...r, status } : r);
        await this.saveRequests(myPubkey, updated);
    }
}
