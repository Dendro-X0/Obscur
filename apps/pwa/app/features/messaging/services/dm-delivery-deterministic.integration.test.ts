import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { NostrEvent } from "@dweb/nostr/nostr-event";
import { handleIncomingDmEvent } from "../controllers/incoming-dm-event-handler";
import {
  publishOutgoingDm,
  publishQueuedOutgoingMessage,
  queueOutgoingDmForRetry,
} from "../controllers/outgoing-dm-publisher";
import type { IMessageQueue, Message, MessageStatus, OutgoingMessage } from "../lib/message-queue";
import type { Subscription } from "../controllers/dm-controller-state";
import type { TwoUserDeterministicRunReport, TwoUserDeterministicRunStep } from "./request-flow-contracts";

const USER_A = "a".repeat(64) as PublicKeyHex;
const USER_B = "b".repeat(64) as PublicKeyHex;
const PRIVATE_A = "1".repeat(64);
const PRIVATE_B = "2".repeat(64);

type QueueSnapshot = Readonly<{
  messages: ReadonlyArray<Message>;
  queued: ReadonlyArray<OutgoingMessage>;
}>;

class InMemoryMessageQueue implements IMessageQueue {
  private readonly messages = new Map<string, Message>();
  private readonly queuedMessages = new Map<string, OutgoingMessage>();

  constructor(seed?: QueueSnapshot) {
    seed?.messages.forEach((message) => {
      this.messages.set(message.id, {
        ...message,
        timestamp: new Date(message.timestamp),
        eventCreatedAt: message.eventCreatedAt ? new Date(message.eventCreatedAt) : undefined,
      });
    });
    seed?.queued.forEach((message) => {
      this.queuedMessages.set(message.id, {
        ...message,
        createdAt: new Date(message.createdAt),
        nextRetryAt: new Date(message.nextRetryAt),
      });
    });
  }

  snapshot(): QueueSnapshot {
    return {
      messages: Array.from(this.messages.values()).map((message) => ({
        ...message,
        timestamp: new Date(message.timestamp),
        eventCreatedAt: message.eventCreatedAt ? new Date(message.eventCreatedAt) : undefined,
      })),
      queued: Array.from(this.queuedMessages.values()).map((message) => ({
        ...message,
        createdAt: new Date(message.createdAt),
        nextRetryAt: new Date(message.nextRetryAt),
      })),
    };
  }

  async persistMessage(message: Message): Promise<void> {
    this.messages.set(message.id, { ...message });
  }

  async updateMessageStatus(messageId: string, status: MessageStatus): Promise<void> {
    const existing = this.messages.get(messageId);
    if (!existing) return;
    this.messages.set(messageId, { ...existing, status });
  }

  async getMessage(messageId: string): Promise<Message | null> {
    return this.messages.get(messageId) ?? null;
  }

  async getMessages(conversationId: string): Promise<Message[]> {
    return Array.from(this.messages.values()).filter((message) => message.conversationId === conversationId);
  }

  async queueOutgoingMessage(message: OutgoingMessage): Promise<void> {
    this.queuedMessages.set(message.id, { ...message });
  }

  async getQueuedMessages(): Promise<OutgoingMessage[]> {
    return Array.from(this.queuedMessages.values());
  }

  async removeFromQueue(messageId: string): Promise<void> {
    this.queuedMessages.delete(messageId);
  }

  async getLastMessageTimestamp(): Promise<Date | null> {
    return null;
  }

  async markMessagesSynced(): Promise<void> {}

  async cleanupOldMessages(): Promise<void> {}

  async getStorageUsage() {
    return {
      totalMessages: this.messages.size,
      totalSizeBytes: 0,
    };
  }

  async getAllMessages(): Promise<Message[]> {
    return Array.from(this.messages.values());
  }
}

type RelayMailbox = Readonly<{
  deliverableEvents: ReadonlyArray<NostrEvent>;
}>;

const createRelayMailbox = (): {
  push: (event: NostrEvent) => void;
  snapshot: () => RelayMailbox;
} => {
  const deliverableEvents: NostrEvent[] = [];
  return {
    push: (event) => {
      deliverableEvents.push(event);
    },
    snapshot: () => ({
      deliverableEvents: deliverableEvents.map((event) => ({ ...event, tags: event.tags.map((tag) => [...tag]) })),
    }),
  };
};

const buildMessage = (params: Readonly<{
  id: string;
  content: string;
  senderPubkey: PublicKeyHex;
  recipientPubkey: PublicKeyHex;
}>): Message => ({
  id: params.id,
  conversationId: [params.senderPubkey, params.recipientPubkey].sort().join(":"),
  content: params.content,
  kind: "user",
  timestamp: new Date(),
  isOutgoing: true,
  status: "sending",
  eventId: params.id,
  senderPubkey: params.senderPubkey,
  recipientPubkey: params.recipientPubkey,
  encryptedContent: `encrypted_${params.content}`,
  dmFormat: "nip04",
});

const buildSignedEvent = (params: Readonly<{
  id: string;
  senderPubkey: PublicKeyHex;
  recipientPubkey: PublicKeyHex;
  plaintext: string;
}>): NostrEvent => ({
  id: params.id,
  kind: 4,
  created_at: Math.floor(Date.now() / 1000),
  pubkey: params.senderPubkey,
  sig: "sig",
  content: `encrypted_${params.plaintext}`,
  tags: [["p", params.recipientPubkey]],
});

const createReadyState = (messages: ReadonlyArray<Message>) => ({ messages: [...messages] });

const buildStep = (name: string, passed: boolean, detail?: string): TwoUserDeterministicRunStep => ({
  name,
  passed,
  detail,
});

const runDirectionalDelivery = async (params: Readonly<{
  messageId: string;
  plaintext: string;
  senderPubkey: PublicKeyHex;
  senderPrivateKeyHex: string;
  recipientPubkey: PublicKeyHex;
  recipientPrivateKeyHex: string;
  senderQueue: InMemoryMessageQueue;
  receiverQueue: InMemoryMessageQueue;
}>): Promise<Readonly<{
  senderQueue: InMemoryMessageQueue;
  receiverQueue: InMemoryMessageQueue;
  senderMessageStatus: MessageStatus | undefined;
  receiverDelivered: boolean;
  queuedBeforeRestartCount: number;
  queuedAfterRetryCount: number;
}>> => {
  const relayMailbox = createRelayMailbox();
  const initialMessage = buildMessage({
    id: params.messageId,
    content: params.plaintext,
    senderPubkey: params.senderPubkey,
    recipientPubkey: params.recipientPubkey,
  });
  await params.senderQueue.persistMessage(initialMessage);

  const signedEvent = buildSignedEvent({
    id: params.messageId,
    senderPubkey: params.senderPubkey,
    recipientPubkey: params.recipientPubkey,
    plaintext: params.plaintext,
  });

  await publishOutgoingDm({
    pool: {
      sendToOpen: vi.fn(),
      connections: [],
      waitForConnection: async () => false,
    },
    openRelays: [],
    messageQueue: params.senderQueue,
    initialMessage,
    build: {
      format: "nip04",
      signedEvent,
      encryptedContent: signedEvent.content,
      canonicalEventId: signedEvent.id,
    },
    plaintext: params.plaintext,
    recipientPubkey: params.recipientPubkey,
    senderPubkey: params.senderPubkey,
    senderPrivateKeyHex: params.senderPrivateKeyHex as any,
    createdAtUnixSeconds: signedEvent.created_at,
    tags: [["p", params.recipientPubkey]],
  });

  const queuedBeforeRestart = await params.senderQueue.getQueuedMessages();
  const restartedSenderQueue = new InMemoryMessageQueue(params.senderQueue.snapshot());
  const queuedAfterRestart = await restartedSenderQueue.getQueuedMessages();
  if (!queuedAfterRestart[0]) {
    return {
      senderQueue: restartedSenderQueue,
      receiverQueue: params.receiverQueue,
      senderMessageStatus: undefined,
      receiverDelivered: false,
      queuedBeforeRestartCount: queuedBeforeRestart.length,
      queuedAfterRetryCount: 0,
    };
  }

  await publishQueuedOutgoingMessage({
    pool: {
      sendToOpen: vi.fn(),
      publishToAll: vi.fn(async (payload: string) => {
        const [, publishedEvent] = JSON.parse(payload) as [string, NostrEvent];
        relayMailbox.push(publishedEvent);
        return {
          success: false,
          successCount: 1,
          totalRelays: 2,
          metQuorum: false,
          results: [
            { relayUrl: "wss://relay-1.example", success: true },
            { relayUrl: "wss://relay-2.example", success: false, error: "503" },
          ],
        };
      }),
    } as any,
    messageQueue: restartedSenderQueue,
    message: queuedAfterRestart[0],
    openRelays: [{ url: "wss://relay-1.example" }, { url: "wss://relay-2.example" }],
  });
  await restartedSenderQueue.removeFromQueue(params.messageId);

  let receiverState = createReadyState(await params.receiverQueue.getAllMessages());
  const deliveredEvent = relayMailbox.snapshot().deliverableEvents[0];
  if (!deliveredEvent) {
    return {
      senderQueue: restartedSenderQueue,
      receiverQueue: params.receiverQueue,
      senderMessageStatus: (await restartedSenderQueue.getMessage(params.messageId))?.status,
      receiverDelivered: false,
      queuedBeforeRestartCount: queuedBeforeRestart.length,
      queuedAfterRetryCount: (await restartedSenderQueue.getQueuedMessages()).length,
    };
  }

  await handleIncomingDmEvent({
    event: deliveredEvent,
    currentParams: {
      myPrivateKeyHex: params.recipientPrivateKeyHex,
      myPublicKeyHex: params.recipientPubkey,
      peerTrust: {
        isAccepted: ({ publicKeyHex }) => publicKeyHex === params.senderPubkey,
        acceptPeer: () => undefined,
      },
      requestsInbox: {
        upsertIncoming: () => undefined,
        getRequestStatus: () => null,
        setStatus: () => undefined,
      },
    },
    messageQueue: params.receiverQueue,
    processingEvents: new Set<string>(),
    failedDecryptEvents: new Set<string>(),
    existingMessages: receiverState.messages,
    maxMessagesInMemory: 200,
    syncConversationTimestamps: new Map<string, Date>(),
    activeSubscriptions: new Map<string, Subscription>(),
    scheduleUiUpdate: (fn) => fn(),
    setState: (next) => {
      receiverState = typeof next === "function" ? next(receiverState) : next;
    },
    createReadyState,
    messageMemoryManager: { addMessages: () => undefined },
    uiPerformanceMonitor: { startTracking: () => () => ({ totalTime: 0 }) },
  });

  const receiverMessage = await params.receiverQueue.getMessage(params.messageId);
  return {
    senderQueue: restartedSenderQueue,
    receiverQueue: params.receiverQueue,
    senderMessageStatus: (await restartedSenderQueue.getMessage(params.messageId))?.status,
    receiverDelivered: !!receiverMessage && receiverMessage.status === "delivered",
    queuedBeforeRestartCount: queuedBeforeRestart.length,
    queuedAfterRetryCount: (await restartedSenderQueue.getQueuedMessages()).length,
  };
};

vi.mock("@/app/features/crypto/crypto-service", () => ({
  cryptoService: {
    decryptDM: vi.fn(async (ciphertext: string) => ciphertext.replace("encrypted_", "")),
    decryptGiftWrap: vi.fn(),
    verifyEventSignature: vi.fn(async () => true),
  },
}));

vi.mock("@/app/features/settings/services/privacy-settings-service", () => ({
  PrivacySettingsService: {
    getSettings: vi.fn(() => ({
      dmPrivacy: "everyone",
    })),
  },
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
    verifyMessageEnvelope: vi.fn(),
  },
}));

vi.mock("../lib/error-handler", () => ({
  errorHandler: {
    handleDecryptionError: vi.fn(),
  },
}));

vi.mock("../../vault/services/local-media-store", () => ({
  cacheAttachmentLocally: vi.fn(async () => undefined),
}));

describe("dm delivery deterministic two-user flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes 10/10 queued -> restart -> partial relay recovery -> receive runs", async () => {
    const reports: TwoUserDeterministicRunReport[] = [];

    for (let iteration = 1; iteration <= 10; iteration += 1) {
      const messageId = `dm-${iteration}`;
      let senderQueue = new InMemoryMessageQueue();
      let receiverQueue = new InMemoryMessageQueue();
      const relayMailbox = createRelayMailbox();

      const initialMessage = buildMessage({
        id: messageId,
        content: `hello-${iteration}`,
        senderPubkey: USER_A,
        recipientPubkey: USER_B,
      });
      await senderQueue.persistMessage(initialMessage);

      const signedEvent = buildSignedEvent({
        id: messageId,
        senderPubkey: USER_A,
        recipientPubkey: USER_B,
        plaintext: `hello-${iteration}`,
      });

      const steps: TwoUserDeterministicRunStep[] = [];

      const queuedSendResult = await publishOutgoingDm({
        pool: {
          sendToOpen: vi.fn(),
          connections: [],
          waitForConnection: async () => false,
        },
        openRelays: [],
        messageQueue: senderQueue,
        initialMessage,
        build: {
          format: "nip04",
          signedEvent,
          encryptedContent: signedEvent.content,
          canonicalEventId: signedEvent.id,
        },
        plaintext: `hello-${iteration}`,
        recipientPubkey: USER_B,
        senderPubkey: USER_A,
        senderPrivateKeyHex: PRIVATE_A as any,
        createdAtUnixSeconds: signedEvent.created_at,
        tags: [["p", USER_B]],
      });

      const queuedMessagesBeforeRestart = await senderQueue.getQueuedMessages();
      steps.push(buildStep(
        "A queues first DM when initial publish lacks durable evidence",
        queuedSendResult.finalMessage.status === "queued"
          && queuedMessagesBeforeRestart.length === 1
          && queuedMessagesBeforeRestart[0]?.nextRetryAt.getTime() > Date.now(),
        `${queuedSendResult.publishResult.status}:${queuedSendResult.finalMessage.status}`
      ));

      senderQueue = new InMemoryMessageQueue(senderQueue.snapshot());
      const queuedAfterRestart = await senderQueue.getQueuedMessages();
      steps.push(buildStep(
        "Sender restart preserves queued DM state",
        queuedAfterRestart.length === 1 && queuedAfterRestart[0]?.id === messageId,
        String(queuedAfterRestart.length)
      ));

      const retryOutcome = await publishQueuedOutgoingMessage({
        pool: {
          sendToOpen: vi.fn(),
          publishToAll: vi.fn(async (payload: string) => {
            const [, publishedEvent] = JSON.parse(payload) as [string, NostrEvent];
            relayMailbox.push(publishedEvent);
            return {
              success: false,
              successCount: 1,
              totalRelays: 2,
              metQuorum: false,
              results: [
                { relayUrl: "wss://relay-1.example", success: true },
                { relayUrl: "wss://relay-2.example", success: false, error: "503" },
              ],
            };
          }),
        } as any,
        messageQueue: senderQueue,
        message: queuedAfterRestart[0]!,
        openRelays: [{ url: "wss://relay-1.example" }, { url: "wss://relay-2.example" }],
      });
      await senderQueue.removeFromQueue(messageId);
      const senderMessageAfterRetry = await senderQueue.getMessage(messageId);
      steps.push(buildStep(
        "Queued retry accepts after durable relay evidence and no resend loop",
        retryOutcome.status === "accepted"
          && retryOutcome.relayOutcome?.successCount === 1
          && retryOutcome.relayOutcome?.metQuorum === true
          && (await senderQueue.getQueuedMessages()).length === 0
          && senderMessageAfterRetry?.status === "accepted",
        `${retryOutcome.status}:${retryOutcome.relayOutcome?.successCount ?? 0}`
      ));

      receiverQueue = new InMemoryMessageQueue(receiverQueue.snapshot());
      let receiverState = createReadyState(await receiverQueue.getAllMessages());
      steps.push(buildStep(
        "Receiver restart before sync/backfill keeps empty pre-delivery state",
        receiverState.messages.length === 0,
        String(receiverState.messages.length)
      ));

      const mailboxSnapshot = relayMailbox.snapshot();
      const deliveredEvent = mailboxSnapshot.deliverableEvents[0];
      await handleIncomingDmEvent({
        event: deliveredEvent,
        currentParams: {
          myPrivateKeyHex: PRIVATE_B,
          myPublicKeyHex: USER_B,
          peerTrust: {
            isAccepted: ({ publicKeyHex }) => publicKeyHex === USER_A,
            acceptPeer: () => undefined,
          },
          requestsInbox: {
            upsertIncoming: () => undefined,
            getRequestStatus: () => null,
            setStatus: () => undefined,
          },
        },
        messageQueue: receiverQueue,
        processingEvents: new Set<string>(),
        failedDecryptEvents: new Set<string>(),
        existingMessages: receiverState.messages,
        maxMessagesInMemory: 200,
        syncConversationTimestamps: new Map<string, Date>(),
        activeSubscriptions: new Map<string, Subscription>(),
        scheduleUiUpdate: (fn) => fn(),
        setState: (next) => {
          receiverState = typeof next === "function" ? next(receiverState) : next;
        },
        createReadyState,
        messageMemoryManager: { addMessages: () => undefined },
        uiPerformanceMonitor: { startTracking: () => () => ({ totalTime: 0 }) },
      });

      const receiverMessagesAfterDelivery = await receiverQueue.getAllMessages();
      const receivedMessage = receiverMessagesAfterDelivery.find((message) => message.eventId === messageId);
      steps.push(buildStep(
        "B receives and decrypts first DM after restart",
        !!receivedMessage
          && receivedMessage.content === `hello-${iteration}`
          && receivedMessage.status === "delivered",
        receivedMessage?.status
      ));

      const senderMessagesAfterRestart = await senderQueue.getAllMessages();
      steps.push(buildStep(
        "Sender state has no stuck sending message after recovery",
        senderMessagesAfterRestart.every((message) => message.status !== "sending"),
      ));

      const firstDivergence = steps.find((step) => !step.passed)?.name;
      reports.push({
        iteration,
        steps,
        firstDivergenceStep: firstDivergence,
      });
    }

    expect(reports).toHaveLength(10);
    const failedReports = reports
      .map((report) => ({
        iteration: report.iteration,
        failedSteps: report.steps.filter((step) => !step.passed),
      }))
      .filter((report) => report.failedSteps.length > 0);
    expect(failedReports).toEqual([]);
    expect(reports.find((report) => report.firstDivergenceStep)).toBeUndefined();
  });

  it("preserves bidirectional delivery after restart (A->B then B->A)", async () => {
    let queueA = new InMemoryMessageQueue();
    let queueB = new InMemoryMessageQueue();

    const aToB = await runDirectionalDelivery({
      messageId: "dm-a-to-b",
      plaintext: "hello-from-a",
      senderPubkey: USER_A,
      senderPrivateKeyHex: PRIVATE_A,
      recipientPubkey: USER_B,
      recipientPrivateKeyHex: PRIVATE_B,
      senderQueue: queueA,
      receiverQueue: queueB,
    });
    queueA = aToB.senderQueue;
    queueB = aToB.receiverQueue;

    const bToA = await runDirectionalDelivery({
      messageId: "dm-b-to-a",
      plaintext: "hello-from-b",
      senderPubkey: USER_B,
      senderPrivateKeyHex: PRIVATE_B,
      recipientPubkey: USER_A,
      recipientPrivateKeyHex: PRIVATE_A,
      senderQueue: queueB,
      receiverQueue: queueA,
    });
    queueB = bToA.senderQueue;
    queueA = bToA.receiverQueue;

    expect(aToB.queuedBeforeRestartCount).toBe(1);
    expect(aToB.queuedAfterRetryCount).toBe(0);
    expect(aToB.senderMessageStatus).toBe("accepted");
    expect(aToB.receiverDelivered).toBe(true);

    expect(bToA.queuedBeforeRestartCount).toBe(1);
    expect(bToA.queuedAfterRetryCount).toBe(0);
    expect(bToA.senderMessageStatus).toBe("accepted");
    expect(bToA.receiverDelivered).toBe(true);

    expect((await queueA.getMessage("dm-b-to-a"))?.content).toBe("hello-from-b");
    expect((await queueB.getMessage("dm-a-to-b"))?.content).toBe("hello-from-a");
  });
});
