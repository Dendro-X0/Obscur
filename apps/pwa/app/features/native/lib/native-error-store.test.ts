import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  nativeErrorStore,
  RELAY_SOFT_DISMISS_SNOOZE_MS,
  RELAY_UI_NOTIFY_THROTTLE_MS,
  shouldNotifySoftRelayToastUi,
  softRelayToastCoalesceKey,
} from "./native-error-store";

const clearStore = (): void => {
  nativeErrorStore.getErrors().forEach((error) => {
    nativeErrorStore.removeError(error.id);
  });
};

describe("softRelayToastCoalesceKey / shouldNotifySoftRelayToastUi", () => {
  it("maps connect and init into one soft coalesce family", () => {
    expect(softRelayToastCoalesceKey("RELAY_CONNECT_FAILED")).toBe("RELAY_SOFT_CONNECT");
    expect(softRelayToastCoalesceKey("RELAY_INIT_FAILED")).toBe("RELAY_SOFT_CONNECT");
    expect(softRelayToastCoalesceKey("RELAY_SEND_FAILED")).toBeNull();
  });

  it("throttles UI notify by interval only (host flaps do not force paint)", () => {
    expect(RELAY_UI_NOTIFY_THROTTLE_MS).toBe(90_000);
    expect(shouldNotifySoftRelayToastUi({
      nowMs: 10_000,
      lastUiNotifyAtMs: 5_000,
      throttleMs: 45_000,
    })).toBe(false);
    expect(shouldNotifySoftRelayToastUi({
      nowMs: 50_000,
      lastUiNotifyAtMs: 5_000,
      throttleMs: 45_000,
    })).toBe(true);
  });
});

describe("native-error-store", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-18T00:00:00.000Z"));
    clearStore();
  });

  afterEach(() => {
    vi.useRealTimers();
    clearStore();
  });

  it("dedupes repeated RELAY_CONNECT_FAILED incidents into one entry", () => {
    nativeErrorStore.addError({
      code: "RELAY_CONNECT_FAILED",
      message: "Couldn't reach relay A.",
      retryable: true,
    });
    vi.advanceTimersByTime(2_000);
    nativeErrorStore.addError({
      code: "RELAY_CONNECT_FAILED",
      message: "Couldn't reach relay B.",
      detail: "probe B",
      retryable: true,
    });

    const errors = nativeErrorStore.getErrors();
    expect(errors).toHaveLength(1);
    expect(errors[0]?.occurrenceCount).toBe(2);
    expect(errors[0]?.message).toBe("Couldn't reach relay B.");
    expect(errors[0]?.detail).toBe("probe B");
    expect(errors[0]?.dedupeKey).toBe("RELAY_SOFT_CONNECT");
  });

  it("coalesces RELAY_INIT_FAILED with RELAY_CONNECT_FAILED", () => {
    nativeErrorStore.addError({
      code: "RELAY_CONNECT_FAILED",
      message: "Couldn't reach nos.lol.",
      retryable: true,
    });
    nativeErrorStore.addError({
      code: "RELAY_INIT_FAILED",
      message: "Failed to initialize relay connection to wss://relay.damus.io",
      retryable: true,
    });

    const errors = nativeErrorStore.getErrors();
    expect(errors).toHaveLength(1);
    expect(errors[0]?.occurrenceCount).toBe(2);
    expect(errors[0]?.code).toBe("RELAY_INIT_FAILED");
  });

  it("keeps a single soft-connect card even outside the soft dedupe window", () => {
    nativeErrorStore.addError({
      code: "RELAY_CONNECT_FAILED",
      message: "first failure",
      retryable: true,
    });
    vi.advanceTimersByTime(61_000);
    nativeErrorStore.addError({
      code: "RELAY_CONNECT_FAILED",
      message: "second failure",
      retryable: true,
    });

    const errors = nativeErrorStore.getErrors();
    expect(errors).toHaveLength(1);
    expect(errors[0]?.occurrenceCount).toBe(2);
    expect(errors[0]?.message).toBe("second failure");
  });

  it("R1.1: throttles UI notify on soft-connect bumps for full throttle window", () => {
    const listener = vi.fn();
    const unsubscribe = nativeErrorStore.subscribe(listener);

    nativeErrorStore.addError({
      code: "RELAY_CONNECT_FAILED",
      message: "Couldn't reach relay.damus.io.",
      retryable: true,
    });
    expect(listener).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1_000);
    nativeErrorStore.addError({
      code: "RELAY_CONNECT_FAILED",
      message: "Couldn't reach relay.damus.io.",
      retryable: true,
    });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(nativeErrorStore.getErrors()[0]?.occurrenceCount).toBe(2);

    vi.advanceTimersByTime(RELAY_UI_NOTIFY_THROTTLE_MS);
    nativeErrorStore.addError({
      code: "RELAY_CONNECT_FAILED",
      message: "Couldn't reach relay.damus.io.",
      retryable: true,
    });
    expect(listener).toHaveBeenCalledTimes(2);
    expect(nativeErrorStore.getErrors()[0]?.occurrenceCount).toBe(3);

    unsubscribe();
  });

  it("R1.1: host message changes do not force immediate UI notify", () => {
    const listener = vi.fn();
    const unsubscribe = nativeErrorStore.subscribe(listener);

    nativeErrorStore.addError({
      code: "RELAY_CONNECT_FAILED",
      message: "Couldn't reach nos.lol.",
      retryable: true,
    });
    vi.advanceTimersByTime(500);
    nativeErrorStore.addError({
      code: "RELAY_CONNECT_FAILED",
      message: "Couldn't reach relay.damus.io.",
      retryable: true,
    });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(nativeErrorStore.getErrors()[0]?.message).toBe("Couldn't reach relay.damus.io.");
    expect(nativeErrorStore.getErrors()[0]?.occurrenceCount).toBe(2);
    unsubscribe();
  });

  it("R1.2: dismiss snoozes soft relay toast for the snooze window", () => {
    const listener = vi.fn();
    const unsubscribe = nativeErrorStore.subscribe(listener);

    const id = nativeErrorStore.addError({
      code: "RELAY_CONNECT_FAILED",
      message: "Couldn't reach relay.primal.net.",
      retryable: true,
    });
    expect(nativeErrorStore.getErrors()).toHaveLength(1);
    nativeErrorStore.dismissError(id);
    expect(nativeErrorStore.getErrors()).toHaveLength(0);

    vi.advanceTimersByTime(1_000);
    nativeErrorStore.addError({
      code: "RELAY_CONNECT_FAILED",
      message: "Couldn't reach relay.primal.net.",
      retryable: true,
    });
    expect(nativeErrorStore.getErrors()).toHaveLength(0);

    vi.advanceTimersByTime(RELAY_SOFT_DISMISS_SNOOZE_MS);
    nativeErrorStore.addError({
      code: "RELAY_CONNECT_FAILED",
      message: "Couldn't reach relay.primal.net.",
      retryable: true,
    });
    expect(nativeErrorStore.getErrors()).toHaveLength(1);
    unsubscribe();
  });

  it("caps visible errors to avoid unbounded flood", () => {
    for (let index = 0; index < 10; index += 1) {
      nativeErrorStore.addError({
        code: `CODE_${index}`,
        message: `message_${index}`,
        retryable: false,
      });
    }

    const errors = nativeErrorStore.getErrors();
    expect(errors).toHaveLength(6);
    expect(errors[0]?.code).toBe("CODE_9");
    expect(errors[5]?.code).toBe("CODE_4");
  });
});
