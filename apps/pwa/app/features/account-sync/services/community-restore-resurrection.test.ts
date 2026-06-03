/**
 * M0 Baseline Tests — AB-06
 *
 * AB-06: Old restore backup cannot resurrect left membership.
 *
 *   Scenario:
 *     1. Profile A has previously left community "beta".
 *     2. A ledger entry with status="left" exists on the current device.
 *     3. An older backup arrives (e.g. from relay sync) that still carries
 *        a chat-state row for "beta" group (historical joined row).
 *     4. After the restore merge, the merged ledger must still show "left"
 *        for "beta" — not "joined".
 *
 *   Root-cause target:
 *     `reconcileIncomingLedgerWithReconstructedJoinedEvidence` (private fn in
 *     restore-merge-module.ts, lines ~538-563) can promote an explicit "left"
 *     entry back to "joined" when the reconstructed chat state contains a
 *     group row for the same groupId. The current implementation only skips
 *     promotion when `explicit.status !== "joined"` AND `reconstructed.status
 *     === "joined"` — meaning it DOES promote, which is the bug.
 *
 *   These tests encode the REQUIRED invariant. They are expected to FAIL on
 *   the current implementation, confirming the bug, and must PASS after the
 *   fix lands.
 */

import { beforeEach, describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  orchestrateRestoreMerge,
} from "./restore-merge-module";
import type { EncryptedAccountBackupPayload } from "../account-sync-contracts";
import type { CommunityMembershipLedgerEntry } from "@/app/features/groups/services/community-membership-ledger";
import { defaultPrivacySettings } from "@/app/features/settings/services/privacy-settings-service";

const PUBLIC_KEY = "c".repeat(64) as PublicKeyHex;
const LEFT_GROUP_ID = "beta";
const RELAY_URL = "wss://relay.example";
const LEFT_COMMUNITY_ID = `${LEFT_GROUP_ID}:${RELAY_URL}`;

const makeMinimalPayload = (overrides: Partial<EncryptedAccountBackupPayload> = {}): EncryptedAccountBackupPayload => ({
  version: 1,
  publicKeyHex: PUBLIC_KEY,
  createdAtUnixMs: 1_000,
  profile: { username: "alice", about: "", avatarUrl: "", nip05: "", inviteCode: "" },
  peerTrust: { acceptedPeers: [], mutedPeers: [] },
  requestFlowEvidence: { byPeer: {} },
  requestOutbox: { records: [] },
  syncCheckpoints: [],
  chatState: {
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
  },
  privacySettings: defaultPrivacySettings,
  relayList: [{ url: "wss://relay.nostr.band", enabled: true }],
  communityMembershipLedger: [],
  roomKeys: [],
  messageDeleteTombstones: [],
  ...overrides,
});

const makeGroupChatState = (): EncryptedAccountBackupPayload["chatState"] => ({
  version: 2,
  createdConnections: [],
  createdGroups: [
    {
      id: `community:${LEFT_GROUP_ID}:${RELAY_URL}`,
      communityId: LEFT_COMMUNITY_ID,
      groupId: LEFT_GROUP_ID,
      relayUrl: RELAY_URL,
      displayName: "Beta Group",
      memberPubkeys: [PUBLIC_KEY],
      lastMessage: "",
      unreadCount: 0,
      lastMessageTimeMs: 0,
      access: "invite-only",
      adminPubkeys: [],
    },
  ],
  unreadByConversationId: {},
  connectionOverridesByConnectionId: {},
  messagesByConversationId: {},
  groupMessages: {},
  connectionRequests: [],
  pinnedChatIds: [],
  hiddenChatIds: [],
});

const makeLeftLedgerEntry = (): CommunityMembershipLedgerEntry => ({
  communityId: LEFT_COMMUNITY_ID,
  groupId: LEFT_GROUP_ID,
  relayUrl: RELAY_URL,
  status: "left",
  updatedAtUnixMs: 3_000,
  displayName: "Beta Group",
});

const makeDefaultInput = () => ({
  publicKeyHex: PUBLIC_KEY,
  sanitizedIncomingPayload: makeMinimalPayload({
    createdAtUnixMs: 1_000,
    chatState: makeGroupChatState(),
    communityMembershipLedger: [],
  }),
  currentPayload: null,
  existingLedgerEntries: [makeLeftLedgerEntry()],
  existingRoomKeySnapshots: [],
  freshDevice: true,
  shouldHydrateLocalMessages: false,
  canTrustIncomingPortableState: true,
  recoverySnapshot: null,
  recoverySnapshotHasReplayableHistory: false,
  recoverySnapshotHasExplicitLedgerEvidence: false,
  recoverySnapshotHasExplicitRoomKeyEvidence: false,
  hasHydratedLocalReplayableHistory: false,
  hasExplicitLocalLedgerEvidence: true,
  hasExplicitLocalRoomKeyEvidence: false,
  hasExplicitLocalMessageDeleteEvidence: false,
});

describe("AB-06 — left membership cannot be resurrected by older backup restore", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("merged ledger must show left when existing ledger has left and incoming chat state has old group row", () => {
    const result = orchestrateRestoreMerge(makeDefaultInput());

    const merged = result.mergedCommunityMembershipLedger.find(
      (e) => e.groupId === LEFT_GROUP_ID,
    );

    expect(merged).toBeDefined();
    // INVARIANT: left status from local ledger must survive the merge.
    // Currently FAILS because reconcileIncomingLedgerWithReconstructedJoinedEvidence
    // promotes left→joined when chat state still contains the group row.
    expect(merged?.status).toBe("left");
  });

  it("merged ledger must not contain a joined entry for a group left locally", () => {
    const result = orchestrateRestoreMerge(makeDefaultInput());

    const joinedEntries = result.mergedCommunityMembershipLedger.filter(
      (e) => e.groupId === LEFT_GROUP_ID && e.status === "joined",
    );

    // Must be zero joined entries for a community the user has left.
    expect(joinedEntries).toHaveLength(0);
  });

  it("reconciled incoming entries must not show left→joined promotion when local says left", () => {
    const result = orchestrateRestoreMerge(makeDefaultInput());

    const reconciledJoined = result.reconciledIncomingLedgerEntries.filter(
      (e) => e.groupId === LEFT_GROUP_ID && e.status === "joined",
    );

    // Reconciled entries promoted from chat state reconstruction must not
    // override a local explicit "left" decision.
    expect(reconciledJoined).toHaveLength(0);
  });

  it("merge with explicit incoming left ledger entry also preserves left", () => {
    const input = {
      ...makeDefaultInput(),
      sanitizedIncomingPayload: makeMinimalPayload({
        createdAtUnixMs: 1_000,
        chatState: makeGroupChatState(),
        communityMembershipLedger: [
          {
            communityId: LEFT_COMMUNITY_ID,
            groupId: LEFT_GROUP_ID,
            relayUrl: RELAY_URL,
            status: "left",
            updatedAtUnixMs: 2_000,
          },
        ],
      }),
    };

    const result = orchestrateRestoreMerge(input);

    const merged = result.mergedCommunityMembershipLedger.find(
      (e) => e.groupId === LEFT_GROUP_ID,
    );

    expect(merged?.status).toBe("left");
  });

  it("merge where local left ts > incoming joined ts preserves left", () => {
    const input = {
      ...makeDefaultInput(),
      existingLedgerEntries: [
        { ...makeLeftLedgerEntry(), updatedAtUnixMs: 5_000 },
      ],
      sanitizedIncomingPayload: makeMinimalPayload({
        createdAtUnixMs: 1_000,
        chatState: makeGroupChatState(),
        communityMembershipLedger: [
          {
            communityId: LEFT_COMMUNITY_ID,
            groupId: LEFT_GROUP_ID,
            relayUrl: RELAY_URL,
            status: "joined",
            updatedAtUnixMs: 3_000,
          },
        ],
      }),
    };

    const result = orchestrateRestoreMerge(input);

    const merged = result.mergedCommunityMembershipLedger.find(
      (e) => e.groupId === LEFT_GROUP_ID,
    );

    // Local "left" at ts=5000 must beat incoming "joined" at ts=3000.
    expect(merged?.status).toBe("left");
  });

  it("MEM-004: downgrades invite-response-only joined ledger rows from incoming backup", () => {
    const input = {
      ...makeDefaultInput(),
      existingLedgerEntries: [],
      sanitizedIncomingPayload: makeMinimalPayload({
        createdAtUnixMs: 1_000,
        chatState: {
          ...makeGroupChatState(),
          createdGroups: [],
          messagesByConversationId: {
            "dm:peer": [{
              id: "m-response-only",
              content: JSON.stringify({
                type: "community-invite-response",
                status: "accepted",
                groupId: LEFT_GROUP_ID,
                relayUrl: RELAY_URL,
                communityId: LEFT_COMMUNITY_ID,
              }),
              timestampMs: 2_000,
              isOutgoing: false,
              status: "delivered",
            }],
          },
        },
        communityMembershipLedger: [
          {
            communityId: LEFT_COMMUNITY_ID,
            groupId: LEFT_GROUP_ID,
            relayUrl: RELAY_URL,
            status: "joined",
            updatedAtUnixMs: 2_000,
          },
        ],
      }),
    };

    const result = orchestrateRestoreMerge(input);
    const merged = result.mergedCommunityMembershipLedger.find(
      (entry) => entry.groupId === LEFT_GROUP_ID,
    );

    expect(merged?.status).toBe("historical");
    expect(result.mergedPayload.chatState?.createdGroups ?? []).toHaveLength(0);
  });
});
