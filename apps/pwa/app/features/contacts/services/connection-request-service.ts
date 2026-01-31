import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { ConnectionRequest, ConnectionRequestStatusValue } from "@/app/features/messaging/types";

export type StoredConnectionRequests = Readonly<{
    requests: ReadonlyArray<ConnectionRequest>;
}>;

const STORAGE_KEY_PREFIX = "obscur.connection_requests.v1.";

export class ConnectionRequestService {
    private static getStorageKey(myPubkey: string): string {
        return `${STORAGE_KEY_PREFIX}${myPubkey}`;
    }

    static async getRequests(myPubkey: string): Promise<ConnectionRequest[]> {
        if (typeof window === "undefined") return [];
        const raw = localStorage.getItem(this.getStorageKey(myPubkey));
        if (!raw) return [];
        try {
            const parsed = JSON.parse(raw);
            return (parsed.requests || []).map((r: any) => ({
                ...r,
                timestamp: new Date(r.timestamp)
            }));
        } catch (e) {
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
