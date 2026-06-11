import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  listManagedWorkspaceCommunityIdCandidates,
  resolveManagedWorkspaceCommunityId,
} from "./workspace-kernel-membership-scope";

const PUBLIC_KEY = "a".repeat(64) as PublicKeyHex;
const RELAY_URL = "ws://localhost:7000";

vi.mock("@/app/features/groups/services/community-membership-ledger", () => ({
  loadCommunityMembershipLedger: vi.fn(() => []),
}));

vi.mock("@/app/features/groups/services/community-coordination-membership-directory-store", () => ({
  listCoordinationMembershipDirectoryRecords: vi.fn(() => []),
}));

import { loadCommunityMembershipLedger } from "@/app/features/groups/services/community-membership-ledger";
import { listCoordinationMembershipDirectoryRecords } from "@/app/features/groups/services/community-coordination-membership-directory-store";

describe("resolveManagedWorkspaceCommunityId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(loadCommunityMembershipLedger).mockReturnValue([]);
    vi.mocked(listCoordinationMembershipDirectoryRecords).mockReturnValue([]);
  });

  it("prefers hashed ledger community id over legacy group metadata", () => {
    const hashedId = "v2_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    vi.mocked(loadCommunityMembershipLedger).mockReturnValue([{
      communityId: hashedId,
      groupId: "test-10",
      relayUrl: RELAY_URL,
      status: "joined",
    }]);

    const resolved = resolveManagedWorkspaceCommunityId({
      group: {
        communityId: "test-10:ws://localhost:7000",
        groupId: "test-10",
        relayUrl: RELAY_URL,
      },
      publicKeyHex: PUBLIC_KEY,
    });

    expect(resolved).toBe(hashedId);
  });

  it("lists hashed and legacy community ids for the same scope", () => {
    const hashedId = "v2_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    vi.mocked(loadCommunityMembershipLedger).mockReturnValue([{
      communityId: hashedId,
      groupId: "test-10",
      relayUrl: RELAY_URL,
      status: "joined",
    }]);

    const candidates = listManagedWorkspaceCommunityIdCandidates({
      group: {
        communityId: "test-10:ws://localhost:7000",
        groupId: "test-10",
        relayUrl: RELAY_URL,
      },
      publicKeyHex: PUBLIC_KEY,
    });

    expect(candidates).toEqual(expect.arrayContaining([hashedId, "test-10:ws://localhost:7000"]));
    expect(candidates[0]).toBe(hashedId);
  });

  it("falls back to genesis-derived id when ledger is absent", () => {
    const resolved = resolveManagedWorkspaceCommunityId({
      group: {
        groupId: "newtest-1",
        relayUrl: RELAY_URL,
        genesisEventId: "abc123",
        creatorPubkey: PUBLIC_KEY,
      },
      publicKeyHex: PUBLIC_KEY,
    });

    expect(resolved.startsWith("v2_")).toBe(true);
  });
});
