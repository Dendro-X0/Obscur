import { beforeEach, describe, expect, it, vi } from "vitest";

const visibilityMocks = vi.hoisted(() => ({
  persistSuppressionStores: vi.fn(async (_params: Readonly<{ messageIdentityIds: ReadonlyArray<string> }>) => {
    const ids = new Set<string>();
    _params.messageIdentityIds.forEach((id) => {
      const normalized = id.trim();
      if (normalized.length > 0) {
        ids.add(normalized);
      }
    });
    return Array.from(ids);
  }),
  executeDeleteForMe: vi.fn(async (params: Readonly<{ messageIdentityIds: ReadonlyArray<string> }>) => (
    params.messageIdentityIds
  )),
}));

vi.mock("@/app/features/profiles/services/resolve-client-gateway", () => ({
  getResolvedClientGateway: () => ({
    localDmVisibility: visibilityMocks,
  }),
}));

import {
  applyDmDeleteForMePersistence,
  persistDmLocalDeleteIdentities,
} from "./dm-local-delete-persistence";

describe("dm-local-delete-persistence (delegates to localDmVisibilityOwner)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persistDmLocalDeleteIdentities delegates to persistSuppressionStores", async () => {
    const ids = await persistDmLocalDeleteIdentities({
      conversationId: "conv-a",
      messageIdentityIds: ["msg-1", " msg-1 ", ""],
      deletedAtUnixMs: 9_000,
      profileId: "profile-1",
    });

    expect(ids).toEqual(["msg-1"]);
    expect(visibilityMocks.persistSuppressionStores).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: "conv-a",
        profileId: "profile-1",
      }),
    );
  });

  it("applyDmDeleteForMePersistence delegates to executeDeleteForMe", async () => {
    await applyDmDeleteForMePersistence({
      conversationId: "conv-d",
      messageIdentityIds: ["msg-a", "msg-b"],
      accountPublicKeyHex: "aa".repeat(32) as `${string}`,
      profileId: "profile-1",
      observedAtUnixMs: 4_000,
    });

    expect(visibilityMocks.executeDeleteForMe).toHaveBeenCalledWith(
      expect.objectContaining({
        profileId: "profile-1",
        accountPublicKeyHex: "aa".repeat(32),
        messageIdentityIds: ["msg-a", "msg-b"],
      }),
    );
  });
});
