import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

const PROFILE_ID = "default";
const ACCOUNT_PUBKEY = "a".repeat(64) as PublicKeyHex;
const ACCOUNT_PRIVKEY = "b".repeat(64) as PrivateKeyHex;

const createPoolStub = () => ({
  connections: [],
  waitForConnection: async () => false,
  sendToOpen: () => {},
  subscribeToMessages: () => () => {},
});

function makeSnapshot(overrides: Record<string, unknown> = {}) {
  return {
  profileId: null,
  accountPublicKeyHex: null,
  projection: null,
  phase: "idle",
  status: "pending",
  accountProjectionReady: false,
  driftStatus: "unknown",
  updatedAtUnixMs: Date.now(),
  ...overrides,
  };
}

const mocks = vi.hoisted(() => ({
  snapshot: makeSnapshot(),
  bootstrapAndReplay: vi.fn(),
  reset: vi.fn(),
}));

vi.mock("@/app/features/profiles/services/profile-scope", () => ({
  getActiveProfileIdSafe: () => PROFILE_ID,
}));

vi.mock("../services/account-projection-runtime", () => ({
  accountProjectionRuntime: {
    subscribe: () => () => {},
    getSnapshot: () => mocks.snapshot,
    bootstrapAndReplay: mocks.bootstrapAndReplay,
    reset: mocks.reset,
  },
}));

import { useAccountProjectionRuntime } from "./use-account-projection-runtime";

describe("useAccountProjectionRuntime", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.snapshot = makeSnapshot();
  });

  it("resets projection runtime when identity is unavailable", () => {
    renderHook(() => useAccountProjectionRuntime({
      publicKeyHex: null,
      privateKeyHex: null,
      pool: createPoolStub(),
    }));
    expect(mocks.reset).toHaveBeenCalledTimes(1);
    expect(mocks.bootstrapAndReplay).not.toHaveBeenCalled();
  });

  it("does not re-bootstrap when active account snapshot is already ready", () => {
    mocks.snapshot = makeSnapshot({
      profileId: PROFILE_ID,
      accountPublicKeyHex: ACCOUNT_PUBKEY,
      phase: "ready",
      status: "ready",
      accountProjectionReady: true,
      driftStatus: "clean",
    });

    const { rerender } = renderHook(
      ({ poolRef }) => useAccountProjectionRuntime({
        publicKeyHex: ACCOUNT_PUBKEY,
        privateKeyHex: ACCOUNT_PRIVKEY,
        pool: poolRef,
      }),
      {
        initialProps: {
          poolRef: createPoolStub(),
        },
      }
    );

    rerender({
      poolRef: createPoolStub(),
    });

    expect(mocks.bootstrapAndReplay).not.toHaveBeenCalled();
  });

  it("does not re-bootstrap while active account replay is already in progress", () => {
    mocks.snapshot = makeSnapshot({
      profileId: PROFILE_ID,
      accountPublicKeyHex: ACCOUNT_PUBKEY,
      phase: "replaying_event_log",
      status: "pending",
      accountProjectionReady: false,
      driftStatus: "unknown",
    });

    renderHook(() => useAccountProjectionRuntime({
      publicKeyHex: ACCOUNT_PUBKEY,
      privateKeyHex: ACCOUNT_PRIVKEY,
      pool: createPoolStub(),
    }));

    expect(mocks.bootstrapAndReplay).not.toHaveBeenCalled();
  });

  it("bootstraps when snapshot is not ready for the active account", () => {
    mocks.snapshot = makeSnapshot({
      profileId: PROFILE_ID,
      accountPublicKeyHex: ACCOUNT_PUBKEY,
      phase: "degraded",
      status: "degraded",
      accountProjectionReady: false,
    });

    renderHook(() => useAccountProjectionRuntime({
      publicKeyHex: ACCOUNT_PUBKEY,
      privateKeyHex: ACCOUNT_PRIVKEY,
      pool: createPoolStub(),
    }));

    expect(mocks.bootstrapAndReplay).toHaveBeenCalledTimes(1);
    expect(mocks.bootstrapAndReplay).toHaveBeenCalledWith({
      profileId: PROFILE_ID,
      accountPublicKeyHex: ACCOUNT_PUBKEY,
      privateKeyHex: ACCOUNT_PRIVKEY,
      pool: expect.objectContaining({
        sendToOpen: expect.any(Function),
        subscribeToMessages: expect.any(Function),
      }),
    });
  });

  it("resets stale snapshot ownership before re-bootstrapping a different account", () => {
    mocks.snapshot = makeSnapshot({
      profileId: PROFILE_ID,
      accountPublicKeyHex: "c".repeat(64),
      phase: "ready",
      status: "ready",
      accountProjectionReady: true,
      driftStatus: "clean",
    });

    renderHook(() => useAccountProjectionRuntime({
      publicKeyHex: ACCOUNT_PUBKEY,
      privateKeyHex: ACCOUNT_PRIVKEY,
      pool: createPoolStub(),
    }));

    expect(mocks.reset).toHaveBeenCalledTimes(1);
    expect(mocks.bootstrapAndReplay).not.toHaveBeenCalled();
  });
});
