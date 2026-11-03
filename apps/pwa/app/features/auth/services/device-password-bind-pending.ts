/**
 * Single-door Slice A: after Advanced key unlock, native PDK may still be closed.
 * AuthGateway must keep Auth mounted so the user can bind a device password
 * without dropping into soft-lock LockScreen as a second product.
 */

let devicePasswordBindPending = false;
const listeners = new Set<() => void>();

const notifyDevicePasswordBindPendingListeners = (): void => {
  for (const listener of listeners) {
    listener();
  }
};

export const setDevicePasswordBindPending = (pending: boolean): void => {
  if (devicePasswordBindPending === pending) {
    return;
  }
  devicePasswordBindPending = pending;
  notifyDevicePasswordBindPendingListeners();
};

export const isDevicePasswordBindPending = (): boolean => devicePasswordBindPending;

export const subscribeDevicePasswordBindPending = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Test helper — reset between cases. */
export const resetDevicePasswordBindPendingForTests = (): void => {
  devicePasswordBindPending = false;
  notifyDevicePasswordBindPendingListeners();
};
