import { hasNativeRuntime } from "./runtime-capabilities";

export type NativeEventUnlisten = () => void;
type NativeEventHandler<TPayload> = (event: { payload?: TPayload }) => void;

type NativeEventRegistryEntry = Readonly<{
  handlers: Set<(event: { payload?: unknown }) => void>;
  ensureListener: () => Promise<void>;
  detachNativeListener: () => Promise<void>;
}>;

const registry = new Map<string, NativeEventRegistryEntry>();
let beforeUnloadCleanupRegistered = false;

const createRegistryEntry = (eventName: string): NativeEventRegistryEntry => {
  const handlers = new Set<(event: { payload?: unknown }) => void>();
  let nativeUnlisten: NativeEventUnlisten | null = null;
  let listenPromise: Promise<void> | null = null;

  const dispatch = (event: { payload?: unknown }): void => {
    const snapshot = Array.from(handlers);
    snapshot.forEach((handler) => {
      try {
        handler(event);
      } catch {
        // Keep the event fan-out alive even when one handler throws.
      }
    });
  };

  const ensureListener = async (): Promise<void> => {
    if (nativeUnlisten) {
      return;
    }
    if (listenPromise) {
      await listenPromise;
      return;
    }
    listenPromise = (async () => {
      try {
        const { listen } = await import("@tauri-apps/api/event");
        nativeUnlisten = await listen(eventName, (event) => dispatch(event as { payload?: unknown }));
      } catch {
        nativeUnlisten = null;
      } finally {
        listenPromise = null;
      }
    })();
    await listenPromise;
  };

  const detachNativeListener = async (): Promise<void> => {
    if (listenPromise) {
      await listenPromise;
    }
    if (!nativeUnlisten) {
      return;
    }
    try {
      nativeUnlisten();
    } catch {
      // Best-effort cleanup only.
    }
    nativeUnlisten = null;
  };

  return {
    handlers,
    ensureListener,
    detachNativeListener,
  };
};

const getOrCreateEntry = (eventName: string): NativeEventRegistryEntry => {
  const existing = registry.get(eventName);
  if (existing) {
    return existing;
  }
  const created = createRegistryEntry(eventName);
  registry.set(eventName, created);
  return created;
};

export const listenToNativeEvent = async <TPayload>(
  eventName: string,
  handler: NativeEventHandler<TPayload>
): Promise<NativeEventUnlisten> => {
  if (!hasNativeRuntime()) {
    return () => undefined;
  }

  if (!beforeUnloadCleanupRegistered && typeof window !== "undefined" && typeof window.addEventListener === "function") {
    beforeUnloadCleanupRegistered = true;
    window.addEventListener(
      "beforeunload",
      () => {
        registry.forEach((entry) => {
          void entry.detachNativeListener();
        });
        registry.clear();
      },
      { once: true }
    );
  }

  const entry = getOrCreateEntry(eventName);
  const wrapped = handler as (event: { payload?: unknown }) => void;
  entry.handlers.add(wrapped);
  await entry.ensureListener();

  let active = true;
  return () => {
    if (!active) {
      return;
    }
    active = false;
    entry.handlers.delete(wrapped);
    // Intentionally keep native listener attached for the window lifetime.
    // This avoids callback-id churn under rapid relay instance reconnects.
    if (entry.handlers.size === 0) {
      return;
    }
  };
};

export const nativeEventAdapterInternals = {
  resetForTests: (): void => {
    registry.clear();
    beforeUnloadCleanupRegistered = false;
  },
  getRegistrySize: (): number => registry.size,
  getListenerCount: (eventName: string): number => registry.get(eventName)?.handlers.size ?? 0,
};
