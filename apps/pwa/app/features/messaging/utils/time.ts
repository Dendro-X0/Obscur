
type NowMsListener = () => void;

const nowMsListeners: Set<NowMsListener> = new Set<NowMsListener>();

let nowMsSnapshot: number | null = null;

let isNowMsScheduled: boolean = false;

export const subscribeNowMs = (listener: NowMsListener): (() => void) => {
    nowMsListeners.add(listener);
    if (!isNowMsScheduled) {
        isNowMsScheduled = true;
        queueMicrotask((): void => {
            nowMsSnapshot = Date.now();
            nowMsListeners.forEach((nextListener: NowMsListener): void => {
                nextListener();
            });
        });
    }
    return (): void => {
        nowMsListeners.delete(listener);
    };
};

export const getNowMsSnapshot = (): number | null => nowMsSnapshot;

export const getNowMsServerSnapshot = (): number | null => null;
