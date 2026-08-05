// Simple singleton store for managing native errors outside of React lifecycle
// Requirement: 79, 83
// R1 / R1.1: soft relay coalesce + UI throttle
// R1.2: dismiss snooze — user X suppresses soft relay toast for a period

export interface NativeError {
    id: string;
    code: string;
    message: string;
    /** Optional technical detail (probe / IO) — not shown as the primary line. */
    detail?: string;
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

/** Soft relay connect/init — one card for the pool, not one per host flap. */
export const softRelayToastCoalesceKey = (code: string): string | null => {
    if (code === "RELAY_CONNECT_FAILED" || code === "RELAY_INIT_FAILED") {
        return "RELAY_SOFT_CONNECT";
    }
    return null;
};

export const shouldNotifySoftRelayToastUi = (params: Readonly<{
    nowMs: number;
    lastUiNotifyAtMs: number | undefined;
    throttleMs: number;
}>): boolean => {
    if (typeof params.lastUiNotifyAtMs !== "number") {
        return true;
    }
    return (params.nowMs - params.lastUiNotifyAtMs) >= params.throttleMs;
};

/** Soft relay toast UI re-paint interval — host flaps must not flash every few seconds. */
export const RELAY_UI_NOTIFY_THROTTLE_MS = 45_000;

/** After user dismisses soft relay toast, suppress reappearance (DMs may still work). */
export const RELAY_SOFT_DISMISS_SNOOZE_MS = 15 * 60_000;

export const isSoftRelaySnoozed = (params: Readonly<{
    nowMs: number;
    snoozeUntilMs: number | undefined;
}>): boolean => (
    typeof params.snoozeUntilMs === "number" && params.nowMs < params.snoozeUntilMs
);

class NativeErrorStore {
    private errors: NativeError[] = [];
    private listeners: Set<Listener> = new Set();
    private lastUiNotifyAtByKey = new Map<string, number>();
    private softSnoozeUntilByKey = new Map<string, number>();
    private static readonly DEDUPE_WINDOW_MS = 60_000;
    private static readonly MAX_VISIBLE_ERRORS = 6;

    private toDedupeKey(error: Readonly<{ code: string; message: string }>): string {
        const softKey = softRelayToastCoalesceKey(error.code);
        if (softKey) {
            return softKey;
        }
        return `${error.code}:${error.message.trim()}`;
    }

    public addError(error: Readonly<{
        code: string;
        message: string;
        detail?: string;
        retry?: () => Promise<void>;
        retryable: boolean;
    }>): string {
        const now = Date.now();
        const dedupeKey = this.toDedupeKey(error);
        const softCoalesce = softRelayToastCoalesceKey(error.code) !== null;

        if (
            softCoalesce
            && isSoftRelaySnoozed({
                nowMs: now,
                snoozeUntilMs: this.softSnoozeUntilByKey.get(dedupeKey),
            })
        ) {
            return "";
        }

        const existingIndex = this.errors.findIndex((candidate) => {
            if (candidate.dedupeKey !== dedupeKey) {
                return false;
            }
            if (softCoalesce) {
                return true;
            }
            return (now - candidate.lastOccurredAt) <= NativeErrorStore.DEDUPE_WINDOW_MS;
        });
        if (existingIndex >= 0) {
            const existing = this.errors[existingIndex];
            const merged: NativeError = {
                ...existing,
                code: error.code,
                message: error.message,
                detail: error.detail ?? existing.detail,
                retry: error.retry,
                retryable: error.retryable,
                occurrenceCount: existing.occurrenceCount + 1,
                lastOccurredAt: now,
            };
            const withoutExisting = this.errors.filter((_, index) => index !== existingIndex);
            this.errors = [merged, ...withoutExisting];

            const shouldNotify = softCoalesce
                ? shouldNotifySoftRelayToastUi({
                    nowMs: now,
                    lastUiNotifyAtMs: this.lastUiNotifyAtByKey.get(dedupeKey),
                    throttleMs: RELAY_UI_NOTIFY_THROTTLE_MS,
                })
                : true;
            if (shouldNotify) {
                this.lastUiNotifyAtByKey.set(dedupeKey, now);
                this.notify();
            }
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
        this.lastUiNotifyAtByKey.set(dedupeKey, now);
        this.notify();
        return newError.id;
    }

    public removeError(id: string) {
        const removed = this.errors.find((error) => error.id === id);
        this.errors = this.errors.filter((entry) => entry.id !== id);
        if (removed) {
            this.lastUiNotifyAtByKey.delete(removed.dedupeKey);
        }
        this.notify();
    }

    /**
     * User dismiss (X). Soft relay warnings stay suppressed for
     * {@link RELAY_SOFT_DISMISS_SNOOZE_MS} so unstable public relays do not nag
     * while the pool can still deliver.
     */
    public dismissError(id: string) {
        const removed = this.errors.find((error) => error.id === id);
        this.errors = this.errors.filter((entry) => entry.id !== id);
        if (removed) {
            this.lastUiNotifyAtByKey.delete(removed.dedupeKey);
            if (softRelayToastCoalesceKey(removed.code)) {
                this.softSnoozeUntilByKey.set(
                    removed.dedupeKey,
                    Date.now() + RELAY_SOFT_DISMISS_SNOOZE_MS,
                );
            }
        }
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
        this.listeners.forEach((listener) => listener(this.errors));
    }
}

export const nativeErrorStore = new NativeErrorStore();
