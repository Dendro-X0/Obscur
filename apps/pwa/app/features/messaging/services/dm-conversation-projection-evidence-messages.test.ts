import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Message } from "../types";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { buildLegacyProjectionEvidenceMessagesForConversation } from "@/app/features/messaging/services/thread-history/dm-thread-history-legacy-port";

const myHex = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as PublicKeyHex;

const mk = (id: string): Message => ({
  id,
  kind: "user",
  content: "",
  timestamp: new Date(1),
  isOutgoing: false,
  status: "delivered",
});

const selectConversationMock = vi.hoisted(() => vi.fn((): ReadonlyArray<Message> => []));

vi.mock("@/app/features/account-sync/services/account-projection-selectors", () => ({
  selectProjectionConversationMessages: () => selectConversationMock(),
}));

describe("buildLegacyProjectionEvidenceMessagesForConversation", () => {
  beforeEach(() => {
    selectConversationMock.mockReset();
    selectConversationMock.mockReturnValue([]);
  });

  it("returns empty when conversation id is blank", () => {
    expect(buildLegacyProjectionEvidenceMessagesForConversation({
      conversationId: "  ",
      publicKeyHex: myHex,
      projection: null,
      limit: 10,
      persistentSuppressedMessageIds: new Set(),
      localMessageRetentionDays: undefined,
      normalizeRow: (e) => e,
    })).toEqual([]);
    expect(selectConversationMock).not.toHaveBeenCalled();
  });

  it("returns empty when public key is missing", () => {
    expect(buildLegacyProjectionEvidenceMessagesForConversation({
      conversationId: "c1",
      publicKeyHex: null,
      projection: null,
      limit: 10,
      persistentSuppressedMessageIds: new Set(),
      localMessageRetentionDays: undefined,
      normalizeRow: (e) => e,
    })).toEqual([]);
    expect(selectConversationMock).not.toHaveBeenCalled();
  });

  it("applies suppression and retention after selection", () => {
    selectConversationMock.mockReturnValue([mk("a"), mk("b")]);
    const out = buildLegacyProjectionEvidenceMessagesForConversation({
      conversationId: "c1",
      publicKeyHex: myHex,
      projection: {} as any,
      limit: 10,
      persistentSuppressedMessageIds: new Set<string>(["a"]),
      localMessageRetentionDays: undefined,
      normalizeRow: (e) => e,
    });
    expect(out.map((m) => m.id)).toEqual(["b"]);
    expect(selectConversationMock).toHaveBeenCalledTimes(1);
  });
});
