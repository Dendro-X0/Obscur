import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Slice D0 — freeze default Nostr path behavior before any decoupling move.
 * Characterization only: mocks stand in for kernel/pipeline; no production edits.
 */

const sidebarMock = vi.hoisted(() => vi.fn());
const threadMock = vi.hoisted(() => vi.fn());
const sendDmMock = vi.hoisted(() => vi.fn());
const sendConnectionRequestMock = vi.hoisted(() => vi.fn());
const applyActiveTransportMock = vi.hoisted(() => vi.fn());
const getSettingsMock = vi.hoisted(() => vi.fn(() => ({ enableTorProxy: false })));

vi.mock("@/app/features/dm-kernel/dm-kernel-sidebar-port", () => ({
  loadDmKernelSidebar: sidebarMock,
}));

vi.mock("@/app/features/dm-kernel/dm-kernel-thread-port", () => ({
  loadDmKernelThread: threadMock,
}));

vi.mock("@/app/features/messaging/controllers/v2/dm-send-pipeline", () => ({
  sendDm: sendDmMock,
  sendConnectionRequest: sendConnectionRequestMock,
}));

vi.mock("./apply-active-transport", () => ({
  applyActiveTransport: applyActiveTransportMock,
}));

vi.mock("@/app/features/settings/services/privacy-settings-service", () => ({
  PrivacySettingsService: {
    getSettings: getSettingsMock,
  },
}));

vi.mock("@/app/features/profiles/services/profile-runtime-scope", () => ({
  getResolvedProfileId: () => "default",
}));

vi.mock("@/app/features/profiles/services/profile-scope", () => ({
  getScopedStorageKey: (key: string, profileId: string) => `${key}::${profileId}`,
}));

import { ProtocolAdaptationLayer } from "./layer";
import { nostrAdapter } from "./nostr-adapter";
import { writeMatrixSession, clearMatrixSession } from "./matrix-session";

const PROFILE = "profile-d0";

describe("decoupling D0 characterization (Nostr default path)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    getSettingsMock.mockReturnValue({ enableTorProxy: false });
    applyActiveTransportMock.mockImplementation(async (transport: string) => ({
      transportId: transport,
    }));
    sidebarMock.mockResolvedValue([
      {
        kind: "dm",
        id: "conv-1",
        displayName: "Ada",
        pubkey: "aa",
        lastMessage: "hi",
        unreadCount: 0,
        lastMessageTime: new Date(1_700_000_000_000),
      },
    ]);
    threadMock.mockResolvedValue([
      {
        id: "msg-failed",
        kind: "user",
        content: "nope",
        timestamp: new Date(1_700_000_000_100),
        isOutgoing: false,
        status: "rejected",
        conversationId: "conv-1",
      },
      {
        id: "msg-queued",
        kind: "user",
        content: "wait",
        timestamp: new Date(1_700_000_000_200),
        isOutgoing: true,
        status: "queued",
        conversationId: "conv-1",
      },
      {
        id: "msg-ok",
        kind: "user",
        content: "hello",
        timestamp: new Date(1_700_000_000_300),
        isOutgoing: true,
        status: "accepted",
        conversationId: "conv-1",
      },
    ]);
    sendDmMock.mockResolvedValue({
      success: true,
      deliveryStatus: "sent_quorum",
      messageId: "msg-ok",
      eventId: "evt-1",
      relayResults: [],
    });
  });

  it("defaults active protocol to nostr and rich list is the sidebar port unchanged", async () => {
    expect(ProtocolAdaptationLayer.getActiveProtocolId(PROFILE)).toBe("nostr");
    expect(ProtocolAdaptationLayer.getActiveAdapter(PROFILE).id).toBe("nostr");
    expect(ProtocolAdaptationLayer.capabilities(PROFILE)).toEqual({
      dms: true,
      groups: true,
      reactions: true,
      media: true,
    });

    const rich = await ProtocolAdaptationLayer.listDmConversations(PROFILE);
    expect(sidebarMock).toHaveBeenCalledWith(PROFILE);
    expect(rich).toEqual(await sidebarMock.mock.results[0]?.value);
    expect(rich[0]?.displayName).toBe("Ada");
  });

  it("maps canonical conversations and message status without dropping rows", async () => {
    const conversations = await ProtocolAdaptationLayer.listConversations(PROFILE);
    expect(conversations).toEqual([{ id: "conv-1", title: "Ada" }]);

    const messages = await ProtocolAdaptationLayer.listMessages({
      profileId: PROFILE,
      conversationId: "conv-1",
      myPublicKeyHex: "bb",
    });
    expect(threadMock).toHaveBeenCalledWith({
      profileId: PROFILE,
      conversationId: "conv-1",
      myPublicKeyHex: "bb",
    });
    expect(messages.map((row) => [row.id, row.body, row.direction, row.status])).toEqual([
      ["msg-failed", "nope", "in", "failed"],
      ["msg-queued", "wait", "out", "sending"],
      ["msg-ok", "hello", "out", "sent"],
    ]);
  });

  it("routes Nostr sendDm through the pipeline and refuses canonical sendMessage", async () => {
    const params = {
      pool: {} as never,
      senderPublicKeyHex: "aa",
      senderPrivateKeyHex: "cc",
      recipientPublicKeyHex: "bb",
      plaintext: "hello",
    };
    const result = await ProtocolAdaptationLayer.sendDm(params);
    expect(sendDmMock).toHaveBeenCalledTimes(1);
    expect(sendDmMock).toHaveBeenCalledWith(params);
    expect(result).toMatchObject({ success: true, eventId: "evt-1", deliveryStatus: "sent_quorum" });

    await expect(
      nostrAdapter.sendMessage({ conversationId: "conv-1", body: "x" }),
    ).rejects.toThrow(/use ProtocolAdaptationLayer\.sendDm|nostrAdapter\.sendDm/);
  });

  it("keeps transport honesty: Tor preference overrides a stored clearnet id", () => {
    ProtocolAdaptationLayer.setActiveTransportId("clearnet", PROFILE);
    expect(ProtocolAdaptationLayer.getActiveTransportId(PROFILE)).toBe("clearnet");
    getSettingsMock.mockReturnValue({ enableTorProxy: true });
    expect(ProtocolAdaptationLayer.getActiveTransportId(PROFILE)).toBe("tor");
  });

  it("refuses Matrix selection without a session and does not flip the default", () => {
    expect(() => ProtocolAdaptationLayer.setActiveProtocolId("matrix", PROFILE)).toThrow(
      /Matrix requires a homeserver login/,
    );
    expect(ProtocolAdaptationLayer.getActiveProtocolId(PROFILE)).toBe("nostr");

    writeMatrixSession(
      {
        homeserverUrl: "https://example.test",
        userId: "@ada:example.test",
        accessToken: "token",
      },
      PROFILE,
    );
    ProtocolAdaptationLayer.setActiveProtocolId("matrix", PROFILE);
    expect(ProtocolAdaptationLayer.getActiveProtocolId(PROFILE)).toBe("matrix");
    clearMatrixSession(PROFILE);
  });
});
