import { afterEach, describe, expect, it, vi } from "vitest";
import type { PersistedChatState } from "../types";
import { messagingDB } from "@dweb/storage/indexed-db";
import { emitAccountSyncMutation } from "@/app/shared/account-sync-mutation-signal";
import { setProfileScopeOverride } from "@/app/features/profiles/services/profile-scope";
import { CHAT_STATE_REPLACED_EVENT, chatStateStoreService } from "./chat-state-store";

vi.mock("@/app/shared/account-sync-mutation-signal", () => ({
  emitAccountSyncMutation: vi.fn(),
}));

vi.mock("@dweb/storage/indexed-db", () => ({
  messagingDB: {
    put: vi.fn(async () => undefined),
    get: vi.fn(async () => null),
    ensureDB: vi.fn(),
  },
}));

const PK = "a".repeat(64);

const createState = (): PersistedChatState => ({
  version: 2,
  createdConnections: [],
  createdGroups: [],
  unreadByConversationId: {},
  connectionOverridesByConnectionId: {},
  messagesByConversationId: {},
  groupMessages: {},
  connectionRequests: [],
  pinnedChatIds: [],
  hiddenChatIds: [],
});

describe("chat-state-store replace event", () => {
  const emitMutationMock = vi.mocked(emitAccountSyncMutation);
  const messagingDbPutMock = vi.mocked(messagingDB.put);

  afterEach(() => {
    vi.restoreAllMocks();
    emitMutationMock.mockClear();
    messagingDbPutMock.mockClear();
    setProfileScopeOverride(null);
    window.localStorage.clear();
  });

  it("emits CHAT_STATE_REPLACED_EVENT with public key when replace is called", () => {
    const onReplaced = vi.fn();
    window.addEventListener(CHAT_STATE_REPLACED_EVENT, onReplaced);

    chatStateStoreService.replace(PK as any, createState(), { emitMutationSignal: false });

    expect(onReplaced).toHaveBeenCalledTimes(1);
    const event = onReplaced.mock.calls[0]?.[0] as CustomEvent<{ publicKeyHex: string }>;
    expect(event.detail?.publicKeyHex).toBe(PK);
    expect(emitMutationMock).not.toHaveBeenCalled();

    window.removeEventListener(CHAT_STATE_REPLACED_EVENT, onReplaced);
  });

  it("keeps chat-state cache and pending writes isolated per profile scope for the same public key", async () => {
    const scopeA = "profile-scope-a";
    const scopeB = "profile-scope-b";

    setProfileScopeOverride(scopeB);
    chatStateStoreService.replace(PK as any, createState(), { emitMutationSignal: false });

    setProfileScopeOverride(scopeA);
    chatStateStoreService.updateHiddenChats(PK as any, ["scope-a-hidden"]);
    expect(chatStateStoreService.load(PK as any)?.hiddenChatIds).toEqual(["scope-a-hidden"]);

    setProfileScopeOverride(scopeB);
    expect(chatStateStoreService.load(PK as any)?.hiddenChatIds ?? []).toEqual([]);

    setProfileScopeOverride(scopeA);
    expect(chatStateStoreService.load(PK as any)?.hiddenChatIds).toEqual(["scope-a-hidden"]);

    await chatStateStoreService.flush(PK as any, { profileId: scopeA });
    await chatStateStoreService.flush(PK as any, { profileId: scopeB });
  });

  it("removes message identities from persisted conversation history and updates preview", () => {
    chatStateStoreService.replace(PK as any, {
      ...createState(),
      createdConnections: [{
        id: "dm:test",
        displayName: "Peer",
        pubkey: "b".repeat(64),
        lastMessage: "stale preview",
        unreadCount: 0,
        lastMessageTimeMs: 3_000,
      }],
      messagesByConversationId: {
        "dm:test": [{
          id: "legacy-wrapper",
          eventId: "evt-delete-me",
          content: "delete me",
          timestampMs: 2_000,
          isOutgoing: false,
          status: "delivered",
        }, {
          id: "keep-row",
          content: "keep me",
          timestampMs: 3_000,
          isOutgoing: true,
          status: "delivered",
        }],
      },
    }, { emitMutationSignal: false });

    chatStateStoreService.removeMessageIdentities(PK as any, "dm:test", ["evt-delete-me"]);

    expect(chatStateStoreService.load(PK as any)?.messagesByConversationId["dm:test"]).toEqual([
      expect.objectContaining({ id: "keep-row" }),
    ]);
    expect(chatStateStoreService.load(PK as any)?.createdConnections).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: "dm:test",
        lastMessage: "keep me",
        lastMessageTimeMs: 3_000,
      }),
    ]));
    expect(emitMutationMock).toHaveBeenCalledWith("chat_state_changed");
  });
});
