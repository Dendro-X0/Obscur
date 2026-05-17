import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const runtimeMocks = vi.hoisted(() => ({
  hasNativeRuntime: vi.fn(),
}));

const invokeMocks = vi.hoisted(() => ({
  invoke: vi.fn(),
}));

vi.mock("./runtime-capabilities", () => ({
  hasNativeRuntime: runtimeMocks.hasNativeRuntime,
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMocks.invoke,
}));

import { invokeNativeCommand } from "./native-adapters";

describe("native-adapters", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns unsupported when runtime is not native", async () => {
    runtimeMocks.hasNativeRuntime.mockReturnValue(false);

    const result = await invokeNativeCommand("probe_command", { value: 1 });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected unsupported result");
    }
    expect(result.reason).toBe("unsupported");
    expect(invokeMocks.invoke).not.toHaveBeenCalled();
  });

  it("invokes native command when runtime is native", async () => {
    runtimeMocks.hasNativeRuntime.mockReturnValue(true);
    invokeMocks.invoke.mockResolvedValue({ ok: true });

    const result = await invokeNativeCommand<{ ok: true }>("probe_command", { value: 2 });

    expect(invokeMocks.invoke).toHaveBeenCalledWith("probe_command", { value: 2 });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error("expected ok result");
    }
    expect(result.value).toEqual({ ok: true });
  });

  it("returns failed when native invoke throws", async () => {
    runtimeMocks.hasNativeRuntime.mockReturnValue(true);
    invokeMocks.invoke.mockRejectedValue(new Error("bridge exploded"));

    const result = await invokeNativeCommand("probe_command");

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected failed result");
    }
    expect(result.reason).toBe("failed");
    expect(result.message).toContain("bridge exploded");
  });

  it("returns failed when native invoke times out", async () => {
    runtimeMocks.hasNativeRuntime.mockReturnValue(true);
    invokeMocks.invoke.mockImplementation(
      () => new Promise(() => undefined)
    );

    const result = await invokeNativeCommand("slow_command", undefined, { timeoutMs: 5 });

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected failed result");
    }
    expect(result.reason).toBe("failed");
    expect(result.message).toContain("timed out");
  });

  it("enforces minimum timeout for profile bootstrap command", async () => {
    vi.useFakeTimers();
    runtimeMocks.hasNativeRuntime.mockReturnValue(true);
    invokeMocks.invoke.mockImplementation(() => new Promise(() => undefined));

    const resultPromise = invokeNativeCommand("desktop_get_profile_isolation_snapshot", undefined, { timeoutMs: 5 });

    await vi.advanceTimersByTimeAsync(6);
    let settled = false;
    void resultPromise.finally(() => {
      settled = true;
    });
    await Promise.resolve();

    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(25_000);
    const result = await resultPromise;

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected failed result");
    }
    expect(result.message).toContain("25000ms");
  });
});
