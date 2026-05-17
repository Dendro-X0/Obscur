// Simple singleton store for managing native errors outside of React lifecycle
// Requirement: 79, 83

export interface NativeError {
    id: string;
    code: string;
    message: string;
    timestamp: number;
    lastOccurredAt: number;
    occurrenceCount: number;
    dedupeKey: string;
    retry?: () => Promise<void>;
    retryable: boolean;
}

type Listener = (errors: NativeError[]) => void;

const createNativeErrorId = (): string => {
    const hasRandomUuid = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function";
    if (hasRandomUuid) {
        return crypto.randomUUID();
    }
    return `native-error-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

class NativeErrorStore {
    private errors: NativeError[] = [];
    private listeners: Set<Listener> = new Set();
    private static readonly DEDUPE_WINDOW_MS = 60_000;
    private static readonly MAX_VISIBLE_ERRORS = 6;

    private toDedupeKey(error: Readonly<{ code: string; message: string }>): string {
        if (error.code === "RELAY_CONNECT_FAILED") {
            // Collapse relay storm into one actionable incident.
            return error.code;
        }
        return `${error.code}:${error.message.trim()}`;
    }

    public addError(error: Readonly<{
        code: string;
        message: string;
        retry?: () => Promise<void>;
        retryable: boolean;
    }>) {
        const now = Date.now();
        const dedupeKey = this.toDedupeKey(error);
        const existingIndex = this.errors.findIndex((candidate) => (
            candidate.dedupeKey === dedupeKey
            && (now - candidate.lastOccurredAt) <= NativeErrorStore.DEDUPE_WINDOW_MS
        ));
        if (existingIndex >= 0) {
            const existing = this.errors[existingIndex];
            const merged: NativeError = {
                ...existing,
                message: error.message,
                retry: error.retry,
                retryable: error.retryable,
                occurrenceCount: existing.occurrenceCount + 1,
                lastOccurredAt: now,
            };
            const withoutExisting = this.errors.filter((_, index) => index !== existingIndex);
            this.errors = [merged, ...withoutExisting];
            this.notify();
            return merged.id;
        }
        const newError: NativeError = {
            ...error,
            id: createNativeErrorId(),
            timestamp: now,
            lastOccurredAt: now,
            occurrenceCount: 1,
            dedupeKey,
        };
        this.errors = [newError, ...this.errors].slice(0, NativeErrorStore.MAX_VISIBLE_ERRORS);
        this.notify();
        return newError.id;
    }

    public removeError(id: string) {
        this.errors = this.errors.filter(e => e.id !== id);
        this.notify();
    }

    public getErrors() {
        return this.errors;
    }

    public subscribe(listener: Listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notify() {
        this.listeners.forEach(listener => listener(this.errors));
    }
}

export const nativeErrorStore = new NativeErrorStore();
