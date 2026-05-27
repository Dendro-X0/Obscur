import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";

const STORAGE_KEY_PREFIX = "obscur:room-keys:v1";

export interface RoomKeyRecord {
    groupId: string;
    roomKeyHex: string;
    previousKeys?: string[];
    createdAt: number;
}

const uniqueNonEmptyKeys = (values: ReadonlyArray<string>): string[] => (
    Array.from(new Set(values.filter((value) => typeof value === "string" && value.trim().length > 0)))
);

const profileStorageKey = (profileId?: string): string => {
    const scopedProfileId = profileId ?? getResolvedProfileId();
    return `${STORAGE_KEY_PREFIX}:${scopedProfileId || "default"}`;
};

const readPersistedMap = (profileId?: string): Map<string, RoomKeyRecord> => {
    if (typeof window === "undefined") {
        return new Map();
    }
    try {
        const raw = window.localStorage.getItem(profileStorageKey(profileId));
        if (!raw) {
            return new Map();
        }
        const parsed = JSON.parse(raw) as Record<string, RoomKeyRecord>;
        const map = new Map<string, RoomKeyRecord>();
        Object.entries(parsed).forEach(([groupId, record]) => {
            if (record?.groupId && typeof record.roomKeyHex === "string" && record.roomKeyHex.trim().length > 0) {
                map.set(groupId, record);
            }
        });
        return map;
    } catch {
        return new Map();
    }
};

const writePersistedMap = (records: Map<string, RoomKeyRecord>, profileId?: string): void => {
    if (typeof window === "undefined") {
        return;
    }
    try {
        const payload: Record<string, RoomKeyRecord> = {};
        records.forEach((record, groupId) => {
            payload[groupId] = record;
        });
        window.localStorage.setItem(profileStorageKey(profileId), JSON.stringify(payload));
    } catch {
        // Quota / private mode — in-memory cache still works for the session.
    }
};

export class RoomKeyStore {
    private cache = new Map<string, RoomKeyRecord>();

    private ensureCacheHydrated(): void {
        if (this.cache.size > 0) {
            return;
        }
        const persisted = readPersistedMap();
        persisted.forEach((record, groupId) => {
            this.cache.set(groupId, record);
        });
    }

    private persistRecord(record: RoomKeyRecord): void {
        this.cache.set(record.groupId, record);
        const persisted = readPersistedMap();
        persisted.set(record.groupId, record);
        writePersistedMap(persisted);
    }

    async saveRoomKey(groupId: string, roomKeyHex: string): Promise<void> {
        const existing = await this.getRoomKeyRecord(groupId);
        const record: RoomKeyRecord = {
            groupId,
            roomKeyHex,
            previousKeys: existing?.previousKeys ?? [],
            createdAt: existing?.createdAt ?? Date.now(),
        };
        this.persistRecord(record);
    }

    async rotateRoomKey(groupId: string, newKeyHex: string): Promise<void> {
        const existing = await this.getRoomKeyRecord(groupId);
        if (!existing) {
            throw new Error("Cannot rotate non-existent key");
        }
        const previousKeys = existing.previousKeys ?? [];
        if (!previousKeys.includes(existing.roomKeyHex)) {
            previousKeys.push(existing.roomKeyHex);
        }
        this.persistRecord({
            groupId,
            roomKeyHex: newKeyHex,
            previousKeys,
            createdAt: Date.now(),
        });
    }

    async getRoomKeyRecord(groupId: string): Promise<RoomKeyRecord | null> {
        this.ensureCacheHydrated();
        return this.cache.get(groupId) ?? null;
    }

    async getRoomKey(groupId: string): Promise<string | null> {
        const record = await this.getRoomKeyRecord(groupId);
        return record?.roomKeyHex?.trim() || null;
    }

    async listRoomKeyRecords(): Promise<ReadonlyArray<RoomKeyRecord>> {
        this.ensureCacheHydrated();
        return [...this.cache.values()];
    }

    async upsertRoomKeyRecord(incoming: RoomKeyRecord): Promise<void> {
        if (!incoming.groupId || !incoming.roomKeyHex) {
            return;
        }
        const normalizedIncoming: RoomKeyRecord = {
            groupId: incoming.groupId,
            roomKeyHex: incoming.roomKeyHex,
            previousKeys: uniqueNonEmptyKeys(incoming.previousKeys ?? []).filter((key) => key !== incoming.roomKeyHex),
            createdAt: Number.isFinite(incoming.createdAt) && incoming.createdAt > 0
                ? incoming.createdAt
                : Date.now(),
        };

        const existing = await this.getRoomKeyRecord(normalizedIncoming.groupId);
        if (!existing) {
            this.persistRecord(normalizedIncoming);
            return;
        }

        const incomingWins = normalizedIncoming.createdAt >= (existing.createdAt || 0);
        const latest = incomingWins ? normalizedIncoming : existing;
        const older = incomingWins ? existing : normalizedIncoming;
        const mergedPrevious = uniqueNonEmptyKeys([
            ...(latest.previousKeys ?? []),
            ...(older.previousKeys ?? []),
            older.roomKeyHex,
        ]).filter((key) => key !== latest.roomKeyHex);

        this.persistRecord({
            groupId: latest.groupId,
            roomKeyHex: latest.roomKeyHex,
            createdAt: Number.isFinite(latest.createdAt) && latest.createdAt > 0
                ? latest.createdAt
                : Date.now(),
            ...(mergedPrevious.length > 0 ? { previousKeys: mergedPrevious } : {}),
        });
    }

    async deleteRoomKey(groupId: string): Promise<void> {
        this.ensureCacheHydrated();
        this.cache.delete(groupId);
        const persisted = readPersistedMap();
        persisted.delete(groupId);
        writePersistedMap(persisted);
    }

    async clearAll(): Promise<void> {
        this.cache.clear();
        if (typeof window !== "undefined") {
            try {
                window.localStorage.removeItem(profileStorageKey());
            } catch {
                // ignore
            }
        }
    }
}

export const roomKeyStore = new RoomKeyStore();
