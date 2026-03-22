import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { RuntimeMessagingTransportOwnerProvider } from "./runtime-messaging-transport-owner-provider";
import { useEnhancedDmController } from "@/app/features/messaging/hooks/use-enhanced-dm-controller";
import type { Message } from "@/app/features/messaging/types";

const busMocks = vi.hoisted(() => ({
  emitNewMessage: vi.fn(),
  emitMessageDeleted: vi.fn(),
}));

const peerInteractionMocks = vi.hoisted(() => ({
  recordPeerLastActive: vi.fn(),
}));

vi.mock("@/app/features/messaging/hooks/use-enhanced-dm-controller", () => ({
  useEnhancedDmController: vi.fn(() => ({
    state: { status: "ready", messages: [] },
  })),
}));

vi.mock("@/app/features/messaging/services/message-bus", () => ({
  messageBus: {
    emitNewMessage: busMocks.emitNewMessage,
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

const projectionState = {
  accountProjectionReady: false,
  phase: "bootstrapping",
  accountPublicKeyHex: "a".repeat(64) as PublicKeyHex,
  projection: null as object | null,
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
      connections: [],
    },
  }),
}));

vi.mock("@/app/features/runtime/services/window-runtime-supervisor", () => ({
  useWindowRuntimeSnapshot: () => ({
    phase: runtimeState.phase,
  }),
}));

vi.mock("@/app/features/account-sync/hooks/use-account-projection-snapshot", () => ({
  useAccountProjectionSnapshot: () => projectionState,
}));

describe("RuntimeMessagingTransportOwnerProvider", () => {
  beforeEach(() => {
    projectionState.accountProjectionReady = false;
    projectionState.phase = "bootstrapping";
    projectionState.accountPublicKeyHex = "a".repeat(64) as PublicKeyHex;
    projectionState.projection = null;
    runtimeState.phase = "ready";
    vi.mocked(useEnhancedDmController).mockClear();
    busMocks.emitNewMessage.mockReset();
    busMocks.emitMessageDeleted.mockReset();
    peerInteractionMocks.recordPeerLastActive.mockReset();
  });

  it("keeps transport disabled until projection is ready", () => {
    render(
      <RuntimeMessagingTransportOwnerProvider>
        <div>child</div>
      </RuntimeMessagingTransportOwnerProvider>
    );

    expect(useEnhancedDmController).toHaveBeenCalledWith(expect.objectContaining({
      enableIncomingTransport: false,
      autoSubscribeIncoming: false,
      enableAutoQueueProcessing: false,
    }));
  });

  it("enables transport once projection gate is ready", () => {
    projectionState.accountProjectionReady = true;
    projectionState.phase = "ready";

    render(
      <RuntimeMessagingTransportOwnerProvider>
        <div>child</div>
      </RuntimeMessagingTransportOwnerProvider>
    );

    expect(useEnhancedDmController).toHaveBeenCalledWith(expect.objectContaining({
      enableIncomingTransport: true,
      autoSubscribeIncoming: true,
      enableAutoQueueProcessing: true,
    }));
  });

  it("keeps transport disabled while runtime is activating even when projection is ready", () => {
    projectionState.accountProjectionReady = true;
    projectionState.phase = "ready";
    runtimeState.phase = "activating_runtime";

    render(
      <RuntimeMessagingTransportOwnerProvider>
        <div>child</div>
      </RuntimeMessagingTransportOwnerProvider>
    );

    expect(useEnhancedDmController).toHaveBeenCalledWith(expect.objectContaining({
      enableIncomingTransport: false,
      autoSubscribeIncoming: false,
      enableAutoQueueProcessing: false,
    }));
  });

  it("toggles transport flags deterministically across projection/runtime gate flapping", () => {
    projectionState.accountProjectionReady = false;
    projectionState.phase = "bootstrapping";
    runtimeState.phase = "activating_runtime";

    const view = render(
      <RuntimeMessagingTransportOwnerProvider>
        <div>child</div>
      </RuntimeMessagingTransportOwnerProvider>
    );

    projectionState.accountProjectionReady = true;
    projectionState.phase = "ready";
    view.rerender(
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

    projectionState.accountProjectionReady = false;
    projectionState.phase = "replaying_event_log";
    projectionState.projection = { contactsByPeer: {} };
    view.rerender(
      <RuntimeMessagingTransportOwnerProvider>
        <div>child</div>
      </RuntimeMessagingTransportOwnerProvider>
    );

    projectionState.accountProjectionReady = true;
    projectionState.phase = "ready";
    runtimeState.phase = "degraded";
    view.rerender(
      <RuntimeMessagingTransportOwnerProvider>
        <div>child</div>
      </RuntimeMessagingTransportOwnerProvider>
    );

    const flags = vi.mocked(useEnhancedDmController).mock.calls.map((call) => {
      const params = call[0] as Readonly<{
        enableIncomingTransport: boolean;
        autoSubscribeIncoming: boolean;
        enableAutoQueueProcessing: boolean;
      }>;
      return [
        params.enableIncomingTransport,
        params.autoSubscribeIncoming,
        params.enableAutoQueueProcessing,
      ];
    });

    expect(flags).toEqual([
      [false, false, false],
      [false, false, false],
      [true, true, true],
      [true, true, true],
      [true, true, true],
    ]);
  });

  it("keeps transport enabled during replaying_event_log when projection is bound to active identity", () => {
    projectionState.accountProjectionReady = false;
    projectionState.phase = "replaying_event_log";
    projectionState.accountPublicKeyHex = identityState.publicKeyHex;
    projectionState.projection = { conversationsById: {} };
    runtimeState.phase = "ready";

    render(
      <RuntimeMessagingTransportOwnerProvider>
        <div>child</div>
      </RuntimeMessagingTransportOwnerProvider>
    );

    expect(useEnhancedDmController).toHaveBeenCalledWith(expect.objectContaining({
      enableIncomingTransport: true,
      autoSubscribeIncoming: true,
      enableAutoQueueProcessing: true,
    }));
  });

  it("records peer last-active from incoming message callbacks and still emits message bus events", () => {
    projectionState.accountProjectionReady = true;
    projectionState.phase = "ready";

    render(
      <RuntimeMessagingTransportOwnerProvider>
        <div>child</div>
      </RuntimeMessagingTransportOwnerProvider>
    );

    const controllerParams = vi.mocked(useEnhancedDmController).mock.calls[0]?.[0] as Readonly<{
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
    });
    expect(busMocks.emitNewMessage).toHaveBeenCalledWith(incoming.conversationId, incoming);
  });

  it("does not record peer activity for outgoing messages", () => {
    projectionState.accountProjectionReady = true;
    projectionState.phase = "ready";

    render(
      <RuntimeMessagingTransportOwnerProvider>
        <div>child</div>
      </RuntimeMessagingTransportOwnerProvider>
    );

    const controllerParams = vi.mocked(useEnhancedDmController).mock.calls[0]?.[0] as Readonly<{
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
    expect(busMocks.emitNewMessage).toHaveBeenCalledWith(outgoing.conversationId, outgoing);
  });

  it("emits delete events from controller callback to the message bus", () => {
    projectionState.accountProjectionReady = true;
    projectionState.phase = "ready";

    render(
      <RuntimeMessagingTransportOwnerProvider>
        <div>child</div>
      </RuntimeMessagingTransportOwnerProvider>
    );

    const controllerParams = vi.mocked(useEnhancedDmController).mock.calls[0]?.[0] as Readonly<{
      onMessageDeleted?: (params: Readonly<{ conversationId: string; messageId: string }>) => void;
    }>;

    controllerParams.onMessageDeleted?.({
      conversationId: "conversation-delete",
      messageId: "msg-delete-1",
    });

    expect(busMocks.emitMessageDeleted).toHaveBeenCalledWith("conversation-delete", "msg-delete-1");
  });
});
