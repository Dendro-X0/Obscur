import { describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
    isCommunityDesignatedSteward,
    normalizeCommunityStewardPubkeys,
    resolveCommunityStewardPolicy,
    resolveInitialStewardPubkeysForCreate,
    resolveStewardRoleMutation,
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

    it("promotes an active member to steward on managed workspace", () => {
        const result = resolveStewardRoleMutation({
            communityMode: "managed_workspace",
            stewardPubkeys: [STEWARD_A],
            actorPublicKeyHex: STEWARD_A,
            targetPublicKeyHex: MEMBER_C,
            action: "promote",
            activeMemberPubkeys: [STEWARD_A, MEMBER_C],
        });
        expect(result.allowed).toBe(true);
        expect(result.reasonCode).toBe("allowed");
        expect(result.nextStewardPubkeys).toEqual([STEWARD_A, MEMBER_C]);
    });

    it("demotes a steward when another steward remains", () => {
        const result = resolveStewardRoleMutation({
            communityMode: "managed_workspace",
            stewardPubkeys: [STEWARD_A, STEWARD_B],
            actorPublicKeyHex: STEWARD_A,
            targetPublicKeyHex: STEWARD_B,
            action: "demote",
            activeMemberPubkeys: [STEWARD_A, STEWARD_B, MEMBER_C],
        });
        expect(result.allowed).toBe(true);
        expect(result.nextStewardPubkeys).toEqual([STEWARD_A]);
    });

    it("refuses demoting the last steward", () => {
        const result = resolveStewardRoleMutation({
            communityMode: "managed_workspace",
            stewardPubkeys: [STEWARD_A],
            actorPublicKeyHex: STEWARD_A,
            targetPublicKeyHex: STEWARD_A,
            action: "demote",
            activeMemberPubkeys: [STEWARD_A, MEMBER_C],
        });
        expect(result.allowed).toBe(false);
        expect(result.reasonCode).toBe("last_steward");
    });

    it("rejects steward role mutation on sovereign rooms", () => {
        const result = resolveStewardRoleMutation({
            communityMode: "sovereign_room",
            stewardPubkeys: [STEWARD_A],
            actorPublicKeyHex: STEWARD_A,
            targetPublicKeyHex: MEMBER_C,
            action: "promote",
            activeMemberPubkeys: [STEWARD_A, MEMBER_C],
        });
        expect(result.allowed).toBe(false);
        expect(result.reasonCode).toBe("not_managed_workspace");
    });

    it("rejects steward role mutation from non-steward actors", () => {
        const result = resolveStewardRoleMutation({
            communityMode: "managed_workspace",
            stewardPubkeys: [STEWARD_A],
            actorPublicKeyHex: MEMBER_C,
            targetPublicKeyHex: MEMBER_C,
            action: "promote",
            activeMemberPubkeys: [STEWARD_A, MEMBER_C],
        });
        expect(result.allowed).toBe(false);
        expect(result.reasonCode).toBe("not_steward");
    });
});
