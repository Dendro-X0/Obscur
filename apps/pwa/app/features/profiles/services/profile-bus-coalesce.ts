/**
 * Merge duplicate publishes in the same turn (e.g. profile bus + legacy window dispatch).
 */
export function createMicrotaskCoalescedHandler(fn: () => void): () => void {
    let scheduled = false;
    return (): void => {
        if (scheduled) {
            return;
        }
        scheduled = true;
        queueMicrotask(() => {
            scheduled = false;
            fn();
        });
    };
}
