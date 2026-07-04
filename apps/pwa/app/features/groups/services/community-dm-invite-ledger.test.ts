import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { CommunityDmInviteId } from "./community-dm-invite-contract";
import {
  inferCommunityDmInviteLedgerWireParties,
  loadCommunityDmInviteLedger,
  normalizeCommunityDmInviteLedgerEntry,
  upsertCommunityDmInviteLedgerEntry,
  isCommunityDmInviteLedgerInviterForViewer,
} from "./community-dm-invite-ledger";

const storage = vi.hoisted(() => new Map<string, string>());

vi.mock("@/app/features/profiles/services/profile-scope", () => ({
  getScopedStorageKey: (prefix: string, profileId: string) => `${prefix}:${profileId}`,
}));

vi.mock("@/app/features/profiles/services/profile-runtime-scope", () => ({
  getResolvedProfileId: () => "default",
}));

const inviterPk = "aa".repeat(32) as PublicKeyHex;
const inviteePk = "bb".repeat(32) as PublicKeyHex;

const invitePayload = (creatorPubkey: PublicKeyHex = inviterPk) => ({
  type: "community-invite" as const,
  inviteId: "inv-ledger-v3" as CommunityDmInviteId,
  groupId: "group-1",
  roomKey: "rk",
  creatorPubkey,
  metadata: { id: "group-1", name: "Test Group", access: "invite-only" as const },
});

describe("community-dm-invite-ledger IRA-6", () => {
  beforeEach(() => {
    storage.clear();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => {
        storage.set(key, value);
      },
      removeItem: (key: string) => {
        storage.delete(key);
      },
    });
  });

  it("infers wire parties from legacy outbound direction + account", () => {
    expect(inferCommunityDmInviteLedgerWireParties({
      peerPubkey: inviteePk,
      direction: "outbound",
      invitePayload: invitePayload(),
      accountPublicKeyHex: inviterPk,
    })).toEqual({
      inviterPubkey: inviterPk,
      inviteePubkey: inviteePk,
    });
  });

  it("infers wire parties from legacy inbound direction + account", () => {
    expect(inferCommunityDmInviteLedgerWireParties({
      peerPubkey: inviterPk,
      direction: "inbound",
      invitePayload: invitePayload(),
      accountPublicKeyHex: inviteePk,
    })).toEqual({
      inviterPubkey: inviterPk,
      inviteePubkey: inviteePk,
    });
  });

  it("migrates v2 storage to v3 with inviter and invitee pubkeys on load", () => {
    storage.set("obscur.community.dm_invite_ledger.v2:default", JSON.stringify([{
      inviteId: "inv-legacy-v2",
      conversationId: `${inviterPk}:${inviteePk}`,
      peerPubkey: inviteePk,
      direction: "outbound",
      groupId: "group-1",
      groupName: "Test Group",
      invitePayload: invitePayload(),
      status: "pending",
      sentAtUnixMs: 1,
      updatedAtUnixMs: 1,
    }]));

    const loaded = loadCommunityDmInviteLedger("default", inviterPk);
    expect(loaded).toHaveLength(1);
    expect(loaded[0]?.inviterPubkey).toBe(inviterPk);
    expect(loaded[0]?.inviteePubkey).toBe(inviteePk);
    expect(storage.has("obscur.community.dm_invite_ledger.v3:default")).toBe(true);
    expect(storage.has("obscur.community.dm_invite_ledger.v2:default")).toBe(false);
  });

  it("rewrites normalized wire parties on upsert", () => {
    upsertCommunityDmInviteLedgerEntry({
      inviteId: "inv-upsert-v3" as CommunityDmInviteId,
      conversationId: `${inviterPk}:${inviteePk}`,
      peerPubkey: inviteePk,
      direction: "outbound",
      groupId: "group-1",
      groupName: "Test Group",
      invitePayload: invitePayload(),
      status: "pending",
      sentAtUnixMs: 1,
      updatedAtUnixMs: 1,
    }, "default", inviterPk);

    const loaded = loadCommunityDmInviteLedger("default", inviterPk);
    expect(loaded[0]?.inviterPubkey).toBe(inviterPk);
    expect(loaded[0]?.inviteePubkey).toBe(inviteePk);
  });

  it("uses inviterPubkey for viewer inviter checks instead of direction alone", () => {
    const entry = normalizeCommunityDmInviteLedgerEntry({
      inviteId: "inv-role-check",
      conversationId: "c1",
      peerPubkey: inviteePk,
      direction: "inbound",
      inviterPubkey: inviterPk,
      inviteePubkey: inviteePk,
      groupId: "group-1",
      groupName: "Test Group",
      invitePayload: invitePayload(),
      status: "pending",
      sentAtUnixMs: 1,
      updatedAtUnixMs: 1,
    }, inviteePk);
    expect(entry).not.toBeNull();
    expect(isCommunityDmInviteLedgerInviterForViewer(entry!, inviterPk)).toBe(true);
    expect(isCommunityDmInviteLedgerInviterForViewer(entry!, inviteePk)).toBe(false);
  });
});
