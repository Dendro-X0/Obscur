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

  it("connection-accept is ignored while peer is under removedPeers mask", async () => {
    const { peerTrustInternals } = await import("@/app/features/network/hooks/use-peer-trust");
    const OWNER = "a".repeat(64);
    peerTrustInternals.saveToStorage(OWNER as any, {
      acceptedPeers: [],
      mutedPeers: [],
      removedPeers: [PEER as any],
    });
    const acceptPeer = vi.fn();
    const setStatus = vi.fn();

    await applyIncomingContactLifecycle(
      {
        accountPublicKeyHex: OWNER as any,
        profileId: "default",
        peerTrust: { acceptPeer, unacceptPeer: vi.fn() },
        requestsInbox: {
          getRequestStatus: () => ({ status: "pending", isOutgoing: true }),
          setStatus,
        },
      },
      {
        lifecycleTag: "connection-accept",
        peerPublicKeyHex: PEER as any,
        requestEventId: "req-stale-accept",
        isSelfAuthored: false,
      },
    );

    expect(acceptPeer).not.toHaveBeenCalled();
    expect(setStatus).not.toHaveBeenCalled();
  });

  it("remote connection-accept does not auto-trust incoming pending (lookback / refresh)", async () => {
    const acceptPeer = vi.fn();
    const setStatus = vi.fn();

    await applyIncomingContactLifecycle(
      {
        accountPublicKeyHex: null,
        peerTrust: { acceptPeer, unacceptPeer: vi.fn() },
        requestsInbox: {
          getRequestStatus: () => ({ status: "pending", isOutgoing: false }),
          setStatus,
        },
      },
      {
        lifecycleTag: "connection-accept",
        peerPublicKeyHex: PEER as any,
        requestEventId: "req-lookback-accept",
        isSelfAuthored: false,
      },
    );

    expect(acceptPeer).not.toHaveBeenCalled();
    expect(setStatus).not.toHaveBeenCalled();
  });

  it("remote connection-accept completes outgoing invite with trust", async () => {
    const acceptPeer = vi.fn();
    const setStatus = vi.fn();

    await applyIncomingContactLifecycle(
      {
        accountPublicKeyHex: null,
        peerTrust: { acceptPeer, unacceptPeer: vi.fn() },
        requestsInbox: {
          getRequestStatus: () => ({ status: "pending", isOutgoing: true }),
          setStatus,
        },
      },
      {
        lifecycleTag: "connection-accept",
        peerPublicKeyHex: PEER as any,
        requestEventId: "req-peer-accepted-us",
        isSelfAuthored: false,
      },
    );

    expect(acceptPeer).toHaveBeenCalledWith({ publicKeyHex: PEER });
    expect(setStatus).toHaveBeenCalledWith({
      peerPublicKeyHex: PEER,
      status: "accepted",
      isOutgoing: true,
    });
  });

  it("remote connection-accept with no inbox row does not invent TRUSTED", async () => {
    const acceptPeer = vi.fn();
    const setStatus = vi.fn();

    await applyIncomingContactLifecycle(
      {
        accountPublicKeyHex: null,
        peerTrust: { acceptPeer, unacceptPeer: vi.fn() },
        requestsInbox: {
          getRequestStatus: () => null,
          setStatus,
        },
      },
      {
        lifecycleTag: "connection-accept",
        peerPublicKeyHex: PEER as any,
        requestEventId: "req-orphan-accept",
        isSelfAuthored: false,
      },
    );

    expect(acceptPeer).not.toHaveBeenCalled();
    expect(setStatus).not.toHaveBeenCalled();
  });

  it("lookback connection-accept after cancel does not resurrect TRUSTED", async () => {
    const { peerTrustInternals } = await import("@/app/features/network/hooks/use-peer-trust");
    const OWNER = "a".repeat(64);
    peerTrustInternals.saveToStorage(OWNER as any, {
      acceptedPeers: [PEER as any],
      mutedPeers: [],
      removedPeers: [],
    });
    const unacceptPeer = vi.fn(({ publicKeyHex }: { publicKeyHex: string }) => {
      const prev = peerTrustInternals.loadFromStorage(OWNER as any, "default");
      peerTrustInternals.saveToStorage(OWNER as any, {
        acceptedPeers: prev.acceptedPeers.filter((peer) => peer !== publicKeyHex),
        mutedPeers: prev.mutedPeers,
        removedPeers: prev.removedPeers.includes(publicKeyHex as any)
          ? prev.removedPeers
          : [...prev.removedPeers, publicKeyHex as any],
      }, "default");
    });
    const acceptPeer = vi.fn();
    const remove = vi.fn();
    const deps = {
      accountPublicKeyHex: OWNER as any,
      profileId: "default",
      peerTrust: { acceptPeer, unacceptPeer },
      requestsInbox: {
        getRequestStatus: () => ({ status: "accepted", isOutgoing: false }),
        setStatus: vi.fn(),
        remove,
      },
    };

    await applyIncomingContactLifecycle(deps, {
      lifecycleTag: "connection-cancel",
      peerPublicKeyHex: PEER as any,
      requestEventId: "req-cancel",
      isSelfAuthored: false,
    });
    await applyIncomingContactLifecycle(deps, {
      lifecycleTag: "connection-accept",
      peerPublicKeyHex: PEER as any,
      requestEventId: "req-stale-accept-lookback",
      isSelfAuthored: false,
    });

    expect(unacceptPeer).toHaveBeenCalled();
    expect(acceptPeer).not.toHaveBeenCalled();
    expect(peerTrustInternals.loadFromStorage(OWNER as any, "default").removedPeers).toContain(PEER);
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
