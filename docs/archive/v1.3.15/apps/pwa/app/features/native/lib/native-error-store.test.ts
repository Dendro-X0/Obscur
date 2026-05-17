import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { nativeErrorStore } from "./native-error-store";

const clearStore = (): void => {
  nativeErrorStore.getErrors().forEach((error) => {
    nativeErrorStore.removeError(error.id);
  });
};

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
      message: "failed to connect relay A",
      retryable: true,
    });
    vi.advanceTimersByTime(2_000);
    nativeErrorStore.addError({
      code: "RELAY_CONNECT_FAILED",
      message: "failed to connect relay B",
      retryable: true,
    });

    const errors = nativeErrorStore.getErrors();
    expect(errors).toHaveLength(1);
    expect(errors[0]?.occurrenceCount).toBe(2);
    expect(errors[0]?.message).toBe("failed to connect relay B");
  });

  it("does not dedupe relay incidents outside the dedupe window", () => {
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
    expect(errors).toHaveLength(2);
    expect(errors[0]?.occurrenceCount).toBe(1);
    expect(errors[1]?.occurrenceCount).toBe(1);
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
