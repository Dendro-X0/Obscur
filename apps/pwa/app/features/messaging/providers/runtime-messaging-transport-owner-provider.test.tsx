import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { RuntimeMessagingTransportOwnerProvider } from "./runtime-messaging-transport-owner-provider";
import { useDmController } from "@/app/features/messaging/controllers/v2/dm-controller";
import type { Message } from "@/app/features/messaging/types";

const busMocks = vi.hoisted(() => ({
  emitNewMessage: vi.fn(),
  emitMessageUpdated: vi.fn(),
  emitMessageDeleted: vi.fn(),
}));

const peerInteractionMocks = vi.hoisted(() => ({
  recordPeerLastActive: vi.fn(),
}));

vi.mock("@/app/features/messaging/controllers/v2/dm-controller", () => ({
  useDmController: vi.fn(() => ({
    state: { status: "ready", phase: "ready", messages: [], subscriptions: [], messageStatusMap: {}, networkState: { online: true } },
    sendDm: vi.fn(),
    sendConnectionRequest: vi.fn(),
    deleteMessage: vi.fn(),
    retryFailedMessage: vi.fn(),
    subscribeToIncomingDMs: vi.fn(),
    syncMissedMessages: vi.fn(),
    getMessageStatus: vi.fn(),
    getMessagesForPeer: vi.fn(),
    isRecipientVerified: vi.fn(),
  })),
}));

vi.mock("@/app/features/messaging/services/message-bus", () => ({
  messageBus: {
    emitNewMessage: busMocks.emitNewMessage,
    emitMessageUpdated: busMocks.emitMessageUpdated,
    emitMessageDeleted: busMocks.emitMessageDeleted,
  },
}));

vi.mock("@/app/features/messaging/services/peer-interaction-store", () => ({
  recordPeerLastActive: peerInteractionMocks.recordPeerLastActive,
}));

const identityState = {
  status: "unlocked",
  publicKeyHex: "a".repeat(64) as PublicKeyHex,
  privateKeyHex: "f".repeat(64),
};

const runtimeState = {
  phase: "ready",
};

vi.mock("@/app/features/auth/hooks/use-identity", () => ({
  useIdentity: () => ({
    state: identityState,
  }),
}));

vi.mock("@/app/features/network/providers/network-provider", () => ({
  useNetwork: () => ({
    blocklist: {},
    peerTrust: {},
    requestsInbox: {},
  }),
}));

vi.mock("@/app/features/relays/providers/relay-provider", () => ({
  useRelay: () => ({
    relayPool: {
      sendToOpen: vi.fn(),
      subscribeToMessages: vi.fn(() => () => undefined),
      subscribe: vi.fn(() => "sub-1"),
      unsubscribe: vi.fn(),
      connections: [],
      waitForConnection: vi.fn(async () => true),
    },
  }),
}));

vi.mock("@/app/features/runtime/services/window-runtime-supervisor", () => ({
  useWindowRuntimeSnapshot: () => ({
    phase: runtimeState.phase,
    session: { profileId: "default", windowLabel: "main" },
  }),
}));

vi.mock("@/app/features/runtime/runtime-transport-owner-policy", () => ({
  isRuntimeTransportOwnerEnabled: () => (
    runtimeState.phase === "activating_runtime"
    || runtimeState.phase === "ready"
    || runtimeState.phase === "degraded"
    || identityState.status === "unlocked"
  ),
}));

vi.mock("@/app/features/profiles/services/profile-runtime-scope", () => ({
  getResolvedProfileId: () => "default",
}));

describe("RuntimeMessagingTransportOwnerProvider", () => {
  beforeEach(() => {
    identityState.status = "unlocked";
    identityState.publicKeyHex = "a".repeat(64) as PublicKeyHex;
    identityState.privateKeyHex = "f".repeat(64);
    runtimeState.phase = "ready";
    vi.mocked(useDmController).mockClear();
    busMocks.emitNewMessage.mockReset();
    busMocks.emitMessageDeleted.mockReset();
    peerInteractionMocks.recordPeerLastActive.mockReset();
  });

  it("keeps transport enabled when identity is unlocked and runtime phase is active", () => {
    render(
      <RuntimeMessagingTransportOwnerProvider>
        <div>child</div>
      </RuntimeMessagingTransportOwnerProvider>
    );

    expect(useDmController).toHaveBeenCalledWith(expect.objectContaining({
      enableIncomingTransport: true,
      autoSubscribeIncoming: true,
    }));
  });

  it("keeps transport enabled while runtime is activating", () => {
    runtimeState.phase = "activating_runtime";

    render(
      <RuntimeMessagingTransportOwnerProvider>
        <div>child</div>
      </RuntimeMessagingTransportOwnerProvider>
    );

    expect(useDmController).toHaveBeenCalledWith(expect.objectContaining({
      enableIncomingTransport: true,
      autoSubscribeIncoming: true,
    }));
  });

  it("keeps transport enabled in degraded phase", () => {
    runtimeState.phase = "degraded";

    render(
      <RuntimeMessagingTransportOwnerProvider>
        <div>child</div>
      </RuntimeMessagingTransportOwnerProvider>
    );

    expect(useDmController).toHaveBeenCalledWith(expect.objectContaining({
      enableIncomingTransport: true,
      autoSubscribeIncoming: true,
    }));
  });

  it("keeps transport flags enabled across runtime phase transitions", () => {
    runtimeState.phase = "activating_runtime";

    const view = render(
      <RuntimeMessagingTransportOwnerProvider>
        <div>child</div>
      </RuntimeMessagingTransportOwnerProvider>
    );

    runtimeState.phase = "ready";
    view.rerender(
      <RuntimeMessagingTransportOwnerProvider>
        <div>child</div>
      </RuntimeMessagingTransportOwnerProvider>
    );

    runtimeState.phase = "degraded";
    view.rerender(
      <RuntimeMessagingTransportOwnerProvider>
        <div>child</div>
      </RuntimeMessagingTransportOwnerProvider>
    );

    const flags = vi.mocked(useDmController).mock.calls.map((call) => {
      const params = call[0] as Readonly<{
        enableIncomingTransport: boolean;
        autoSubscribeIncoming: boolean;
      }>;
      return [params.enableIncomingTransport, params.autoSubscribeIncoming];
    });

    expect(flags).toEqual([
      [true, true],
      [true, true],
      [true, true],
    ]);
  });

  it("records peer last-active from incoming message callbacks and still emits message bus events", () => {
    render(
      <RuntimeMessagingTransportOwnerProvider>
        <div>child</div>
      </RuntimeMessagingTransportOwnerProvider>
    );

    const controllerParams = vi.mocked(useDmController).mock.calls[0]?.[0] as Readonly<{
      onNewMessage?: (message: Message) => void;
    }>;
    const incoming: Message = {
      id: "evt-1",
      kind: "user",
      content: "hello",
      timestamp: new Date(1_717_000_000_000),
      eventCreatedAt: new Date(1_717_000_000_000),
      isOutgoing: false,
      status: "delivered",
      senderPubkey: "b".repeat(64) as PublicKeyHex,
      conversationId: "conversation-1",
    };

    controllerParams.onNewMessage?.(incoming);

    expect(peerInteractionMocks.recordPeerLastActive).toHaveBeenCalledWith({
      publicKeyHex: identityState.publicKeyHex,
      peerPublicKeyHex: incoming.senderPubkey,
      activeAtMs: incoming.eventCreatedAt?.getTime(),
      profileId: "default",
    });
    expect(busMocks.emitNewMessage).toHaveBeenCalledWith(incoming.conversationId, incoming, {
      sourceProfileId: "default",
    });
  });

  it("emits message_updated events for outgoing persistence bridge callbacks", () => {
    render(
      <RuntimeMessagingTransportOwnerProvider>
        <div>child</div>
      </RuntimeMessagingTransportOwnerProvider>
    );

    const controllerParams = vi.mocked(useDmController).mock.calls[0]?.[0] as Readonly<{
      onMessageUpdated?: (params: Readonly<{ conversationId: string; message: Message }>) => void;
    }>;
    const nostrId = "c".repeat(64);
    const outgoing: Message = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      eventId: nostrId,
      kind: "user",
      content: "sent",
      timestamp: new Date(1_717_000_000_000),
      isOutgoing: true,
      status: "accepted",
      senderPubkey: "b".repeat(64) as PublicKeyHex,
      conversationId: "conversation-2",
    };

    controllerParams.onMessageUpdated?.({
      conversationId: outgoing.conversationId!,
      message: outgoing,
    });

    expect(busMocks.emitMessageUpdated).toHaveBeenCalledWith(outgoing.conversationId, outgoing, {
      sourceProfileId: "default",
    });
  });

  it("does not record peer activity for outgoing messages", () => {
    render(
      <RuntimeMessagingTransportOwnerProvider>
        <div>child</div>
      </RuntimeMessagingTransportOwnerProvider>
    );

    const controllerParams = vi.mocked(useDmController).mock.calls[0]?.[0] as Readonly<{
      onNewMessage?: (message: Message) => void;
    }>;
    const outgoing: Message = {
      id: "evt-2",
      kind: "user",
      content: "sent",
      timestamp: new Date(1_717_000_000_000),
      isOutgoing: true,
      status: "delivered",
      senderPubkey: "b".repeat(64) as PublicKeyHex,
      conversationId: "conversation-2",
    };

    controllerParams.onNewMessage?.(outgoing);

    expect(peerInteractionMocks.recordPeerLastActive).not.toHaveBeenCalled();
    expect(busMocks.emitNewMessage).toHaveBeenCalledWith(outgoing.conversationId, outgoing, {
      sourceProfileId: "default",
    });
  });

  it("emits delete events from controller callback to the message bus", () => {
    render(
      <RuntimeMessagingTransportOwnerProvider>
        <div>child</div>
      </RuntimeMessagingTransportOwnerProvider>
    );

    const controllerParams = vi.mocked(useDmController).mock.calls[0]?.[0] as Readonly<{
      onMessageDeleted?: (params: Readonly<{ conversationId: string; messageId: string }>) => void;
    }>;

    controllerParams.onMessageDeleted?.({
      conversationId: "conversation-delete",
      messageId: "msg-delete-1",
    });

    expect(busMocks.emitMessageDeleted).toHaveBeenCalledWith("conversation-delete", "msg-delete-1", {
      messageIdentityIds: undefined,
      conversationIdOriginal: undefined,
      sourceProfileId: "default",
    });
  });

  it("disables transport when runtime phase is not active", () => {
    runtimeState.phase = "booting";
    identityState.status = "locked";

    render(
      <RuntimeMessagingTransportOwnerProvider>
        <div>child</div>
      </RuntimeMessagingTransportOwnerProvider>
    );

    expect(useDmController).toHaveBeenCalledWith(expect.objectContaining({
      enableIncomingTransport: false,
      autoSubscribeIncoming: false,
    }));
  });

  it("enables transport when identity is unlocked even if window phase is still auth_required", () => {
    runtimeState.phase = "auth_required";
    identityState.status = "unlocked";

    render(
      <RuntimeMessagingTransportOwnerProvider>
        <div>child</div>
      </RuntimeMessagingTransportOwnerProvider>
    );

    expect(useDmController).toHaveBeenCalledWith(expect.objectContaining({
      myPublicKeyHex: identityState.publicKeyHex,
      myPrivateKeyHex: identityState.privateKeyHex,
      enableIncomingTransport: true,
      autoSubscribeIncoming: true,
    }));
  });

  it("disables transport when identity is not unlocked", () => {
    identityState.status = "locked";
    runtimeState.phase = "ready";

    render(
      <RuntimeMessagingTransportOwnerProvider>
        <div>child</div>
      </RuntimeMessagingTransportOwnerProvider>
    );

    expect(useDmController).toHaveBeenCalledWith(expect.objectContaining({
      enableIncomingTransport: false,
      autoSubscribeIncoming: false,
    }));
  });
});
