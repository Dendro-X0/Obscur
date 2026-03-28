
type NowMsListener = () => void;

type NowMsClockState = {
    listeners: Set<NowMsListener>;
    snapshot: number | null;
    intervalId: ReturnType<typeof setInterval> | null;
};

const NOW_MS_CLOCK_GLOBAL_KEY = "__obscur_now_ms_clock_v1";
const NOW_MS_INTERVAL_MS = 30_000;

const readClockState = (): NowMsClockState => {
    const globalScope = globalThis as typeof globalThis & Record<string, unknown>;
    const existing = globalScope[NOW_MS_CLOCK_GLOBAL_KEY];
    if (existing && typeof existing === "object") {
        return existing as NowMsClockState;
    }
    const created: NowMsClockState = {
        listeners: new Set<NowMsListener>(),
        snapshot: null,
        intervalId: null,
    };
    globalScope[NOW_MS_CLOCK_GLOBAL_KEY] = created;
    return created;
};

const startClockIfNeeded = (state: NowMsClockState): void => {
    if (state.intervalId !== null) {
        return;
    }
    state.snapshot = Date.now();
    state.intervalId = setInterval((): void => {
        state.snapshot = Date.now();
        state.listeners.forEach((nextListener: NowMsListener): void => {
            nextListener();
        });
    }, NOW_MS_INTERVAL_MS);
};

const stopClockIfUnused = (state: NowMsClockState): void => {
    if (state.listeners.size > 0) {
        return;
    }
    if (state.intervalId !== null) {
        clearInterval(state.intervalId);
        state.intervalId = null;
    }
    state.snapshot = null;
};

const enqueueListenerNotification = (listener: NowMsListener, state: NowMsClockState): void => {
    const notify = (): void => {
        if (!state.listeners.has(listener)) {
            return;
        }
        listener();
    };
    if (typeof queueMicrotask === "function") {
        queueMicrotask(notify);
        return;
    }
    Promise.resolve().then(notify);
};

export const subscribeNowMs = (listener: NowMsListener): (() => void) => {
    const state = readClockState();
    state.listeners.add(listener);
    startClockIfNeeded(state);
    enqueueListenerNotification(listener, state);
    return (): void => {
        const current = readClockState();
        current.listeners.delete(listener);
        stopClockIfUnused(current);
    };
};

export const getNowMsSnapshot = (): number | null => readClockState().snapshot;

export const getNowMsServerSnapshot = (): number | null => null;

export const nowMsInternalsForTests = {
    reset(): void {
        const state = readClockState();
        state.listeners.clear();
        if (state.intervalId !== null) {
            clearInterval(state.intervalId);
            state.intervalId = null;
        }
        state.snapshot = null;
    },
    getState(): Readonly<{
        listenerCount: number;
        hasInterval: boolean;
        snapshot: number | null;
    }> {
        const state = readClockState();
        return {
            listenerCount: state.listeners.size,
            hasInterval: state.intervalId !== null,
            snapshot: state.snapshot,
        };
    },
};
