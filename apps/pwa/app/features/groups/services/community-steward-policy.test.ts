import { describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
    isCommunityDesignatedSteward,
    normalizeCommunityStewardPubkeys,
    resolveCommunityStewardPolicy,
    resolveInitialStewardPubkeysForCreate,
} from "./community-steward-policy";

const STEWARD_A = "a".repeat(64) as PublicKeyHex;
const STEWARD_B = "b".repeat(64) as PublicKeyHex;
const MEMBER_C = "c".repeat(64) as PublicKeyHex;

describe("community-steward-policy", () => {
    it("seeds creator as steward for managed workspace create", () => {
        expect(resolveInitialStewardPubkeysForCreate({
            communityMode: "managed_workspace",
            creatorPublicKeyHex: STEWARD_A,
        })).toEqual([STEWARD_A]);
        expect(resolveInitialStewardPubkeysForCreate({
            communityMode: "sovereign_room",
            creatorPublicKeyHex: STEWARD_A,
        })).toEqual([]);
    });

    it("dedupes steward pubkeys", () => {
        expect(normalizeCommunityStewardPubkeys([STEWARD_A, STEWARD_A, "short"])).toEqual([STEWARD_A]);
    });

    it("grants solo steward direct descriptor when alone", () => {
        const policy = resolveCommunityStewardPolicy({
            communityMode: "sovereign_room",
            stewardPubkeys: [],
            actorPublicKeyHex: STEWARD_A,
            activeMemberCount: 1,
        });
        expect(policy.authorityMode).toBe("solo_steward");
        expect(policy.canDirectDescriptorUpdate).toBe(true);
        expect(policy.canDirectMemberExpel).toBe(false);
    });

    it("requires member vote in sovereign multi-member communities", () => {
        const policy = resolveCommunityStewardPolicy({
            communityMode: "sovereign_room",
            stewardPubkeys: [STEWARD_A],
            actorPublicKeyHex: STEWARD_A,
            activeMemberCount: 3,
        });
        expect(policy.authorityMode).toBe("member_vote");
        expect(policy.requiresGovernanceVoteForDescriptor).toBe(true);
        expect(policy.requiresGovernanceVoteForExpel).toBe(true);
    });

    it("grants designated stewards direct actions in managed workspace", () => {
        const policy = resolveCommunityStewardPolicy({
            communityMode: "managed_workspace",
            stewardPubkeys: [STEWARD_A],
            actorPublicKeyHex: STEWARD_A,
            activeMemberCount: 4,
        });
        expect(policy.authorityMode).toBe("designated_stewards");
        expect(policy.canDirectDescriptorUpdate).toBe(true);
        expect(policy.canDirectMemberExpel).toBe(true);
        expect(isCommunityDesignatedSteward({
            stewardPubkeys: [STEWARD_A],
            actorPublicKeyHex: STEWARD_A,
        })).toBe(true);
        expect(isCommunityDesignatedSteward({
            stewardPubkeys: [STEWARD_A],
            actorPublicKeyHex: MEMBER_C,
        })).toBe(false);
    });

    it("treats non-stewards in managed workspace like member vote", () => {
        const policy = resolveCommunityStewardPolicy({
            communityMode: "managed_workspace",
            stewardPubkeys: [STEWARD_A],
            actorPublicKeyHex: MEMBER_C,
            activeMemberCount: 4,
        });
        expect(policy.authorityMode).toBe("member_vote");
        expect(policy.canDirectDescriptorUpdate).toBe(false);
    });
});
