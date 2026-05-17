import { renderHook, act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { useInviteRedemption } from "./use-invite-redemption";

const mocks = vi.hoisted(() => ({
  routerReplace: vi.fn(),
  addRelay: vi.fn(),
  setNewChatPubkey: vi.fn(),
  setNewChatDisplayName: vi.fn(),
  setIsNewChatOpen: vi.fn(),
  toastInfo: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  toastWarning: vi.fn(),
  sendRequest: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: mocks.routerReplace,
  }),
}));

vi.mock("@/app/features/auth/hooks/use-identity", () => ({
  useIdentity: () => ({
    state: {
      publicKeyHex: "a".repeat(64),
    },
  }),
}));

vi.mock("@/app/features/relays/hooks/use-relay-list", () => ({
  useRelayList: () => ({
    addRelay: mocks.addRelay,
  }),
}));

vi.mock("@/app/features/messaging/providers/messaging-provider", () => ({
  useMessaging: () => ({
    setNewChatPubkey: mocks.setNewChatPubkey,
    setNewChatDisplayName: mocks.setNewChatDisplayName,
    setIsNewChatOpen: mocks.setIsNewChatOpen,
  }),
}));

vi.mock("@/app/shared/log-app-event", () => ({
  logAppEvent: vi.fn(),
}));

vi.mock("@dweb/ui-kit", () => ({
  toast: {
    info: mocks.toastInfo,
    success: mocks.toastSuccess,
    error: mocks.toastError,
    warning: mocks.toastWarning,
  },
}));

describe("useInviteRedemption", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    global.fetch = vi.fn(async () =>
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            inviteId: "invite-1",
            inviterPubkey: "b".repeat(64),
            relays: ["wss://relay.one"],
          },
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      )
    ) as any;
    process.env.NEXT_PUBLIC_COORDINATION_URL = "https://coord.example";
  });

  it("uses shared request transport and persists sent markers for partial delivery", async () => {
    mocks.sendRequest.mockResolvedValue({
      status: "partial",
      convergenceState: "pending_local",
      evidence: { receiptAckSeen: false, acceptSeen: false },
      retryable: false,
      relaySuccessCount: 1,
      relayTotal: 2,
    });

    const { result, unmount } = renderHook(() =>
      useInviteRedemption({
        sendRequest: mocks.sendRequest,
      })
    );

    await act(async () => {
      await result.current.handleRedeemInvite("token-1");
    });

    await waitFor(() => {
      expect(mocks.sendRequest).toHaveBeenCalledWith({
        peerPublicKeyHex: "b".repeat(64) as PublicKeyHex,
      });
    });
    expect(mocks.addRelay).toHaveBeenCalledWith({ url: "wss://relay.one" });
    expect(mocks.toastWarning).toHaveBeenCalledWith("Connection request partially delivered.");
    expect(mocks.setNewChatPubkey).toHaveBeenCalledWith("b".repeat(64));
    expect(mocks.setIsNewChatOpen).toHaveBeenCalledWith(true);
    expect(mocks.routerReplace).toHaveBeenCalledWith("/");

    unmount();

    const { result: nextResult } = renderHook(() =>
      useInviteRedemption({
        sendRequest: mocks.sendRequest,
      })
    );

    await act(async () => {
      await nextResult.current.handleRedeemInvite("token-1");
    });

    await waitFor(() => {
      expect(mocks.sendRequest).toHaveBeenCalledTimes(1);
    });
  });

  it("does not persist sent marker when request is only queued", async () => {
    mocks.sendRequest.mockResolvedValue({
      status: "queued",
      convergenceState: "pending_local",
      evidence: { receiptAckSeen: false, acceptSeen: false },
      retryable: true,
      relaySuccessCount: 0,
      relayTotal: 0,
    });

    const { result, unmount } = renderHook(() =>
      useInviteRedemption({
        sendRequest: mocks.sendRequest,
      })
    );

    await act(async () => {
      await result.current.handleRedeemInvite("token-2");
    });

    await waitFor(() => {
      expect(mocks.sendRequest).toHaveBeenCalledTimes(1);
    });
    expect(mocks.toastWarning).toHaveBeenCalledWith("Connection request queued; retrying.");

    unmount();

    const { result: nextResult } = renderHook(() =>
      useInviteRedemption({
        sendRequest: mocks.sendRequest,
      })
    );

    await act(async () => {
      await nextResult.current.handleRedeemInvite("token-2");
    });

    await waitFor(() => {
      expect(mocks.sendRequest).toHaveBeenCalledTimes(2);
    });
  });
});
