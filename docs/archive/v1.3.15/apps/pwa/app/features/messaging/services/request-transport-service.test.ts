import { describe, expect, it, vi } from "vitest";
import {
  createRequestTransportService,
  deriveRequestConvergenceState,
  requestTransportInternals,
} from "./request-transport-service";
import * as accountEventIngestBridge from "@/app/features/account-sync/services/account-event-ingest-bridge";

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

  it("only commits accepted state when acceptance publish has relay evidence", async () => {
    const acceptPeer = vi.fn();
    const setStatus = vi.fn();
    const service = createRequestTransportService({
      sendConnectionRequest: vi.fn(),
      sendDm: async () => ({
        success: false,
        deliveryStatus: "queued_retrying",
        retryAtUnixMs: Date.now() + 30_000,
        relayResults: [{ relayUrl: "wss://relay.test", success: false, error: "timeout" }],
        failureReason: "no_active_relays",
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

    expect(outcome.status).toBe("queued");
    expect(outcome.convergenceState).toBe("pending_local");
    expect(acceptPeer).not.toHaveBeenCalled();
    expect(setStatus).not.toHaveBeenCalled();
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
    expect(reset).toHaveBeenCalledWith("b".repeat(64));
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
    const service = createRequestTransportService({
      accountPublicKeyHex: "a".repeat(64) as any,
      sendConnectionRequest: async () => ({
        success: true,
        deliveryStatus: "sent_quorum",
        messageId: "request-event-1",
        relayResults: [{ relayUrl: "wss://relay.test", success: true }],
      }) as any,
      sendDm: vi.fn(),
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

    expect(appendContactEvent).toHaveBeenCalledWith(expect.objectContaining({
      accountPublicKeyHex: "a".repeat(64),
      peerPublicKeyHex: "b".repeat(64),
      type: "CONTACT_REQUEST_SENT",
      direction: "outgoing",
      requestEventId: "request-event-1",
    }));
    appendContactEvent.mockRestore();
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
});
