import { beforeEach, describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { createProfileMessageBus } from "@dweb/core/profile-message-bus";
import { BUNDLE_FIN_COLD } from "@/app/features/dm-kernel/dm-kernel-trust-assessment-port";
import { setProfileRuntimeScope } from "@/app/features/profiles/services/profile-runtime-scope";
import {
  clearDevLabDmTrustThreadForPeer,
  probeDevLabDmTrustAssessmentForPeer,
  seedDevLabAcceptedPeer,
  seedDevLabEstablishedTrustThread,
} from "./dev-lab-trust-probe";

const MY_PK = "aa".repeat(32) as PublicKeyHex;
const PEER_PK = "bb".repeat(32) as PublicKeyHex;
const BASE_MS = 1_700_000_000_000;
const PROFILE_ID = "dev-lab-trust-probe";

describe("dev-lab-trust-probe", () => {
  beforeEach(() => {
    setProfileRuntimeScope({ profileId: PROFILE_ID, bus: createProfileMessageBus({ profileId: PROFILE_ID }) });
    localStorage.clear();
  });

  it("detects fin-cold assessment for cold peer financial inbound", () => {
    const probe = probeDevLabDmTrustAssessmentForPeer({
      myPublicKeyHex: MY_PK,
      peerPublicKeyHex: PEER_PK,
      isPeerAccepted: false,
      messages: [{
        content: "Please send $200 via wire transfer today",
        isOutgoing: false,
        timestampUnixMs: BASE_MS + 60_000,
      }],
    });
    expect(probe.showBanner).toBe(true);
    expect(probe.assessment?.bundleId).toBe(BUNDLE_FIN_COLD);
    expect(probe.conversationId).toBe([MY_PK, PEER_PK].sort().join(":"));
  });

  it("clears thread trust state for peer conversation", () => {
    const conversationId = [MY_PK, PEER_PK].sort().join(":");
    const storageKey = `obscur.dm_kernel_trust_thread_state.v1::${PROFILE_ID}`;
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        [conversationId]: {
          firstPeerMessageAtUnixMs: BASE_MS,
          dismissedUntilUnixMs: BASE_MS + 1000,
        },
      }),
    );

    const cleared = clearDevLabDmTrustThreadForPeer({
      myPublicKeyHex: MY_PK,
      peerPublicKeyHex: PEER_PK,
    });
    expect(cleared.cleared).toBe(true);
    expect(cleared.conversationId).toBe(conversationId);
    expect(localStorage.getItem(storageKey)).toBe("{}");
  });

  it("suppresses elevated banner for accepted peer burst when isPeerAccepted omitted", () => {
    seedDevLabAcceptedPeer({
      ownerPublicKeyHex: MY_PK,
      peerPublicKeyHex: PEER_PK,
    });
    seedDevLabEstablishedTrustThread({
      myPublicKeyHex: MY_PK,
      peerPublicKeyHex: PEER_PK,
      firstPeerMessageAtUnixMs: BASE_MS - 86_400_000,
    });
    const burstProbe = probeDevLabDmTrustAssessmentForPeer({
      myPublicKeyHex: MY_PK,
      peerPublicKeyHex: PEER_PK,
      messages: Array.from({ length: 22 }, (_, messageIndex) => ({
        content: `burst ${messageIndex}`,
        isOutgoing: false,
        timestampUnixMs: BASE_MS + messageIndex * 100,
      })),
    });
    expect(burstProbe.showBanner).toBe(false);
    expect(burstProbe.assessment?.tier).not.toBe("elevated");
    expect(burstProbe.assessment?.tier).not.toBe("critical");
  });
});
