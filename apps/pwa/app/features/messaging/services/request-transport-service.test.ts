import { describe, expect, it, vi } from "vitest";
import {
  createRequestTransportService,
  deriveRequestConvergenceState,
  pendingAcceptRelayQueue,
  requestTransportInternals,
} from "./request-transport-service";
import * as accountEventIngestBridge from "@/app/features/account-sync/services/account-event-ingest-bridge";
import * as pathBB5ExtensionHooks from "./path-b-b5-extension-hooks";

describe("request-transport-service internals", () => {
  it("maps send result statuses deterministically", () => {
    expect(requestTransportInternals.mapSendResultToStatus({
      success: true,
      deliveryStatus: "sent_quorum",
      messageId: "m1",
      relayResults: [],
    } as any)).toBe("ok");

    expect(requestTransportInternals.mapSendResultToStatus({
      success: true,
      deliveryStatus: "sent_partial",
      messageId: "m2",
      relayResults: [],
    } as any)).toBe("partial");

    expect(requestTransportInternals.mapSendResultToStatus({
      success: false,
      deliveryStatus: "queued_retrying",
      retryAtUnixMs: Date.now() + 1000,
      messageId: "m3",
      relayResults: [],
    } as any)).toBe("queued");

    expect(requestTransportInternals.mapSendResultToStatus({
      success: false,
      deliveryStatus: "failed",
      messageId: "m4",
      relayResults: [],
    } as any)).toBe("failed");
  });

  it("classifies retryable transient failures", () => {
    expect(requestTransportInternals.isRetryableSendFailure({
      success: false,
      messageId: "m1",
      relayResults: [],
      failureReason: "no_active_relays",
    } as any)).toBe(true);

    expect(requestTransportInternals.isRetryableSendFailure({
      success: false,
      messageId: "m2",
      relayResults: [],
      blockReason: "identity_locked",
    } as any)).toBe(false);
  });

  it("commits accepted state locally even when relay publish fails", async () => {
    pendingAcceptRelayQueue.clear();
    const acceptPeer = vi.fn();
    const setStatus = vi.fn();
    const markAccept = vi.fn();
    const sendDm = vi.fn(async () => ({
      success: false,
      deliveryStatus: "queued_retrying" as const,
      messageId: "accept-queued-1",
      eventId: "evt-queued-1",
      retryAtUnixMs: Date.now() + 30_000,
      relayResults: [{ relayUrl: "wss://relay.test", success: false, error: "timeout" }],
      failureReason: "no_active_relays" as const,
    }));
    const service = createRequestTransportService({
      sendConnectionRequest: vi.fn(),
      sendDm,
      peerTrust: { acceptPeer },
      requestsInbox: {
        getRequestStatus: () => ({ status: "pending", isOutgoing: false }),
        setStatus,
      },
      evidenceStore: {
        get: () => ({ receiptAckSeen: false, acceptSeen: false }),
        markRequestPublished: vi.fn(),
        markReceiptAck: vi.fn(),
        markAccept,
        markTerminalFailure: vi.fn(),
      } as any,
    });

    const outcome = await service.acceptIncomingRequest({
      peerPublicKeyHex: "b".repeat(64) as any,
      requestEventId: "req-1",
    });

    expect(outcome.status).toBe("ok");
    expect(outcome.convergenceState).toBe("accepted");
    expect(outcome.relayConfirmed).toBe(false);
    expect(acceptPeer).toHaveBeenCalledWith({ publicKeyHex: "b".repeat(64) });
    expect(setStatus).toHaveBeenCalledWith({
      peerPublicKeyHex: "b".repeat(64),
      status: "accepted",
      isOutgoing: false,
    });
    expect(markAccept).toHaveBeenCalled();
    expect(sendDm).toHaveBeenCalledWith(expect.objectContaining({
      waitForConfirmation: true,
      suppressPublishFeedbackToast: true,
      customTags: [["t", "connection-accept"], ["e", "req-1"]],
    }));
    expect(pendingAcceptRelayQueue.hasPending("b".repeat(64))).toBe(true);
    expect(pendingAcceptRelayQueue.getAll()[0]?.relaySendAttemptedAtUnixMs).toBeTypeOf("number");
    pendingAcceptRelayQueue.clear();
  });

  it("waits for writable relay before accept publish when preflight hook is provided", async () => {
    pendingAcceptRelayQueue.clear();
    const waitForWritableRelay = vi.fn(async () => true);
    const sendDm = vi.fn(async () => ({
      success: true,
      deliveryStatus: "sent_quorum" as const,
      messageId: "accept-1",
      eventId: "evt-accept-1",
      relayResults: [{ relayUrl: "wss://relay.test", success: true }],
    }));
    const service = createRequestTransportService({
      sendConnectionRequest: vi.fn(),
      sendDm,
      waitForWritableRelay,
      requestsInbox: {
        getRequestStatus: () => ({ status: "pending", isOutgoing: false }),
        setStatus: vi.fn(),
      },
      evidenceStore: {
        get: () => ({ receiptAckSeen: false, acceptSeen: false }),
        markRequestPublished: vi.fn(),
        markReceiptAck: vi.fn(),
        markAccept: vi.fn(),
        markTerminalFailure: vi.fn(),
      } as any,
    });

    await service.acceptIncomingRequest({
      peerPublicKeyHex: "b".repeat(64) as any,
      requestEventId: "req-1",
    });

    expect(waitForWritableRelay).toHaveBeenCalledWith(20_000);
    pendingAcceptRelayQueue.clear();
  });

  it("does not re-send accept relay notification when already accepted locally", async () => {
    pendingAcceptRelayQueue.clear();
    const sendDm = vi.fn();
    const service = createRequestTransportService({
      sendConnectionRequest: vi.fn(),
      sendDm,
      requestsInbox: {
        getRequestStatus: () => ({ status: "accepted", isOutgoing: false }),
        setStatus: vi.fn(),
      },
      evidenceStore: {
        get: () => ({ receiptAckSeen: false, acceptSeen: true }),
        markRequestPublished: vi.fn(),
        markReceiptAck: vi.fn(),
        markAccept: vi.fn(),
        markTerminalFailure: vi.fn(),
      } as any,
    });

    const outcome = await service.acceptIncomingRequest({
      peerPublicKeyHex: "b".repeat(64) as any,
      requestEventId: "req-1",
    });

    expect(sendDm).not.toHaveBeenCalled();
    expect(outcome.relayConfirmed).toBe(true);
    pendingAcceptRelayQueue.clear();
  });

  it("commits accepted state with relayConfirmed=true when relay succeeds", async () => {
    pendingAcceptRelayQueue.clear();
    const acceptPeer = vi.fn();
    const setStatus = vi.fn();
    const service = createRequestTransportService({
      sendConnectionRequest: vi.fn(),
      sendDm: async () => ({
        success: true,
        deliveryStatus: "sent_quorum",
        messageId: "accept-1",
        relayResults: [{ relayUrl: "wss://relay.test", success: true }],
      }) as any,
      peerTrust: { acceptPeer },
      requestsInbox: {
        getRequestStatus: () => ({ status: "pending", isOutgoing: false }),
        setStatus,
      },
      evidenceStore: {
        get: () => ({ receiptAckSeen: false, acceptSeen: false }),
        markRequestPublished: vi.fn(),
        markReceiptAck: vi.fn(),
        markAccept: vi.fn(),
        markTerminalFailure: vi.fn(),
      } as any,
    });

    const outcome = await service.acceptIncomingRequest({
      peerPublicKeyHex: "b".repeat(64) as any,
      requestEventId: "req-1",
    });

    expect(outcome.status).toBe("ok");
    expect(outcome.relayConfirmed).toBe(true);
    expect(acceptPeer).toHaveBeenCalled();
    expect(setStatus).toHaveBeenCalledWith(expect.objectContaining({ status: "accepted" }));
    expect(pendingAcceptRelayQueue.hasPending("b".repeat(64))).toBe(false);
    pendingAcceptRelayQueue.clear();
  });

  it("enqueues relay retry on failed accept and dequeues on success", () => {
    pendingAcceptRelayQueue.clear();
    pendingAcceptRelayQueue.enqueue({
      peerPublicKeyHex: "c".repeat(64),
      plaintext: "Accepted",
      requestEventId: "req-2",
    });
    expect(pendingAcceptRelayQueue.hasPending("c".repeat(64))).toBe(true);
    expect(pendingAcceptRelayQueue.getAll()).toHaveLength(1);

    pendingAcceptRelayQueue.dequeue("c".repeat(64));
    expect(pendingAcceptRelayQueue.hasPending("c".repeat(64))).toBe(false);
    expect(pendingAcceptRelayQueue.getAll()).toHaveLength(0);
  });

  it("does not duplicate entries in the relay retry queue", () => {
    pendingAcceptRelayQueue.clear();
    pendingAcceptRelayQueue.enqueue({ peerPublicKeyHex: "d".repeat(64), plaintext: "Accepted" });
    pendingAcceptRelayQueue.enqueue({ peerPublicKeyHex: "d".repeat(64), plaintext: "Accepted" });
    expect(pendingAcceptRelayQueue.getAll()).toHaveLength(1);
    pendingAcceptRelayQueue.clear();
  });

  it("commits declined state only when decline publish has relay evidence", async () => {
    const setStatus = vi.fn();
    const reset = vi.fn();
    const service = createRequestTransportService({
      sendConnectionRequest: vi.fn(),
      sendDm: async () => ({
        success: true,
        deliveryStatus: "sent_partial",
        messageId: "decline-1",
        relayResults: [{ relayUrl: "wss://relay.test", success: true }],
      }) as any,
      requestsInbox: {
        getRequestStatus: () => ({ status: "pending", isOutgoing: false }),
        setStatus,
      },
      evidenceStore: {
        get: () => ({ receiptAckSeen: false, acceptSeen: false }),
        markRequestPublished: vi.fn(),
        markReceiptAck: vi.fn(),
        markAccept: vi.fn(),
        markTerminalFailure: vi.fn(),
        reset,
      } as any,
    });

    const outcome = await service.declineIncomingRequest({
      peerPublicKeyHex: "b".repeat(64) as any,
      requestEventId: "req-1",
    });

    expect(outcome.status).toBe("partial");
    expect(outcome.convergenceState).toBe("rejected");
    expect(setStatus).toHaveBeenCalledWith({
      peerPublicKeyHex: "b".repeat(64),
      status: "declined",
      isOutgoing: false,
    });
    expect(reset).toHaveBeenCalledWith("b".repeat(64), expect.any(String));
  });

  it("does not commit cancel state when cancel publish is only queued", async () => {
    const setStatus = vi.fn();
    const reset = vi.fn();
    const service = createRequestTransportService({
      sendConnectionRequest: vi.fn(),
      sendDm: async () => ({
        success: false,
        deliveryStatus: "queued_retrying",
        retryAtUnixMs: Date.now() + 30_000,
        messageId: "cancel-1",
        relayResults: [{ relayUrl: "wss://relay.test", success: false, error: "timeout" }],
        failureReason: "no_active_relays",
      }) as any,
      requestsInbox: {
        getRequestStatus: () => ({ status: "pending", isOutgoing: true }),
        setStatus,
      },
      evidenceStore: {
        get: () => ({ receiptAckSeen: false, acceptSeen: false }),
        markRequestPublished: vi.fn(),
        markReceiptAck: vi.fn(),
        markAccept: vi.fn(),
        markTerminalFailure: vi.fn(),
        reset,
      } as any,
    });

    const outcome = await service.cancelOutgoingRequest({
      peerPublicKeyHex: "b".repeat(64) as any,
      requestEventId: "req-2",
    });

    expect(outcome.status).toBe("queued");
    expect(outcome.convergenceState).toBe("pending_local");
    expect(setStatus).not.toHaveBeenCalled();
    expect(reset).not.toHaveBeenCalled();
  });

  it("dual-writes canonical contact event when request send has relay evidence", async () => {
    const appendContactEvent = vi.spyOn(accountEventIngestBridge, "appendCanonicalContactEvent").mockResolvedValue();
    const setStatus = vi.fn();
    const service = createRequestTransportService({
      accountPublicKeyHex: "a".repeat(64) as any,
      sendConnectionRequest: async () => ({
        success: true,
        deliveryStatus: "sent_quorum",
        messageId: "request-event-1",
        relayResults: [{ relayUrl: "wss://relay.test", success: true }],
      }) as any,
      sendDm: vi.fn(),
      requestsInbox: { getRequestStatus: vi.fn(), setStatus },
      evidenceStore: {
        get: () => ({ receiptAckSeen: false, acceptSeen: false }),
        markRequestPublished: vi.fn(),
        markReceiptAck: vi.fn(),
        markAccept: vi.fn(),
        markTerminalFailure: vi.fn(),
      } as any,
    });

    await service.sendRequest({
      peerPublicKeyHex: "b".repeat(64) as any,
      introMessage: "hello",
    });

    expect(setStatus).toHaveBeenCalledWith({
      peerPublicKeyHex: "b".repeat(64),
      status: "pending",
      isOutgoing: true,
      lastMessagePreview: "hello",
    });
    expect(appendContactEvent).toHaveBeenCalledWith(expect.objectContaining({
      accountPublicKeyHex: "a".repeat(64),
      peerPublicKeyHex: "b".repeat(64),
      type: "CONTACT_REQUEST_SENT",
      direction: "outgoing",
      requestEventId: "request-event-1",
    }));
    appendContactEvent.mockRestore();
  });

  it("sends sandbox Q&A with connection-qna tag", async () => {
    const sendDm = vi.fn(async () => ({
      success: true,
      deliveryStatus: "sent_quorum",
      messageId: "qna-1",
      relayResults: [{ relayUrl: "wss://relay.test", success: true }],
    }));
    const service = createRequestTransportService({
      sendConnectionRequest: vi.fn(),
      sendDm: sendDm as any,
    });

    const outcome = await service.sendSandboxQna({
      peerPublicKeyHex: "b".repeat(64) as any,
      plaintext: "Who referred you?",
    });

    expect(outcome.status).toBe("ok");
    expect(sendDm).toHaveBeenCalledWith(expect.objectContaining({
      plaintext: "Who referred you?",
      customTags: [["t", "connection-qna"]],
    }));
  });

  it("derives convergence state from evidence + inbox + outbox", () => {
    expect(deriveRequestConvergenceState({
      inboxStatus: "accepted",
      outboxStatus: "sent_quorum",
    })).toBe("accepted");

    expect(deriveRequestConvergenceState({
      evidence: { receiptAckSeen: true, acceptSeen: false },
      outboxStatus: "sent_partial",
    })).toBe("pending_evidenced");

    expect(deriveRequestConvergenceState({
      outboxStatus: "failed",
    })).toBe("terminal_failed");

    expect(deriveRequestConvergenceState({
      inboxStatus: "declined",
    })).toBe("rejected");
  });

  it("classifies accept commit eligibility deterministically", () => {
    expect(requestTransportInternals.canCommitAcceptedState("ok", {
      deliveryStatus: "sent_quorum",
      relayResults: [{ relayUrl: "wss://relay.test", success: true }],
    } as any)).toBe(true);

    expect(requestTransportInternals.canCommitAcceptedState("partial", {
      deliveryStatus: "sent_partial",
      relayResults: [{ relayUrl: "wss://relay.test", success: true }],
    } as any)).toBe(true);

    expect(requestTransportInternals.canCommitAcceptedState("queued", {
      deliveryStatus: "queued_retrying",
      relayResults: [{ relayUrl: "wss://relay.test", success: false }],
    } as any)).toBe(false);
  });

  it("classifies terminal request commit eligibility deterministically", () => {
    expect(requestTransportInternals.canCommitTerminalRequestState("ok", {
      deliveryStatus: "sent_quorum",
      relayResults: [{ relayUrl: "wss://relay.test", success: true }],
    } as any)).toBe(true);

    expect(requestTransportInternals.canCommitTerminalRequestState("partial", {
      deliveryStatus: "sent_partial",
      relayResults: [{ relayUrl: "wss://relay.test", success: true }],
    } as any)).toBe(true);

    expect(requestTransportInternals.canCommitTerminalRequestState("queued", {
      deliveryStatus: "queued_retrying",
      relayResults: [{ relayUrl: "wss://relay.test", success: false }],
    } as any)).toBe(false);
  });

  it("blocks outbound connection requests when invite economics gate denies send", async () => {
    const economicsGate = vi.spyOn(pathBB5ExtensionHooks, "evaluatePathBConnectionRequestEconomicsGate")
      .mockReturnValue(false);
    const sendConnectionRequest = vi.fn();
    const service = createRequestTransportService({
      accountPublicKeyHex: "a".repeat(64),
      sendConnectionRequest,
      sendDm: vi.fn(),
      evidenceStore: {
        get: () => ({ receiptAckSeen: false, acceptSeen: false }),
        markRequestPublished: vi.fn(),
        markReceiptAck: vi.fn(),
        markAccept: vi.fn(),
        markTerminalFailure: vi.fn(),
      } as any,
    });

    const outcome = await service.sendRequest({ peerPublicKeyHex: "b".repeat(64) as any });

    expect(sendConnectionRequest).not.toHaveBeenCalled();
    expect(outcome.status).toBe("failed");
    expect(outcome.reasonCode).toBe("cooldown_active");
    economicsGate.mockRestore();
  });
});
