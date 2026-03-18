import { afterEach, describe, expect, it, vi } from "vitest";
import type { PersistedChatState } from "../types";
import { messagingDB } from "@dweb/storage/indexed-db";
import { emitAccountSyncMutation } from "@/app/shared/account-sync-mutation-signal";
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
});
