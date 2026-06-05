import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useShellTransportReady } from "./use-shell-transport-ready";

const supervisorMocks = vi.hoisted(() => {
  let phase = "auth_required";
  const listeners = new Set<() => void>();
  return {
    getPhase: () => phase,
    setPhase: (next: string) => {
      phase = next;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot: () => ({ phase }),
  };
});

vi.mock("./services/window-runtime-supervisor", () => ({
  windowRuntimeSupervisor: {
    subscribe: supervisorMocks.subscribe,
    getSnapshot: supervisorMocks.getSnapshot,
  },
}));

describe("useShellTransportReady", () => {
  it("returns true only for ready or degraded shell phases", () => {
    supervisorMocks.setPhase("auth_required");
    const { result, rerender } = renderHook(() => useShellTransportReady());
    expect(result.current).toBe(false);

    act(() => {
      supervisorMocks.setPhase("ready");
    });
    rerender();
    expect(result.current).toBe(true);

    act(() => {
      supervisorMocks.setPhase("degraded");
    });
    rerender();
    expect(result.current).toBe(true);

    act(() => {
      supervisorMocks.setPhase("activating_runtime");
    });
    rerender();
    expect(result.current).toBe(false);
  });
});
