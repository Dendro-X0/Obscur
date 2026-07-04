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

const identityMocks = vi.hoisted(() => ({
  status: "locked" as "locked" | "unlocked",
}));

const policyMocks = vi.hoisted(() => ({
  enabled: false,
}));

vi.mock("@/app/features/auth/hooks/use-identity", () => ({
  getIdentitySnapshot: () => ({ status: identityMocks.status }),
  subscribeIdentityStore: (listener: () => void) => {
    const handler = (): void => listener();
    return () => {
      void handler;
    };
  },
}));

vi.mock("./runtime-transport-owner-policy", () => ({
  isRuntimeTransportOwnerEnabled: () => policyMocks.enabled,
}));

vi.mock("./services/window-runtime-supervisor", () => ({
  windowRuntimeSupervisor: {
    subscribe: supervisorMocks.subscribe,
    getSnapshot: supervisorMocks.getSnapshot,
  },
}));

describe("useShellTransportReady", () => {
  it("returns true for activating_runtime, ready, or degraded shell phases", () => {
    identityMocks.status = "locked";
    policyMocks.enabled = false;
    supervisorMocks.setPhase("auth_required");
    const { result, rerender } = renderHook(() => useShellTransportReady());
    expect(result.current).toBe(false);

    act(() => {
      supervisorMocks.setPhase("activating_runtime");
    });
    policyMocks.enabled = true;
    rerender();
    expect(result.current).toBe(true);

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
      supervisorMocks.setPhase("unlocking");
    });
    policyMocks.enabled = false;
    rerender();
    expect(result.current).toBe(false);
  });

  it("returns true when runtime transport owner policy enables unlocked shell", () => {
    policyMocks.enabled = true;
    supervisorMocks.setPhase("auth_required");
    const { result } = renderHook(() => useShellTransportReady());
    expect(result.current).toBe(true);
  });
});
