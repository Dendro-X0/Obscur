import { describe, expect, it, vi, beforeEach } from "vitest";
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { handleIncomingDmEvent } from "./incoming-dm-event-handler";
import { protocolCoreAdapter } from "@/app/features/runtime/protocol-core-adapter";
import { getV090RolloutPolicy } from "@/app/features/settings/services/v090-rollout-policy";
import { failedIncomingEventStore } from "../services/failed-incoming-event-store";
import { requestEventTombstoneStore } from "../services/request-event-tombstone-store";
import { resetIncomingRequestAntiAbuseState } from "../services/incoming-request-anti-abuse";
import { cryptoService } from "@/app/features/crypto/crypto-service";
import { createDeleteCommandMessage, encodeCommandMessage } from "../utils/commands";

const MY_PUBLIC_KEY = "a".repeat(64) as PublicKeyHex;
const SENDER_PUBLIC_KEY = "b".repeat(64);
const { getPrivacySettingsMock } = vi.hoisted(() => ({
    getPrivacySettingsMock: vi.fn(() => ({ dmPrivacy: "everyone" })),
}));
const { requestFlowEvidenceStoreMock } = vi.hoisted(() => ({
    requestFlowEvidenceStoreMock: {
        get: vi.fn(() => ({ receiptAckSeen: false, acceptSeen: false } as any)),
        markRequestPublished: vi.fn(),
        markReceiptAck: vi.fn(),
        markAccept: vi.fn(),
        reset: vi.fn(),
    },
}));
const { peerRelayEvidenceStoreMock } = vi.hoisted(() => ({
    peerRelayEvidenceStoreMock: {
        recordInboundRelay: vi.fn(),
        getRelayUrls: vi.fn(() => []),
        clearPeer: vi.fn(),
        clear: vi.fn(),
    },
}));

vi.mock("@/app/features/crypto/crypto-service", () => ({
    cryptoService: {
        verifyEventSignature: vi.fn(async () => true),
        decryptDM: vi.fn(async () => "incoming plaintext"),
        decryptGiftWrap: vi.fn(async () => ({
            id: "rumor-id",
            pubkey: "b".repeat(64),
            kind: 1059,
            created_at: 1234,
            tags: [],
            content: JSON.stringify({
                type: "community-invite",
                groupId: "group-alpha",
                roomKeyHex: "room-key",
                relayUrl: "wss://relay.example"
            })
        }))
    }
}));

vi.mock("@/app/features/settings/services/privacy-settings-service", () => ({
    PrivacySettingsService: {
        getSettings: getPrivacySettingsMock
    }
}));

vi.mock("@/app/features/settings/services/v090-rollout-policy", () => ({
    getV090RolloutPolicy: vi.fn(() => ({
        stabilityModeEnabled: false,
        deterministicDiscoveryEnabled: false,
        protocolCoreEnabled: false,
        x3dhRatchetEnabled: false,
    })),
}));

vi.mock("@/app/features/runtime/protocol-core-adapter", () => ({
    protocolCoreAdapter: {
        verifyMessageEnvelope: vi.fn(async () => ({
            ok: true,
            value: { ok: true, sessionId: "session-a", messageId: "event", verifiedAtUnixMs: Date.now() },
        })),
    },
}));

vi.mock("../services/request-flow-evidence-store", () => ({
    requestFlowEvidenceStore: requestFlowEvidenceStoreMock,
}));

vi.mock("../services/peer-relay-evidence-store", () => ({
    peerRelayEvidenceStore: peerRelayEvidenceStoreMock,
}));

describe("incoming-dm-event-handler", () => {
  beforeEach(() => {
        vi.restoreAllMocks();
        failedIncomingEventStore.clear();
        requestEventTombstoneStore.clear();
        resetIncomingRequestAntiAbuseState();
        getPrivacySettingsMock.mockReturnValue({ dmPrivacy: "everyone" });
        requestFlowEvidenceStoreMock.get.mockReturnValue({ receiptAckSeen: false, acceptSeen: false } as any);
        requestFlowEvidenceStoreMock.markRequestPublished.mockReset();
        requestFlowEvidenceStoreMock.markReceiptAck.mockReset();
        requestFlowEvidenceStoreMock.markAccept.mockReset();
        requestFlowEvidenceStoreMock.reset.mockReset();
        peerRelayEvidenceStoreMock.recordInboundRelay.mockReset();
        vi.mocked(getV090RolloutPolicy).mockReturnValue({
            stabilityModeEnabled: false,
            deterministicDiscoveryEnabled: false,
            protocolCoreEnabled: false,
            x3dhRatchetEnabled: false,
        });
  });

    it("does not let one runtime instance suppress another runtime's inbound event", async () => {
        const event = {
            id: "event-runtime-isolation",
            pubkey: SENDER_PUBLIC_KEY,
            kind: 4,
            created_at: 1200,
            content: "encrypted",
            tags: [["p", MY_PUBLIC_KEY]],
        } as unknown as NostrEvent;

        const persistMessage = vi.fn(async () => undefined);

        await handleIncomingDmEvent({
            event,
            currentParams: {
                myPrivateKeyHex: "private-key",
                myPublicKeyHex: MY_PUBLIC_KEY,
                peerTrust: {
                    isAccepted: () => true,
                    acceptPeer: vi.fn(),
                },
            },
            messageQueue: {
                getMessage: vi.fn(async () => null),
                persistMessage,
            } as any,
            processingEvents: new Set<string>([event.id]),
            failedDecryptEvents: new Set<string>(),
            existingMessages: [],
            maxMessagesInMemory: 100,
            syncConversationTimestamps: new Map<string, Date>(),
            activeSubscriptions: new Map(),
            scheduleUiUpdate: (fn) => fn(),
            setState: vi.fn(),
            createReadyState: (messages) => ({ messages }),
            messageMemoryManager: { addMessages: vi.fn() },
            uiPerformanceMonitor: { startTracking: () => () => ({ totalTime: 0 }) }
        });

        await handleIncomingDmEvent({
            event,
            currentParams: {
                myPrivateKeyHex: "private-key",
                myPublicKeyHex: MY_PUBLIC_KEY,
                peerTrust: {
                    isAccepted: () => true,
                    acceptPeer: vi.fn(),
                },
            },
            messageQueue: {
                getMessage: vi.fn(async () => null),
                persistMessage,
            } as any,
            processingEvents: new Set<string>(),
            failedDecryptEvents: new Set<string>(),
            existingMessages: [],
            maxMessagesInMemory: 100,
            syncConversationTimestamps: new Map<string, Date>(),
            activeSubscriptions: new Map(),
            scheduleUiUpdate: (fn) => fn(),
            setState: vi.fn(),
            createReadyState: (messages) => ({ messages }),
            messageMemoryManager: { addMessages: vi.fn() },
            uiPerformanceMonitor: { startTracking: () => () => ({ totalTime: 0 }) }
        });

        expect(persistMessage).toHaveBeenCalledTimes(1);
    });

    it("records inbound relay evidence for accepted peers when relay URL is known", async () => {
        const event = {
            id: "event-relay-evidence",
            pubkey: SENDER_PUBLIC_KEY,
            kind: 4,
            created_at: 1700,
            content: "encrypted",
            tags: [["p", MY_PUBLIC_KEY]],
        } as unknown as NostrEvent;

        await handleIncomingDmEvent({
            event,
            relayUrl: "wss://relay-observed.example",
            currentParams: {
                myPrivateKeyHex: "private-key",
                myPublicKeyHex: MY_PUBLIC_KEY,
                peerTrust: {
                    isAccepted: () => true,
                    acceptPeer: vi.fn(),
                },
            },
            messageQueue: {
                getMessage: vi.fn(async () => null),
                persistMessage: vi.fn(async () => undefined),
            } as any,
            processingEvents: new Set<string>(),
            failedDecryptEvents: new Set<string>(),
            existingMessages: [],
            maxMessagesInMemory: 100,
            syncConversationTimestamps: new Map<string, Date>(),
            activeSubscriptions: new Map(),
            scheduleUiUpdate: (fn) => fn(),
            setState: vi.fn(),
            createReadyState: (messages) => ({ messages }),
            messageMemoryManager: { addMessages: vi.fn() },
            uiPerformanceMonitor: { startTracking: () => () => ({ totalTime: 0 }) },
        });

        expect(peerRelayEvidenceStoreMock.recordInboundRelay).toHaveBeenCalledWith({
            peerPublicKeyHex: SENDER_PUBLIC_KEY,
            relayUrl: "wss://relay-observed.example",
        });
    });

    it("does not auto-create group chats from incoming community invites", async () => {
        const event = {
            id: "event-1",
            pubkey: SENDER_PUBLIC_KEY,
            kind: 1059,
            created_at: 1200,
            content: "encrypted",
            tags: [["p", MY_PUBLIC_KEY]]
        } as unknown as NostrEvent;

        const dispatchSpy = vi.spyOn(window, "dispatchEvent");
        const onNewMessage = vi.fn();

        await handleIncomingDmEvent({
            event,
            currentParams: {
                myPrivateKeyHex: "private-key",
                myPublicKeyHex: MY_PUBLIC_KEY,
                peerTrust: {
                    isAccepted: () => true,
                    acceptPeer: vi.fn(),
                },
                onNewMessage
            },
            messageQueue: null,
            processingEvents: new Set<string>(),
            failedDecryptEvents: new Set<string>(),
            existingMessages: [],
            maxMessagesInMemory: 100,
            syncConversationTimestamps: new Map<string, Date>(),
            activeSubscriptions: new Map(),
            scheduleUiUpdate: (fn) => fn(),
            setState: vi.fn(),
            createReadyState: (messages) => ({ messages }),
            messageMemoryManager: { addMessages: vi.fn() },
            uiPerformanceMonitor: { startTracking: () => () => ({ totalTime: 0 }) }
        });

        expect(dispatchSpy).not.toHaveBeenCalledWith(expect.objectContaining({ type: "obscur:group-invite" }));
        expect(onNewMessage).toHaveBeenCalledTimes(1);
        expect(onNewMessage.mock.calls[0]?.[0]?.content).toContain("\"community-invite\"");
    });

    it("applies incoming delete commands for sender-owned messages and suppresses command rendering", async () => {
        const targetMessageId = "target-msg-1";
        const deleteCommandEventId = "delete-cmd-1";
        const deleteCommandPayload = encodeCommandMessage(
            createDeleteCommandMessage(targetMessageId)
        );
        const event = {
            id: deleteCommandEventId,
            pubkey: SENDER_PUBLIC_KEY,
            kind: 4,
            created_at: 1260,
            content: "encrypted",
            tags: [["p", MY_PUBLIC_KEY], ["t", "message-delete"], ["e", targetMessageId]]
        } as unknown as NostrEvent;

        vi.mocked(cryptoService.decryptDM).mockResolvedValueOnce(deleteCommandPayload);

        const onMessageDeleted = vi.fn();
        const onNewMessage = vi.fn();
        const setState = vi.fn();

        await handleIncomingDmEvent({
            event,
            currentParams: {
                myPrivateKeyHex: "private-key",
                myPublicKeyHex: MY_PUBLIC_KEY,
                peerTrust: {
                    isAccepted: () => true,
                    acceptPeer: vi.fn(),
                },
                onMessageDeleted,
                onNewMessage,
            },
            messageQueue: {
                getMessage: vi.fn(async (id: string) => (
                    id === targetMessageId
                        ? {
                            id: targetMessageId,
                            senderPubkey: SENDER_PUBLIC_KEY,
                            conversationId: `${MY_PUBLIC_KEY}:${SENDER_PUBLIC_KEY}`,
                        }
                        : null
                )),
                persistMessage: vi.fn(async () => undefined),
            } as any,
            processingEvents: new Set<string>(),
            failedDecryptEvents: new Set<string>(),
            existingMessages: [],
            maxMessagesInMemory: 100,
            syncConversationTimestamps: new Map<string, Date>(),
            activeSubscriptions: new Map(),
            scheduleUiUpdate: (fn) => fn(),
            setState,
            createReadyState: (messages) => ({ messages }),
            messageMemoryManager: { addMessages: vi.fn() },
            uiPerformanceMonitor: { startTracking: () => () => ({ totalTime: 0 }) }
        });

        expect(onMessageDeleted).toHaveBeenCalledWith(expect.objectContaining({
            messageId: targetMessageId,
            deletionEventId: deleteCommandEventId,
        }));
        expect(onNewMessage).not.toHaveBeenCalled();
        expect(setState).toHaveBeenCalled();
    });

    it("applies delete commands using fallback e-tag target ids when payload id does not match local id", async () => {
        const wrapperTargetId = "wrapper-msg-legacy";
        const canonicalTargetId = "rumor-msg-canonical";
        const deleteCommandEventId = "delete-cmd-fallback";
        const deleteCommandPayload = encodeCommandMessage(
            createDeleteCommandMessage(wrapperTargetId)
        );
        const event = {
            id: deleteCommandEventId,
            pubkey: SENDER_PUBLIC_KEY,
            kind: 4,
            created_at: 1261,
            content: "encrypted",
            tags: [["p", MY_PUBLIC_KEY], ["t", "message-delete"], ["e", wrapperTargetId], ["e", canonicalTargetId]]
        } as unknown as NostrEvent;

        vi.mocked(cryptoService.decryptDM).mockResolvedValueOnce(deleteCommandPayload);

        const onMessageDeleted = vi.fn();

        await handleIncomingDmEvent({
            event,
            currentParams: {
                myPrivateKeyHex: "private-key",
                myPublicKeyHex: MY_PUBLIC_KEY,
                peerTrust: {
                    isAccepted: () => true,
                    acceptPeer: vi.fn(),
                },
                onMessageDeleted,
            },
            messageQueue: {
                getMessage: vi.fn(async (id: string) => (
                    id === canonicalTargetId
                        ? {
                            id: canonicalTargetId,
                            senderPubkey: SENDER_PUBLIC_KEY,
                            conversationId: `${MY_PUBLIC_KEY}:${SENDER_PUBLIC_KEY}`,
                        }
                        : null
                )),
                persistMessage: vi.fn(async () => undefined),
            } as any,
            processingEvents: new Set<string>(),
            failedDecryptEvents: new Set<string>(),
            existingMessages: [],
            maxMessagesInMemory: 100,
            syncConversationTimestamps: new Map<string, Date>(),
            activeSubscriptions: new Map(),
            scheduleUiUpdate: (fn) => fn(),
            setState: vi.fn(),
            createReadyState: (messages) => ({ messages }),
            messageMemoryManager: { addMessages: vi.fn() },
            uiPerformanceMonitor: { startTracking: () => () => ({ totalTime: 0 }) }
        });

        expect(onMessageDeleted).toHaveBeenCalledWith(expect.objectContaining({
            messageId: canonicalTargetId,
            deletionEventId: deleteCommandEventId,
        }));
    });

    it("emits group invite accepted event when recipient confirms community invite", async () => {
        const event = {
            id: "event-invite-accepted",
            pubkey: SENDER_PUBLIC_KEY,
            kind: 4,
            created_at: 1250,
            content: "encrypted",
            tags: [["p", MY_PUBLIC_KEY]]
        } as unknown as NostrEvent;

        vi.mocked(cryptoService.decryptDM).mockResolvedValueOnce(JSON.stringify({
            type: "community-invite-response",
            status: "accepted",
            groupId: "group-alpha",
            relayUrl: "wss://relay.example"
        }));

        const dispatchSpy = vi.spyOn(window, "dispatchEvent");

        await handleIncomingDmEvent({
            event,
            currentParams: {
                myPrivateKeyHex: "private-key",
                myPublicKeyHex: MY_PUBLIC_KEY,
                peerTrust: {
                    isAccepted: () => true,
                    acceptPeer: vi.fn(),
                },
            },
            messageQueue: {
                getMessage: vi.fn(async () => null),
                persistMessage: vi.fn(async () => undefined),
            } as any,
            processingEvents: new Set<string>(),
            failedDecryptEvents: new Set<string>(),
            existingMessages: [],
            maxMessagesInMemory: 100,
            syncConversationTimestamps: new Map<string, Date>(),
            activeSubscriptions: new Map(),
            scheduleUiUpdate: (fn) => fn(),
            setState: vi.fn(),
            createReadyState: (messages) => ({ messages }),
            messageMemoryManager: { addMessages: vi.fn() },
            uiPerformanceMonitor: { startTracking: () => () => ({ totalTime: 0 }) },
        });

        expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({
            type: "obscur:group-invite-response-accepted",
        }));
    });

    it("verifies v090_x3dr envelopes through protocol adapter before decrypting", async () => {
        const event = {
            id: "event-v090",
            pubkey: SENDER_PUBLIC_KEY,
            kind: 4,
            created_at: 1200,
            content: "cipher-v090",
            tags: [
                ["p", MY_PUBLIC_KEY],
                ["obscur-envelope-version", "v090_x3dr"],
                ["obscur-session-id", "session-a"],
                ["obscur-counter", "7"],
            ],
        } as unknown as NostrEvent;

        vi.mocked(getV090RolloutPolicy).mockReturnValue({
            stabilityModeEnabled: false,
            deterministicDiscoveryEnabled: false,
            protocolCoreEnabled: true,
            x3dhRatchetEnabled: true,
        });
        vi.mocked(protocolCoreAdapter.verifyMessageEnvelope).mockResolvedValue({
            ok: true,
            value: { ok: true, sessionId: "session-a", messageId: "event-v090", verifiedAtUnixMs: Date.now() },
        });

        const persistMessage = vi.fn(async () => undefined);

        await handleIncomingDmEvent({
            event,
            currentParams: {
                myPrivateKeyHex: "private-key",
                myPublicKeyHex: MY_PUBLIC_KEY,
                peerTrust: {
                    isAccepted: () => true,
                    acceptPeer: vi.fn(),
                },
            },
            messageQueue: {
                getMessage: vi.fn(async () => null),
                persistMessage,
            } as any,
            processingEvents: new Set<string>(),
            failedDecryptEvents: new Set<string>(),
            existingMessages: [],
            maxMessagesInMemory: 100,
            syncConversationTimestamps: new Map<string, Date>(),
            activeSubscriptions: new Map(),
            scheduleUiUpdate: (fn) => fn(),
            setState: vi.fn(),
            createReadyState: (messages) => ({ messages }),
            messageMemoryManager: { addMessages: vi.fn() },
            uiPerformanceMonitor: { startTracking: () => () => ({ totalTime: 0 }) },
        });

        expect(protocolCoreAdapter.verifyMessageEnvelope).toHaveBeenCalledWith({
            sessionId: "session-a",
            messageId: "event-v090",
            envelope: "cipher-v090",
            counter: 7,
        });
        expect(persistMessage).toHaveBeenCalledTimes(1);
    });

    it("drops v090_x3dr envelopes when protocol verification rejects", async () => {
        const event = {
            id: "event-rejected",
            pubkey: SENDER_PUBLIC_KEY,
            kind: 4,
            created_at: 1200,
            content: "cipher-v090",
            tags: [
                ["p", MY_PUBLIC_KEY],
                ["obscur-envelope-version", "v090_x3dr"],
                ["obscur-session-id", "session-a"],
            ],
        } as unknown as NostrEvent;

        vi.mocked(getV090RolloutPolicy).mockReturnValue({
            stabilityModeEnabled: false,
            deterministicDiscoveryEnabled: false,
            protocolCoreEnabled: true,
            x3dhRatchetEnabled: true,
        });
        vi.mocked(protocolCoreAdapter.verifyMessageEnvelope).mockResolvedValue({
            ok: true,
            value: { ok: false, reason: "replay_rejected", message: "duplicate" },
        });

        const persistMessage = vi.fn(async () => undefined);

        await handleIncomingDmEvent({
            event,
            currentParams: {
                myPrivateKeyHex: "private-key",
                myPublicKeyHex: MY_PUBLIC_KEY,
            },
            messageQueue: {
                getMessage: vi.fn(async () => null),
                persistMessage,
            } as any,
            processingEvents: new Set<string>(),
            failedDecryptEvents: new Set<string>(),
            existingMessages: [],
            maxMessagesInMemory: 100,
            syncConversationTimestamps: new Map<string, Date>(),
            activeSubscriptions: new Map(),
            scheduleUiUpdate: (fn) => fn(),
            setState: vi.fn(),
            createReadyState: (messages) => ({ messages }),
            messageMemoryManager: { addMessages: vi.fn() },
            uiPerformanceMonitor: { startTracking: () => () => ({ totalTime: 0 }) },
        });

        expect(protocolCoreAdapter.verifyMessageEnvelope).toHaveBeenCalledTimes(1);
        expect(persistMessage).not.toHaveBeenCalled();
    });

    it("allows tagged connection requests through contacts-only privacy mode", async () => {
        getPrivacySettingsMock.mockReturnValue({ dmPrivacy: "contacts-only" });
        const upsertIncoming = vi.fn();
        const sendConnectionReceiptAck = vi.fn(async () => undefined);
        const persistMessage = vi.fn(async () => undefined);
        const event = {
            id: "event-contacts-only-request",
            pubkey: SENDER_PUBLIC_KEY,
            kind: 4,
            created_at: 1200,
            content: "cipher-request",
            tags: [
                ["p", MY_PUBLIC_KEY],
                ["t", "connection-request"],
            ],
        } as unknown as NostrEvent;

        await handleIncomingDmEvent({
            event,
            currentParams: {
                myPrivateKeyHex: "private-key",
                myPublicKeyHex: MY_PUBLIC_KEY,
                peerTrust: {
                    isAccepted: () => false,
                    acceptPeer: vi.fn(),
                },
                requestsInbox: {
                    upsertIncoming,
                    getRequestStatus: () => null,
                    setStatus: vi.fn(),
                },
                sendConnectionReceiptAck,
            },
            messageQueue: {
                getMessage: vi.fn(async () => null),
                persistMessage,
            } as any,
            processingEvents: new Set<string>(),
            failedDecryptEvents: new Set<string>(),
            existingMessages: [],
            maxMessagesInMemory: 100,
            syncConversationTimestamps: new Map<string, Date>(),
            activeSubscriptions: new Map(),
            scheduleUiUpdate: (fn) => fn(),
            setState: vi.fn(),
            createReadyState: (messages) => ({ messages }),
            messageMemoryManager: { addMessages: vi.fn() },
            uiPerformanceMonitor: { startTracking: () => () => ({ totalTime: 0 }) },
        });

        expect(persistMessage).not.toHaveBeenCalled();
        expect(upsertIncoming).toHaveBeenCalledWith(expect.objectContaining({
            peerPublicKeyHex: SENDER_PUBLIC_KEY,
            isRequest: true,
            status: "pending",
            eventId: "event-contacts-only-request",
        }));
        expect(sendConnectionReceiptAck).toHaveBeenCalledWith({
            peerPublicKeyHex: SENDER_PUBLIC_KEY,
            requestEventId: "event-contacts-only-request",
        });
    });

    it("does not drop DM traffic in contacts-only mode when request status is already accepted", async () => {
        getPrivacySettingsMock.mockReturnValue({ dmPrivacy: "contacts-only" });
        const acceptPeer = vi.fn();
        const upsertIncoming = vi.fn();
        const persistMessage = vi.fn(async () => undefined);
        const event = {
            id: "event-accepted-request-state-dm",
            pubkey: SENDER_PUBLIC_KEY,
            kind: 4,
            created_at: 1201,
            content: "cipher-dm",
            tags: [["p", MY_PUBLIC_KEY]],
        } as unknown as NostrEvent;

        await handleIncomingDmEvent({
            event,
            currentParams: {
                myPrivateKeyHex: "private-key",
                myPublicKeyHex: MY_PUBLIC_KEY,
                peerTrust: {
                    isAccepted: () => false,
                    acceptPeer,
                },
                requestsInbox: {
                    upsertIncoming,
                    getRequestStatus: () => ({ status: "accepted", isOutgoing: false }),
                    setStatus: vi.fn(),
                },
            },
            messageQueue: {
                getMessage: vi.fn(async () => null),
                persistMessage,
            } as any,
            processingEvents: new Set<string>(),
            failedDecryptEvents: new Set<string>(),
            existingMessages: [],
            maxMessagesInMemory: 100,
            syncConversationTimestamps: new Map<string, Date>(),
            activeSubscriptions: new Map(),
            scheduleUiUpdate: (fn) => fn(),
            setState: vi.fn(),
            createReadyState: (messages) => ({ messages }),
            messageMemoryManager: { addMessages: vi.fn() },
            uiPerformanceMonitor: { startTracking: () => () => ({ totalTime: 0 }) },
        });

        expect(persistMessage).toHaveBeenCalledTimes(1);
        expect(upsertIncoming).not.toHaveBeenCalled();
        expect(acceptPeer).toHaveBeenCalledWith({ publicKeyHex: SENDER_PUBLIC_KEY });
    });

    it("refreshes outgoing pending state on connection receipt control message without persisting chat message", async () => {
        const setStatus = vi.fn();
        const persistMessage = vi.fn(async () => undefined);
        const event = {
            id: "event-connection-received",
            pubkey: SENDER_PUBLIC_KEY,
            kind: 4,
            created_at: 1300,
            content: "cipher-receipt",
            tags: [
                ["p", MY_PUBLIC_KEY],
                ["t", "connection-received"],
            ],
        } as unknown as NostrEvent;

        await handleIncomingDmEvent({
            event,
            currentParams: {
                myPrivateKeyHex: "private-key",
                myPublicKeyHex: MY_PUBLIC_KEY,
                requestsInbox: {
                    upsertIncoming: vi.fn(),
                    getRequestStatus: () => ({ status: "pending", isOutgoing: true }),
                    setStatus,
                },
            },
            messageQueue: {
                getMessage: vi.fn(async () => null),
                persistMessage,
            } as any,
            processingEvents: new Set<string>(),
            failedDecryptEvents: new Set<string>(),
            existingMessages: [],
            maxMessagesInMemory: 100,
            syncConversationTimestamps: new Map<string, Date>(),
            activeSubscriptions: new Map(),
            scheduleUiUpdate: (fn) => fn(),
            setState: vi.fn(),
            createReadyState: (messages) => ({ messages }),
            messageMemoryManager: { addMessages: vi.fn() },
            uiPerformanceMonitor: { startTracking: () => () => ({ totalTime: 0 }) },
        });

        expect(setStatus).toHaveBeenCalledWith({
            peerPublicKeyHex: SENDER_PUBLIC_KEY,
            status: "pending",
            isOutgoing: true,
        });
        expect(persistMessage).not.toHaveBeenCalled();
    });

    it("accepts a connection-accept reply when sender-side request evidence exists even if local status drifted", async () => {
        const acceptPeer = vi.fn();
        const setStatus = vi.fn();
        const onConnectionCreated = vi.fn();
        const persistMessage = vi.fn(async () => undefined);
        requestFlowEvidenceStoreMock.get.mockReturnValue({
            requestEventId: "request-evt-1",
            receiptAckSeen: true,
            acceptSeen: false,
        } as any);
        const event = {
            id: "event-connection-accept",
            pubkey: SENDER_PUBLIC_KEY,
            kind: 4,
            created_at: 1400,
            content: "cipher-accept",
            tags: [
                ["p", MY_PUBLIC_KEY],
                ["t", "connection-accept"],
            ],
        } as unknown as NostrEvent;

        await handleIncomingDmEvent({
            event,
            currentParams: {
                myPrivateKeyHex: "private-key",
                myPublicKeyHex: MY_PUBLIC_KEY,
                peerTrust: {
                    isAccepted: () => false,
                    acceptPeer,
                },
                requestsInbox: {
                    upsertIncoming: vi.fn(),
                    getRequestStatus: () => ({ status: "canceled", isOutgoing: true }),
                    setStatus,
                },
                onConnectionCreated,
            },
            messageQueue: {
                getMessage: vi.fn(async () => null),
                persistMessage,
            } as any,
            processingEvents: new Set<string>(),
            failedDecryptEvents: new Set<string>(),
            existingMessages: [],
            maxMessagesInMemory: 100,
            syncConversationTimestamps: new Map<string, Date>(),
            activeSubscriptions: new Map(),
            scheduleUiUpdate: (fn) => fn(),
            setState: vi.fn(),
            createReadyState: (messages) => ({ messages }),
            messageMemoryManager: { addMessages: vi.fn() },
            uiPerformanceMonitor: { startTracking: () => () => ({ totalTime: 0 }) },
        });

        expect(requestFlowEvidenceStoreMock.markAccept).toHaveBeenCalledWith({
            peerPublicKeyHex: SENDER_PUBLIC_KEY,
            requestEventId: undefined,
        });
        expect(acceptPeer).toHaveBeenCalledWith({ publicKeyHex: SENDER_PUBLIC_KEY });
        expect(setStatus).toHaveBeenCalledWith({
            peerPublicKeyHex: SENDER_PUBLIC_KEY,
            status: "accepted",
            isOutgoing: true,
        });
        expect(onConnectionCreated).toHaveBeenCalledWith(SENDER_PUBLIC_KEY);
        expect(persistMessage).toHaveBeenCalledTimes(1);
    });

    it("does not auto-accept a generic reply from a pending outgoing request", async () => {
        const acceptPeer = vi.fn();
        const upsertIncoming = vi.fn();
        requestFlowEvidenceStoreMock.get.mockReturnValue({
            requestEventId: "request-evt-2",
            receiptAckSeen: true,
            acceptSeen: false,
        } as any);
        const event = {
            id: "event-generic-reply",
            pubkey: SENDER_PUBLIC_KEY,
            kind: 4,
            created_at: 1450,
            content: "cipher-reply",
            tags: [["p", MY_PUBLIC_KEY]],
        } as unknown as NostrEvent;

        await handleIncomingDmEvent({
            event,
            currentParams: {
                myPrivateKeyHex: "private-key",
                myPublicKeyHex: MY_PUBLIC_KEY,
                peerTrust: {
                    isAccepted: () => false,
                    acceptPeer,
                },
                requestsInbox: {
                    upsertIncoming,
                    getRequestStatus: () => ({ status: "pending", isOutgoing: true }),
                    setStatus: vi.fn(),
                },
                onConnectionCreated: vi.fn(),
            },
            messageQueue: {
                getMessage: vi.fn(async () => null),
                persistMessage: vi.fn(async () => undefined),
            } as any,
            processingEvents: new Set<string>(),
            failedDecryptEvents: new Set<string>(),
            existingMessages: [],
            maxMessagesInMemory: 100,
            syncConversationTimestamps: new Map<string, Date>(),
            activeSubscriptions: new Map(),
            scheduleUiUpdate: (fn) => fn(),
            setState: vi.fn(),
            createReadyState: (messages) => ({ messages }),
            messageMemoryManager: { addMessages: vi.fn() },
            uiPerformanceMonitor: { startTracking: () => () => ({ totalTime: 0 }) },
        });

        expect(acceptPeer).not.toHaveBeenCalled();
        expect(upsertIncoming).toHaveBeenCalledWith(expect.objectContaining({
            peerPublicKeyHex: SENDER_PUBLIC_KEY,
            status: "pending",
        }));
    });

    it("keeps generic replies pending when only outgoing request evidence exists", async () => {
        const acceptPeer = vi.fn();
        const upsertIncoming = vi.fn();
        requestFlowEvidenceStoreMock.get.mockReturnValue({
            requestEventId: "request-evt-evidence-only",
            receiptAckSeen: false,
            acceptSeen: false,
        } as any);
        const event = {
            id: "event-generic-reply-evidence-only",
            pubkey: SENDER_PUBLIC_KEY,
            kind: 4,
            created_at: 1451,
            content: "cipher-reply",
            tags: [["p", MY_PUBLIC_KEY]],
        } as unknown as NostrEvent;

        await handleIncomingDmEvent({
            event,
            currentParams: {
                myPrivateKeyHex: "private-key",
                myPublicKeyHex: MY_PUBLIC_KEY,
                peerTrust: {
                    isAccepted: () => false,
                    acceptPeer,
                },
                requestsInbox: {
                    upsertIncoming,
                    getRequestStatus: () => null,
                    setStatus: vi.fn(),
                },
                onConnectionCreated: vi.fn(),
            },
            messageQueue: {
                getMessage: vi.fn(async () => null),
                persistMessage: vi.fn(async () => undefined),
            } as any,
            processingEvents: new Set<string>(),
            failedDecryptEvents: new Set<string>(),
            existingMessages: [],
            maxMessagesInMemory: 100,
            syncConversationTimestamps: new Map<string, Date>(),
            activeSubscriptions: new Map(),
            scheduleUiUpdate: (fn) => fn(),
            setState: vi.fn(),
            createReadyState: (messages) => ({ messages }),
            messageMemoryManager: { addMessages: vi.fn() },
            uiPerformanceMonitor: { startTracking: () => () => ({ totalTime: 0 }) },
        });

        expect(acceptPeer).not.toHaveBeenCalled();
        expect(upsertIncoming).toHaveBeenCalledWith(expect.objectContaining({
            peerPublicKeyHex: SENDER_PUBLIC_KEY,
            status: "pending",
            isRequest: false,
        }));
    });

    it("suppresses replayed pending-peer events across controller remounts", async () => {
        const upsertIncoming = vi.fn();
        const event = {
            id: "event-pending-peer-replay",
            pubkey: SENDER_PUBLIC_KEY,
            kind: 4,
            created_at: 1452,
            content: "cipher-reply",
            tags: [["p", MY_PUBLIC_KEY]],
        } as unknown as NostrEvent;

        const invokeHandler = async () => {
            await handleIncomingDmEvent({
                event,
                currentParams: {
                    myPrivateKeyHex: "private-key",
                    myPublicKeyHex: MY_PUBLIC_KEY,
                    peerTrust: {
                        isAccepted: () => false,
                        acceptPeer: vi.fn(),
                    },
                    requestsInbox: {
                        upsertIncoming,
                        getRequestStatus: () => ({ status: "pending", isOutgoing: true }),
                        setStatus: vi.fn(),
                    },
                },
                messageQueue: {
                    getMessage: vi.fn(async () => null),
                    persistMessage: vi.fn(async () => undefined),
                } as any,
                processingEvents: new Set<string>(),
                failedDecryptEvents: new Set<string>(),
                existingMessages: [],
                maxMessagesInMemory: 100,
                syncConversationTimestamps: new Map<string, Date>(),
                activeSubscriptions: new Map(),
                scheduleUiUpdate: (fn) => fn(),
                setState: vi.fn(),
                createReadyState: (messages) => ({ messages }),
                messageMemoryManager: { addMessages: vi.fn() },
                uiPerformanceMonitor: { startTracking: () => () => ({ totalTime: 0 }) },
            });
        };

        await invokeHandler();
        await invokeHandler();

        expect(upsertIncoming).toHaveBeenCalledTimes(1);
    });

    it("drops unknown non-request DMs from unaccepted peers to prevent request inbox spam", async () => {
        const upsertIncoming = vi.fn();
        const persistMessage = vi.fn(async () => undefined);
        const event = {
            id: "event-unknown-non-request",
            pubkey: SENDER_PUBLIC_KEY,
            kind: 4,
            created_at: 1455,
            content: "cipher-unknown",
            tags: [["p", MY_PUBLIC_KEY]],
        } as unknown as NostrEvent;

        await handleIncomingDmEvent({
            event,
            currentParams: {
                myPrivateKeyHex: "private-key",
                myPublicKeyHex: MY_PUBLIC_KEY,
                peerTrust: {
                    isAccepted: () => false,
                    acceptPeer: vi.fn(),
                },
                requestsInbox: {
                    upsertIncoming,
                    getRequestStatus: () => null,
                    setStatus: vi.fn(),
                },
            },
            messageQueue: {
                getMessage: vi.fn(async () => null),
                persistMessage,
            } as any,
            processingEvents: new Set<string>(),
            failedDecryptEvents: new Set<string>(),
            existingMessages: [],
            maxMessagesInMemory: 100,
            syncConversationTimestamps: new Map<string, Date>(),
            activeSubscriptions: new Map(),
            scheduleUiUpdate: (fn) => fn(),
            setState: vi.fn(),
            createReadyState: (messages) => ({ messages }),
            messageMemoryManager: { addMessages: vi.fn() },
            uiPerformanceMonitor: { startTracking: () => () => ({ totalTime: 0 }) },
        });

        expect(upsertIncoming).not.toHaveBeenCalled();
        expect(persistMessage).not.toHaveBeenCalled();
    });

    it("deduplicates repeated connection-request events to avoid request inbox churn", async () => {
        const upsertIncoming = vi.fn();
        const sharedHandled = new Set<string>();
        const event = {
            id: "event-connection-request-duplicate",
            pubkey: SENDER_PUBLIC_KEY,
            kind: 4,
            created_at: 1458,
            content: "cipher-request",
            tags: [
                ["p", MY_PUBLIC_KEY],
                ["t", "connection-request"],
            ],
        } as unknown as NostrEvent;

        const baseParams = {
            event,
            currentParams: {
                myPrivateKeyHex: "private-key",
                myPublicKeyHex: MY_PUBLIC_KEY,
                peerTrust: {
                    isAccepted: () => false,
                    acceptPeer: vi.fn(),
                },
                requestsInbox: {
                    upsertIncoming,
                    getRequestStatus: () => null,
                    setStatus: vi.fn(),
                },
            },
            messageQueue: {
                getMessage: vi.fn(async () => null),
                persistMessage: vi.fn(async () => undefined),
            } as any,
            handledIncomingEventIds: sharedHandled,
            existingMessages: [],
            maxMessagesInMemory: 100,
            syncConversationTimestamps: new Map<string, Date>(),
            activeSubscriptions: new Map(),
            scheduleUiUpdate: (fn: () => void) => fn(),
            setState: vi.fn(),
            createReadyState: (messages: unknown) => ({ messages }),
            messageMemoryManager: { addMessages: vi.fn() },
            uiPerformanceMonitor: { startTracking: () => () => ({ totalTime: 0 }) },
        } as const;

        await handleIncomingDmEvent({
            ...baseParams,
            processingEvents: new Set<string>(),
            failedDecryptEvents: new Set<string>(),
        });
        await handleIncomingDmEvent({
            ...baseParams,
            processingEvents: new Set<string>(),
            failedDecryptEvents: new Set<string>(),
        });

        expect(upsertIncoming).toHaveBeenCalledTimes(1);
        expect(requestFlowEvidenceStoreMock.markRequestPublished).toHaveBeenCalledTimes(1);
    });

    it("quarantines connection-request bursts from the same unknown sender with reason-coded diagnostics", async () => {
        const upsertIncoming = vi.fn();
        const setStatus = vi.fn();
        const persistMessage = vi.fn(async () => undefined);

        const createEvent = (id: string, createdAt: number): NostrEvent => ({
            id,
            pubkey: SENDER_PUBLIC_KEY,
            kind: 4,
            created_at: createdAt,
            content: `cipher-request-${id}`,
            tags: [
                ["p", MY_PUBLIC_KEY],
                ["t", "connection-request"],
            ],
        } as unknown as NostrEvent);

        const run = async (event: NostrEvent) => {
            await handleIncomingDmEvent({
                event,
                currentParams: {
                    myPrivateKeyHex: "private-key",
                    myPublicKeyHex: MY_PUBLIC_KEY,
                    peerTrust: {
                        isAccepted: () => false,
                        acceptPeer: vi.fn(),
                    },
                    requestsInbox: {
                        upsertIncoming,
                        getRequestStatus: () => null,
                        setStatus,
                    },
                },
                messageQueue: {
                    getMessage: vi.fn(async () => null),
                    persistMessage,
                } as any,
                processingEvents: new Set<string>(),
                failedDecryptEvents: new Set<string>(),
                existingMessages: [],
                maxMessagesInMemory: 100,
                syncConversationTimestamps: new Map<string, Date>(),
                activeSubscriptions: new Map(),
                scheduleUiUpdate: (fn) => fn(),
                setState: vi.fn(),
                createReadyState: (messages) => ({ messages }),
                messageMemoryManager: { addMessages: vi.fn() },
                uiPerformanceMonitor: { startTracking: () => () => ({ totalTime: 0 }) },
            });
        };

        await run(createEvent("event-connection-request-burst-1", 2001));
        await run(createEvent("event-connection-request-burst-2", 2002));
        await run(createEvent("event-connection-request-burst-3", 2003));
        await run(createEvent("event-connection-request-burst-4", 2004));

        expect(upsertIncoming).toHaveBeenCalledTimes(3);
        expect(requestFlowEvidenceStoreMock.markRequestPublished).toHaveBeenCalledTimes(3);
        expect(setStatus).not.toHaveBeenCalled();
        expect(persistMessage).not.toHaveBeenCalled();
    });

    it("deduplicates gift-wrap rumors replayed via different wrapper event IDs", async () => {
        const persistMessage = vi.fn(async () => undefined);
        const sharedHandled = new Set<string>();
        const firstWrapper = {
            id: "event-wrapper-1",
            pubkey: SENDER_PUBLIC_KEY,
            kind: 1059,
            created_at: 1461,
            content: "cipher-wrap-1",
            tags: [["p", MY_PUBLIC_KEY]],
        } as unknown as NostrEvent;
        const secondWrapper = {
            id: "event-wrapper-2",
            pubkey: SENDER_PUBLIC_KEY,
            kind: 1059,
            created_at: 1462,
            content: "cipher-wrap-2",
            tags: [["p", MY_PUBLIC_KEY]],
        } as unknown as NostrEvent;

        const baseParams = {
            currentParams: {
                myPrivateKeyHex: "private-key",
                myPublicKeyHex: MY_PUBLIC_KEY,
                peerTrust: {
                    isAccepted: () => true,
                    acceptPeer: vi.fn(),
                },
            },
            messageQueue: {
                getMessage: vi.fn(async () => null),
                persistMessage,
            } as any,
            handledIncomingEventIds: sharedHandled,
            existingMessages: [],
            maxMessagesInMemory: 100,
            syncConversationTimestamps: new Map<string, Date>(),
            activeSubscriptions: new Map(),
            scheduleUiUpdate: (fn: () => void) => fn(),
            setState: vi.fn(),
            createReadyState: (messages: unknown) => ({ messages }),
            messageMemoryManager: { addMessages: vi.fn() },
            uiPerformanceMonitor: { startTracking: () => () => ({ totalTime: 0 }) },
        } as const;

        await handleIncomingDmEvent({
            ...baseParams,
            event: firstWrapper,
            processingEvents: new Set<string>(),
            failedDecryptEvents: new Set<string>(),
        });
        await handleIncomingDmEvent({
            ...baseParams,
            event: secondWrapper,
            processingEvents: new Set<string>(),
            failedDecryptEvents: new Set<string>(),
        });

        expect(persistMessage).toHaveBeenCalledTimes(1);
    });

    it("does not treat stale accept-only evidence as active outgoing request context", async () => {
        const acceptPeer = vi.fn();
        const setStatus = vi.fn();
        const upsertIncoming = vi.fn();
        requestFlowEvidenceStoreMock.get.mockReturnValue({
            requestEventId: undefined,
            receiptAckSeen: false,
            acceptSeen: true,
        } as any);
        const event = {
            id: "event-generic-reply-after-remove",
            pubkey: SENDER_PUBLIC_KEY,
            kind: 4,
            created_at: 1460,
            content: "cipher-reply",
            tags: [["p", MY_PUBLIC_KEY]],
        } as unknown as NostrEvent;

        await handleIncomingDmEvent({
            event,
            currentParams: {
                myPrivateKeyHex: "private-key",
                myPublicKeyHex: MY_PUBLIC_KEY,
                peerTrust: {
                    isAccepted: () => false,
                    acceptPeer,
                },
                requestsInbox: {
                    upsertIncoming,
                    getRequestStatus: () => null,
                    setStatus,
                },
            },
            messageQueue: {
                getMessage: vi.fn(async () => null),
                persistMessage: vi.fn(async () => undefined),
            } as any,
            processingEvents: new Set<string>(),
            failedDecryptEvents: new Set<string>(),
            existingMessages: [],
            maxMessagesInMemory: 100,
            syncConversationTimestamps: new Map<string, Date>(),
            activeSubscriptions: new Map(),
            scheduleUiUpdate: (fn) => fn(),
            setState: vi.fn(),
            createReadyState: (messages) => ({ messages }),
            messageMemoryManager: { addMessages: vi.fn() },
            uiPerformanceMonitor: { startTracking: () => () => ({ totalTime: 0 }) },
        });

        expect(acceptPeer).not.toHaveBeenCalled();
        expect(setStatus).not.toHaveBeenCalledWith(expect.objectContaining({ status: "accepted" }));
        expect(upsertIncoming).not.toHaveBeenCalled();
    });

    it("routes to accepted chat when projection shows accepted but local request state is stale pending", async () => {
        const acceptPeer = vi.fn();
        const setStatus = vi.fn();
        const upsertIncoming = vi.fn();
        const persistMessage = vi.fn(async () => undefined);
        requestFlowEvidenceStoreMock.get.mockReturnValue({
            requestEventId: undefined,
            receiptAckSeen: false,
            acceptSeen: false,
        } as any);
        const event = {
            id: "event-projection-accepted-routes-chat",
            pubkey: SENDER_PUBLIC_KEY,
            kind: 4,
            created_at: 1465,
            content: "cipher-projection-accepted",
            tags: [["p", MY_PUBLIC_KEY]],
        } as unknown as NostrEvent;

        await handleIncomingDmEvent({
            event,
            currentParams: {
                myPrivateKeyHex: "private-key",
                myPublicKeyHex: MY_PUBLIC_KEY,
                isProjectionAcceptedPeer: () => true,
                peerTrust: {
                    isAccepted: () => false,
                    acceptPeer,
                },
                requestsInbox: {
                    upsertIncoming,
                    getRequestStatus: () => ({ status: "pending", isOutgoing: false }),
                    setStatus,
                },
            },
            messageQueue: {
                getMessage: vi.fn(async () => null),
                persistMessage,
            } as any,
            processingEvents: new Set<string>(),
            failedDecryptEvents: new Set<string>(),
            existingMessages: [],
            maxMessagesInMemory: 100,
            syncConversationTimestamps: new Map<string, Date>(),
            activeSubscriptions: new Map(),
            scheduleUiUpdate: (fn) => fn(),
            setState: vi.fn(),
            createReadyState: (messages) => ({ messages }),
            messageMemoryManager: { addMessages: vi.fn() },
            uiPerformanceMonitor: { startTracking: () => () => ({ totalTime: 0 }) },
        });

        expect(persistMessage).toHaveBeenCalledTimes(1);
        expect(acceptPeer).toHaveBeenCalledWith({ publicKeyHex: SENDER_PUBLIC_KEY });
        expect(setStatus).toHaveBeenCalledWith({
            peerPublicKeyHex: SENDER_PUBLIC_KEY,
            status: "accepted",
            isOutgoing: false,
        });
        expect(upsertIncoming).not.toHaveBeenCalled();
    });

    it("marks outgoing requests as declined when a decline event arrives", async () => {
        const setStatus = vi.fn();
        const persistMessage = vi.fn(async () => undefined);
        const event = {
            id: "event-connection-decline",
            pubkey: SENDER_PUBLIC_KEY,
            kind: 4,
            created_at: 1500,
            content: "cipher-decline",
            tags: [
                ["p", MY_PUBLIC_KEY],
                ["t", "connection-decline"],
                ["e", "request-evt-9"],
            ],
        } as unknown as NostrEvent;

        await handleIncomingDmEvent({
            event,
            currentParams: {
                myPrivateKeyHex: "private-key",
                myPublicKeyHex: MY_PUBLIC_KEY,
                requestsInbox: {
                    upsertIncoming: vi.fn(),
                    getRequestStatus: () => ({ status: "pending", isOutgoing: true }),
                    setStatus,
                },
            },
            messageQueue: {
                getMessage: vi.fn(async () => null),
                persistMessage,
            } as any,
            processingEvents: new Set<string>(),
            failedDecryptEvents: new Set<string>(),
            existingMessages: [],
            maxMessagesInMemory: 100,
            syncConversationTimestamps: new Map<string, Date>(),
            activeSubscriptions: new Map(),
            scheduleUiUpdate: (fn) => fn(),
            setState: vi.fn(),
            createReadyState: (messages) => ({ messages }),
            messageMemoryManager: { addMessages: vi.fn() },
            uiPerformanceMonitor: { startTracking: () => () => ({ totalTime: 0 }) },
        });

        expect(setStatus).toHaveBeenCalledWith({
            peerPublicKeyHex: SENDER_PUBLIC_KEY,
            status: "declined",
            isOutgoing: true,
        });
        expect(requestFlowEvidenceStoreMock.reset).toHaveBeenCalledWith(SENDER_PUBLIC_KEY);
        expect(persistMessage).not.toHaveBeenCalled();
    });

    it("hydrates self-authored relay sync events into outgoing history", async () => {
        const persistMessage = vi.fn(async () => undefined);
        const event = {
            id: "event-self-authored-sync",
            pubkey: MY_PUBLIC_KEY,
            kind: 4,
            created_at: 1499,
            content: "cipher-self-authored",
            tags: [["p", SENDER_PUBLIC_KEY]],
        } as unknown as NostrEvent;

        await handleIncomingDmEvent({
            event,
            currentParams: {
                myPrivateKeyHex: "private-key",
                myPublicKeyHex: MY_PUBLIC_KEY,
                peerTrust: {
                    isAccepted: () => false,
                    acceptPeer: vi.fn(),
                },
            },
            messageQueue: {
                getMessage: vi.fn(async () => null),
                persistMessage,
            } as any,
            processingEvents: new Set<string>(),
            failedDecryptEvents: new Set<string>(),
            existingMessages: [],
            maxMessagesInMemory: 100,
            syncConversationTimestamps: new Map<string, Date>(),
            activeSubscriptions: new Map(),
            scheduleUiUpdate: (fn) => fn(),
            setState: vi.fn(),
            createReadyState: (messages) => ({ messages }),
            messageMemoryManager: { addMessages: vi.fn() },
            uiPerformanceMonitor: { startTracking: () => () => ({ totalTime: 0 }) },
        });

        expect(cryptoService.decryptDM).toHaveBeenCalledWith(
            "cipher-self-authored",
            SENDER_PUBLIC_KEY,
            "private-key",
        );
        expect(persistMessage).toHaveBeenCalledWith(expect.objectContaining({
            id: "event-self-authored-sync",
            conversationId: [MY_PUBLIC_KEY, SENDER_PUBLIC_KEY].sort().join(":"),
            isOutgoing: true,
            senderPubkey: MY_PUBLIC_KEY,
            recipientPubkey: SENDER_PUBLIC_KEY,
            status: "delivered",
        }));
    });

    it("marks incoming requests as canceled when a cancel event arrives", async () => {
        const setStatus = vi.fn();
        const persistMessage = vi.fn(async () => undefined);
        const event = {
            id: "event-connection-cancel",
            pubkey: SENDER_PUBLIC_KEY,
            kind: 4,
            created_at: 1510,
            content: "cipher-cancel",
            tags: [
                ["p", MY_PUBLIC_KEY],
                ["t", "connection-cancel"],
                ["e", "request-evt-10"],
            ],
        } as unknown as NostrEvent;

        await handleIncomingDmEvent({
            event,
            currentParams: {
                myPrivateKeyHex: "private-key",
                myPublicKeyHex: MY_PUBLIC_KEY,
                requestsInbox: {
                    upsertIncoming: vi.fn(),
                    getRequestStatus: () => ({ status: "pending", isOutgoing: false }),
                    setStatus,
                },
            },
            messageQueue: {
                getMessage: vi.fn(async () => null),
                persistMessage,
            } as any,
            processingEvents: new Set<string>(),
            failedDecryptEvents: new Set<string>(),
            existingMessages: [],
            maxMessagesInMemory: 100,
            syncConversationTimestamps: new Map<string, Date>(),
            activeSubscriptions: new Map(),
            scheduleUiUpdate: (fn) => fn(),
            setState: vi.fn(),
            createReadyState: (messages) => ({ messages }),
            messageMemoryManager: { addMessages: vi.fn() },
            uiPerformanceMonitor: { startTracking: () => () => ({ totalTime: 0 }) },
        });

        expect(setStatus).toHaveBeenCalledWith({
            peerPublicKeyHex: SENDER_PUBLIC_KEY,
            status: "canceled",
            isOutgoing: false,
        });
        expect(requestFlowEvidenceStoreMock.reset).toHaveBeenCalledWith(SENDER_PUBLIC_KEY);
        expect(persistMessage).not.toHaveBeenCalled();
    });

    it("retries a transient decrypt failure on a later pass", async () => {
        const event = {
            id: "event-transient-decrypt",
            pubkey: SENDER_PUBLIC_KEY,
            kind: 4,
            created_at: 1600,
            content: "cipher-transient",
            tags: [["p", MY_PUBLIC_KEY]],
        } as unknown as NostrEvent;

        const persistMessage = vi.fn(async () => undefined);
        const decryptSpy = vi.mocked(cryptoService.decryptDM);
        decryptSpy
            .mockRejectedValueOnce(new Error("network timeout"))
            .mockResolvedValueOnce("hello after retry");

        const baseParams = {
            event,
            currentParams: {
                myPrivateKeyHex: "private-key",
                myPublicKeyHex: MY_PUBLIC_KEY,
                peerTrust: {
                    isAccepted: () => true,
                    acceptPeer: vi.fn(),
                },
            },
            messageQueue: {
                getMessage: vi.fn(async () => null),
                persistMessage,
            } as any,
            existingMessages: [],
            maxMessagesInMemory: 100,
            syncConversationTimestamps: new Map<string, Date>(),
            activeSubscriptions: new Map(),
            scheduleUiUpdate: (fn: () => void) => fn(),
            setState: vi.fn(),
            createReadyState: (messages: unknown) => ({ messages }),
            messageMemoryManager: { addMessages: vi.fn() },
            uiPerformanceMonitor: { startTracking: () => () => ({ totalTime: 0 }) },
        } as const;

        await handleIncomingDmEvent({
            ...baseParams,
            processingEvents: new Set<string>(),
            failedDecryptEvents: new Set<string>(),
        });

        await handleIncomingDmEvent({
            ...baseParams,
            processingEvents: new Set<string>(),
            failedDecryptEvents: new Set<string>(),
        });

        expect(persistMessage).toHaveBeenCalledTimes(1);
    });

    it("suppresses permanently malformed decrypt failures", async () => {
        const event = {
            id: "event-malformed-decrypt",
            pubkey: SENDER_PUBLIC_KEY,
            kind: 4,
            created_at: 1601,
            content: "cipher-malformed",
            tags: [["p", MY_PUBLIC_KEY]],
        } as unknown as NostrEvent;

        const persistMessage = vi.fn(async () => undefined);
        const decryptSpy = vi.mocked(cryptoService.decryptDM);
        decryptSpy.mockRejectedValue(new Error("invalid ciphertext"));

        const sharedFailedSet = new Set<string>();
        const baseParams = {
            event,
            currentParams: {
                myPrivateKeyHex: "private-key",
                myPublicKeyHex: MY_PUBLIC_KEY,
            },
            messageQueue: {
                getMessage: vi.fn(async () => null),
                persistMessage,
            } as any,
            existingMessages: [],
            maxMessagesInMemory: 100,
            syncConversationTimestamps: new Map<string, Date>(),
            activeSubscriptions: new Map(),
            scheduleUiUpdate: (fn: () => void) => fn(),
            setState: vi.fn(),
            createReadyState: (messages: unknown) => ({ messages }),
            messageMemoryManager: { addMessages: vi.fn() },
            uiPerformanceMonitor: { startTracking: () => () => ({ totalTime: 0 }) },
        } as const;

        await handleIncomingDmEvent({
            ...baseParams,
            processingEvents: new Set<string>(),
            failedDecryptEvents: sharedFailedSet,
        });
        await handleIncomingDmEvent({
            ...baseParams,
            processingEvents: new Set<string>(),
            failedDecryptEvents: sharedFailedSet,
        });

        expect(persistMessage).not.toHaveBeenCalled();
        expect(sharedFailedSet.has("event-malformed-decrypt")).toBe(true);
    });
});
