import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

const ensureReadyMock = vi.hoisted(() => vi.fn(async () => undefined));
const hydrateSqliteMock = vi.hoisted(() => vi.fn(async () => undefined));
const mergeIdbMock = vi.hoisted(() => vi.fn(async () => undefined));
const loadSuppressedMock = vi.hoisted(() => vi.fn(() => new Set<string>(["durable-1"])));
const dbGetTombstonesMock = vi.hoisted(() => vi.fn(async () => []));
const isTauriMock = vi.hoisted(() => vi.fn(() => false));

vi.mock("@/app/features/profiles/services/resolve-client-gateway", () => ({
  getResolvedClientGateway: () => ({
    localDmVisibility: { ensureReady: ensureReadyMock },
  }),
}));

vi.mock("@dweb/db", () => ({
  isTauri: isTauriMock,
  dbGetTombstones: dbGetTombstonesMock,
}));

import { prepareDmThreadSuppressionIds } from "./dm-thread-suppression-prepare";

describe("prepareDmThreadSuppressionIds", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isTauriMock.mockReturnValue(false);
    loadSuppressedMock.mockReturnValue(new Set(["durable-1"]));
  });

  it("merges seed ids, durable tombstones, and projection removedMessageIds", async () => {
    const account = "aa".repeat(32) as PublicKeyHex;
    const result = await prepareDmThreadSuppressionIds({
      profileId: "profile-1",
      accountPublicKeyHex: account,
      projection: {
        profileId: "profile-1",
        accountPublicKeyHex: account,
        contactsByPeer: {},
        conversationsById: {},
        messagesByConversationId: {},
        removedMessageIds: { "proj-removed": Date.now() },
        sync: { checkpointsByTimelineKey: {}, bootstrapImportApplied: false },
        lastSequence: 0,
        updatedAtUnixMs: 0,
      },
      messageDeleteTombstones: {
        hydrateMessageDeleteTombstonesFromSqlite: hydrateSqliteMock,
        mergeMessageDeleteTombstonesFromIndexedDb: mergeIdbMock,
        loadSuppressedMessageDeleteIds: loadSuppressedMock,
        loadMessageDeleteTombstoneEntries: vi.fn(() => []),
        isMessageDeleteSuppressed: vi.fn(() => false),
        suppressMessageDeleteTombstone: vi.fn(),
        replaceMessageDeleteTombstones: vi.fn(),
        clearMessageDeleteTombstones: vi.fn(),
      },
      seedIds: new Set(["in-flight"]),
    });

    expect(ensureReadyMock).toHaveBeenCalled();
    expect(mergeIdbMock).toHaveBeenCalled();
    expect(result).toEqual(new Set(["in-flight", "durable-1", "proj-removed"]));
  });
});
