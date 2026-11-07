import { describe, expect, it, vi } from "vitest";
import { applyIncomingContactLifecycle } from "./contact-request-incoming-lifecycle";

const PEER = "b".repeat(64);

describe("applyIncomingContactLifecycle", () => {
  it("demotes trust and clears inbox via remove on connection-cancel", async () => {
    const unacceptPeer = vi.fn();
    const setStatus = vi.fn();
    const remove = vi.fn();
    const acceptPeer = vi.fn();

    await applyIncomingContactLifecycle(
      {
        accountPublicKeyHex: null,
        peerTrust: { acceptPeer, unacceptPeer },
        requestsInbox: {
          getRequestStatus: () => ({ status: "accepted", isOutgoing: false }),
          setStatus,
          remove,
        },
      },
      {
        lifecycleTag: "connection-cancel",
        peerPublicKeyHex: PEER as any,
        requestEventId: "req-1",
        isSelfAuthored: false,
      },
    );

    expect(unacceptPeer).toHaveBeenCalledWith({ publicKeyHex: PEER });
    expect(remove).toHaveBeenCalledWith({ peerPublicKeyHex: PEER });
    expect(setStatus).not.toHaveBeenCalled();
    expect(acceptPeer).not.toHaveBeenCalled();
  });

  it("demotes trust on connection-block like cancel", async () => {
    const unacceptPeer = vi.fn();
    const remove = vi.fn();

    await applyIncomingContactLifecycle(
      {
        accountPublicKeyHex: null,
        peerTrust: { acceptPeer: vi.fn(), unacceptPeer },
        requestsInbox: {
          getRequestStatus: () => ({ status: "accepted", isOutgoing: false }),
          setStatus: vi.fn(),
          remove,
        },
      },
      {
        lifecycleTag: "connection-block",
        peerPublicKeyHex: PEER as any,
        requestEventId: "req-block",
        isSelfAuthored: false,
      },
    );

    expect(unacceptPeer).toHaveBeenCalledWith({ publicKeyHex: PEER });
    expect(remove).toHaveBeenCalledWith({ peerPublicKeyHex: PEER });
  });

  it("connection-unblock does not restore trust", async () => {
    const unacceptPeer = vi.fn();
    const acceptPeer = vi.fn();
    const remove = vi.fn();

    await applyIncomingContactLifecycle(
      {
        accountPublicKeyHex: null,
        peerTrust: { acceptPeer, unacceptPeer },
        requestsInbox: {
          getRequestStatus: () => ({ status: "accepted", isOutgoing: false }),
          setStatus: vi.fn(),
          remove,
        },
      },
      {
        lifecycleTag: "connection-unblock",
        peerPublicKeyHex: PEER as any,
        isSelfAuthored: false,
      },
    );

    expect(acceptPeer).not.toHaveBeenCalled();
    expect(unacceptPeer).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
  });

  it("falls back to setStatus canceled when remove is unavailable", async () => {
    const unacceptPeer = vi.fn();
    const setStatus = vi.fn();

    await applyIncomingContactLifecycle(
      {
        accountPublicKeyHex: null,
        peerTrust: { acceptPeer: vi.fn(), unacceptPeer },
        requestsInbox: {
          getRequestStatus: () => ({ status: "accepted", isOutgoing: false }),
          setStatus,
        },
      },
      {
        lifecycleTag: "connection-cancel",
        peerPublicKeyHex: PEER as any,
        requestEventId: "req-1",
        isSelfAuthored: false,
      },
    );

    expect(unacceptPeer).toHaveBeenCalledWith({ publicKeyHex: PEER });
    expect(setStatus).toHaveBeenCalledWith({
      peerPublicKeyHex: PEER,
      status: "canceled",
      isOutgoing: true,
    });
  });
});
