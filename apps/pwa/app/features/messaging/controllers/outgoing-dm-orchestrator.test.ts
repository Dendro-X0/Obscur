import { describe, expect, it } from "vitest";
import { outgoingDmOrchestratorInternals } from "./outgoing-dm-orchestrator";

describe("outgoing-dm-orchestrator internals", () => {
  it("forces legacy DM format for connection lifecycle tags", () => {
    expect(outgoingDmOrchestratorInternals.shouldForceLegacyDmFormat([
      ["t", "connection-request"],
    ])).toBe(false);

    expect(outgoingDmOrchestratorInternals.shouldForceLegacyDmFormat([
      ["t", "connection-accept"],
    ])).toBe(false);

    expect(outgoingDmOrchestratorInternals.shouldForceLegacyDmFormat([
      ["t", "connection-decline"],
    ])).toBe(false);

    expect(outgoingDmOrchestratorInternals.shouldForceLegacyDmFormat([
      ["t", "connection-cancel"],
    ])).toBe(false);
  });

  it("does not force legacy DM format for ordinary messages", () => {
    expect(outgoingDmOrchestratorInternals.shouldForceLegacyDmFormat([
      ["p", "peer"],
      ["e", "reply-id"],
    ])).toBe(false);
  });

  it("prefers legacy DM format while stability mode is active", () => {
    expect(outgoingDmOrchestratorInternals.shouldPreferLegacyDmFormat({
      customTags: [["p", "peer"]],
      useModernDMs: true,
      hasPublishToAll: true,
      stabilityModeEnabled: true,
      protocolCoreEnabled: false,
      preferModernGiftWrap: false,
    })).toBe(true);
  });

  it("keeps modern DM format on desktop native runtime even in stability mode", () => {
    expect(outgoingDmOrchestratorInternals.shouldPreferLegacyDmFormat({
      customTags: [["p", "peer"]],
      useModernDMs: false,
      hasPublishToAll: true,
      stabilityModeEnabled: true,
      protocolCoreEnabled: false,
      preferModernGiftWrap: true,
    })).toBe(false);
  });

  it("keeps connection lifecycle messages on the modern path even in stability mode", () => {
    expect(outgoingDmOrchestratorInternals.shouldPreferLegacyDmFormat({
      customTags: [["t", "connection-request"]],
      useModernDMs: false,
      hasPublishToAll: true,
      stabilityModeEnabled: true,
      protocolCoreEnabled: false,
      preferModernGiftWrap: false,
    })).toBe(false);
  });

  it("prefers legacy DM format when protocol core rollout is disabled", () => {
    expect(outgoingDmOrchestratorInternals.shouldPreferLegacyDmFormat({
      customTags: [["p", "peer"]],
      useModernDMs: true,
      hasPublishToAll: true,
      stabilityModeEnabled: false,
      protocolCoreEnabled: false,
      preferModernGiftWrap: false,
    })).toBe(true);
  });

  it("allows modern DM format only when rollout and runtime are both ready", () => {
    expect(outgoingDmOrchestratorInternals.shouldPreferLegacyDmFormat({
      customTags: [["p", "peer"]],
      useModernDMs: true,
      hasPublishToAll: true,
      stabilityModeEnabled: false,
      protocolCoreEnabled: true,
      preferModernGiftWrap: false,
    })).toBe(false);
  });

  it("scopes connection lifecycle messages to recipient-facing relays when known", () => {
    expect(outgoingDmOrchestratorInternals.resolveTargetRelayUrls({
      customTags: [["t", "connection-request"]],
      discoveredRecipientRelayUrls: ["wss://recipient-read.example"],
      senderOpenRelayUrls: ["wss://sender-open.example"],
      senderWriteRelayUrls: ["wss://sender-write.example"],
      recipientWriteRelayUrls: ["wss://recipient-write.example"],
      recipientInboundRelayUrls: [],
    })).toEqual({
      lifecycleTag: "connection-request",
      targetRelayUrls: [
        "wss://recipient-read.example",
        "wss://recipient-write.example",
        "wss://sender-open.example",
        "wss://sender-write.example",
      ],
      recipientScopeRelayUrls: ["wss://recipient-read.example", "wss://recipient-write.example"],
      recipientScopeSources: ["recipient_discovery", "recipient_write_relays"],
      relayScopeSource: "mixed_recipient_scope",
      usedRecipientScopeOnly: false,
    });
  });

  it("falls back to sender open relays when recipient-facing lifecycle scope is unknown", () => {
    expect(outgoingDmOrchestratorInternals.resolveTargetRelayUrls({
      customTags: [["t", "connection-request"]],
      discoveredRecipientRelayUrls: [],
      senderOpenRelayUrls: ["wss://sender-open.example"],
      senderWriteRelayUrls: ["wss://sender-write.example"],
      recipientWriteRelayUrls: [],
      recipientInboundRelayUrls: [],
    })).toEqual({
      lifecycleTag: "connection-request",
      targetRelayUrls: ["wss://sender-open.example", "wss://sender-write.example"],
      recipientScopeRelayUrls: [],
      recipientScopeSources: [],
      relayScopeSource: "sender_fallback",
      usedRecipientScopeOnly: false,
    });
  });

  it("uses inbound peer relay evidence when discovery and recipient write scope are empty", () => {
    expect(outgoingDmOrchestratorInternals.resolveTargetRelayUrls({
      customTags: [["p", "peer"]],
      discoveredRecipientRelayUrls: [],
      senderOpenRelayUrls: ["wss://sender-open.example"],
      senderWriteRelayUrls: [],
      recipientWriteRelayUrls: [],
      recipientInboundRelayUrls: ["wss://peer-evidence.example"],
    })).toEqual({
      lifecycleTag: null,
      targetRelayUrls: ["wss://peer-evidence.example", "wss://sender-open.example"],
      recipientScopeRelayUrls: ["wss://peer-evidence.example"],
      recipientScopeSources: ["peer_inbound_evidence"],
      relayScopeSource: "peer_inbound_evidence",
      usedRecipientScopeOnly: false,
    });
  });

  it("scopes message-delete transport to recipient-facing relays only when available", () => {
    expect(outgoingDmOrchestratorInternals.resolveTargetRelayUrls({
      customTags: [["t", "message-delete"]],
      discoveredRecipientRelayUrls: ["wss://recipient-read.example"],
      senderOpenRelayUrls: ["wss://sender-open.example"],
      senderWriteRelayUrls: ["wss://sender-write.example"],
      recipientWriteRelayUrls: ["wss://recipient-write.example"],
      recipientInboundRelayUrls: [],
    })).toEqual({
      lifecycleTag: null,
      targetRelayUrls: ["wss://recipient-read.example", "wss://recipient-write.example"],
      recipientScopeRelayUrls: ["wss://recipient-read.example", "wss://recipient-write.example"],
      recipientScopeSources: ["recipient_discovery", "recipient_write_relays"],
      relayScopeSource: "mixed_recipient_scope",
      usedRecipientScopeOnly: true,
    });
  });

  it("falls back to sender relays for message-delete when recipient scope is unknown", () => {
    expect(outgoingDmOrchestratorInternals.resolveTargetRelayUrls({
      customTags: [["t", "message-delete"]],
      discoveredRecipientRelayUrls: [],
      senderOpenRelayUrls: ["wss://sender-open.example"],
      senderWriteRelayUrls: ["wss://sender-write.example"],
      recipientWriteRelayUrls: [],
      recipientInboundRelayUrls: [],
    })).toEqual({
      lifecycleTag: null,
      targetRelayUrls: ["wss://sender-open.example", "wss://sender-write.example"],
      recipientScopeRelayUrls: [],
      recipientScopeSources: [],
      relayScopeSource: "sender_fallback",
      usedRecipientScopeOnly: false,
    });
  });

  it("classifies partial publish evidence as retrying delivery issue", () => {
    expect(outgoingDmOrchestratorInternals.resolveSenderDeliveryIssueStatus({
      success: false,
      successCount: 1,
    })).toBe("queued_retrying");
  });

  it("classifies zero-success publish evidence as failed delivery issue", () => {
    expect(outgoingDmOrchestratorInternals.resolveSenderDeliveryIssueStatus({
      success: false,
      successCount: 0,
    })).toBe("failed");
  });

  it("allows degraded immediate publish when at least one scoped writable relay is available", () => {
    expect(outgoingDmOrchestratorInternals.resolveRelayPreflightDecision({
      openRelayCount: 1,
      scopedWritableRelayCount: 1,
      durableRelayMinimum: 2,
    })).toBe("attempt_degraded");
  });

  it("queues only when no scoped writable relay is available", () => {
    expect(outgoingDmOrchestratorInternals.resolveRelayPreflightDecision({
      openRelayCount: 2,
      scopedWritableRelayCount: 0,
      durableRelayMinimum: 2,
    })).toBe("queue_no_writable_relays");
  });

  it("keeps retryable failed publish outcomes as partial for ordinary messages", () => {
    expect(outgoingDmOrchestratorInternals.resolveSendDeliveryStatus({
      success: false,
      status: "partial",
      reasonCode: "relay_degraded",
      successCount: 1,
    })).toBe("sent_partial");
  });

  it("keeps zero-success retryable outcomes as failed for ordinary messages", () => {
    expect(outgoingDmOrchestratorInternals.resolveSendDeliveryStatus({
      success: false,
      status: "failed",
      reasonCode: "quorum_not_met",
      successCount: 0,
    })).toBe("failed");
  });

  it("maps retryable failed publish outcomes to queued retrying for delete commands", () => {
    expect(outgoingDmOrchestratorInternals.resolveSendDeliveryStatus({
      success: false,
      status: "partial",
      reasonCode: "relay_degraded",
      successCount: 1,
    }, {
      queueRetryableFailures: true,
    })).toBe("queued_retrying");
  });

  it("maps non-retryable failed publish outcomes to failed delivery status", () => {
    expect(outgoingDmOrchestratorInternals.resolveSendDeliveryStatus({
      success: false,
      status: "failed",
      reasonCode: "unsupported_runtime",
    })).toBe("failed");
  });

  it("keeps successful partial publish outcomes as sent_partial", () => {
    expect(outgoingDmOrchestratorInternals.resolveSendDeliveryStatus({
      success: true,
      status: "partial",
      reasonCode: "relay_degraded",
    })).toBe("sent_partial");
  });
});
