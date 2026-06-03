import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { setProfileScopeOverride } from "@/app/features/profiles/services/profile-scope";
import {
  COMMUNITY_TERMINAL_MEMBERSHIP_UPDATED_EVENT,
  saveCommunityTerminalMembershipCache,
} from "../services/community-terminal-membership-cache";
import { useCommunityMembershipReadModelIndex } from "./use-community-membership-read-model-index";

const OWNER = "a".repeat(64) as PublicKeyHex;
const PEER = "b".repeat(64) as PublicKeyHex;
const CONVERSATION_ID = "community:g1:wss://relay.test";
const GROUP_ID = "g1";
const RELAY_URL = "wss://relay.test";

describe("useCommunityMembershipReadModelIndex (MEM-002)", () => {
  beforeEach(() => {
    window.localStorage.clear();
    setProfileScopeOverride(null);
  });

  it("excludes terminal left members for network-style inputs without explicit terminal props", async () => {
    saveCommunityTerminalMembershipCache({
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      leftMemberPubkeys: [PEER],
      expelledMemberPubkeys: [],
    });

    const { result } = renderHook(() => useCommunityMembershipReadModelIndex({
      ownerPubkey: OWNER,
      groups: [{
        conversationId: CONVERSATION_ID,
        groupId: GROUP_ID,
        relayUrl: RELAY_URL,
        directoryParticipantPubkeys: [OWNER, PEER],
        persistedGroupMemberPubkeys: [OWNER, PEER],
        localMemberPubkey: OWNER,
      }],
    }));

    await waitFor(() => {
      expect(result.current[CONVERSATION_ID]?.memberCount).toBe(1);
      expect(result.current[CONVERSATION_ID]?.displayPubkeys).toEqual([OWNER]);
    });
  });

  it("honors explicit applyTerminalMembershipExclusions from chat shell inputs", async () => {
    const { result } = renderHook(() => useCommunityMembershipReadModelIndex({
      ownerPubkey: OWNER,
      groups: [{
        conversationId: CONVERSATION_ID,
        groupId: GROUP_ID,
        relayUrl: RELAY_URL,
        directoryParticipantPubkeys: [OWNER, PEER],
        persistedGroupMemberPubkeys: [OWNER, PEER],
        localMemberPubkey: OWNER,
        leftMemberPubkeys: [PEER],
        applyTerminalMembershipExclusions: true,
      }],
    }));

    await waitFor(() => {
      expect(result.current[CONVERSATION_ID]?.displayPubkeys).toEqual([OWNER]);
    });
  });

  it("REL-003: ignores terminal membership updates from another profile scope", async () => {
    setProfileScopeOverride("profile-b");

    const { result } = renderHook(() => useCommunityMembershipReadModelIndex({
      ownerPubkey: OWNER,
      groups: [{
        conversationId: CONVERSATION_ID,
        groupId: GROUP_ID,
        relayUrl: RELAY_URL,
        directoryParticipantPubkeys: [OWNER, PEER],
        persistedGroupMemberPubkeys: [OWNER, PEER],
        localMemberPubkey: OWNER,
      }],
    }));

    await waitFor(() => {
      expect(result.current[CONVERSATION_ID]?.memberCount).toBe(2);
    });

    setProfileScopeOverride("profile-a");
    saveCommunityTerminalMembershipCache({
      groupId: GROUP_ID,
      relayUrl: RELAY_URL,
      leftMemberPubkeys: [PEER],
      expelledMemberPubkeys: [],
      profileId: "profile-a",
    });

    setProfileScopeOverride("profile-b");
    window.dispatchEvent(new CustomEvent(COMMUNITY_TERMINAL_MEMBERSHIP_UPDATED_EVENT, {
      detail: {
        groupId: GROUP_ID,
        relayUrl: RELAY_URL,
        profileId: "profile-a",
      },
    }));

    await waitFor(() => {
      expect(result.current[CONVERSATION_ID]?.memberCount).toBe(2);
    });
  });
});
