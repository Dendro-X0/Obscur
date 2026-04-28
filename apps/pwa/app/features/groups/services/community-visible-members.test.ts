import { describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { CommunityMemberProjection } from "@dweb/core/community-projection-contracts";
import {
    filterActiveCommunityMemberPubkeys,
    filterVisibleGroupMembers,
    mergeKnownCommunityMemberPubkeys,
    resolveCommunitySeedMemberPubkeys,
    resolveVisibleCommunityMemberPubkeys,
    stabilizeCommunityMemberPubkeys,
} from "./community-visible-members";

describe("community-visible-members", () => {
    it("keeps canonical members visible even when cached profile looks deleted", () => {
        const members = [
            "member-a",
            "member-b",
            "member-c",
        ] as unknown as ReadonlyArray<PublicKeyHex>;

        const visible = filterVisibleGroupMembers(members, (pubkey) => {
            if (pubkey === "member-b") {
                return {
                    displayName: "Deleted Account",
                    about: "This account has been deleted.",
                };
            }
            return { displayName: "Active member" };
        });

        expect(visible).toEqual(members);
    });

    it("keeps members without cached profile metadata", () => {
        const members = [
            "member-a",
            "member-b",
        ] as unknown as ReadonlyArray<PublicKeyHex>;

        const visible = filterVisibleGroupMembers(members, (pubkey) => {
            if (pubkey === "member-a") {
                return null;
            }
            return { displayName: "Known member" };
        });

        expect(visible).toEqual(members);
    });

    it("filters non-joined member projections while keeping joined members visible", () => {
        const members: ReadonlyArray<CommunityMemberProjection> = [
            {
                memberPublicKeyHex: "member-a" as PublicKeyHex,
                status: "joined",
                lastEvidenceAtUnixMs: 1_000,
            },
            {
                memberPublicKeyHex: "member-b" as PublicKeyHex,
                status: "left",
                lastEvidenceAtUnixMs: 2_000,
            },
            {
                memberPublicKeyHex: "member-c" as PublicKeyHex,
                status: "expelled",
                lastEvidenceAtUnixMs: 3_000,
            },
        ];

        const visible = filterVisibleGroupMembers(members, () => null);

        expect(visible).toEqual(["member-a"]);
    });

    it("filters left and expelled members from active pubkey lists", () => {
        const visible = filterActiveCommunityMemberPubkeys({
            memberPubkeys: [
                "member-a",
                "member-b",
                "member-c",
            ] as unknown as ReadonlyArray<PublicKeyHex>,
            leftMembers: ["member-b"] as unknown as ReadonlyArray<PublicKeyHex>,
            expelledMembers: ["member-c"] as unknown as ReadonlyArray<PublicKeyHex>,
        });

        expect(visible).toEqual(["member-a"]);
    });

    it("merges seeded, live, and author-evidence member pubkeys without dropping seeded members when live roster is thinner", () => {
        const merged = mergeKnownCommunityMemberPubkeys({
            seededMemberPubkeys: ["member-a", "member-b"] as unknown as ReadonlyArray<PublicKeyHex>,
            liveMemberPubkeys: ["member-a"] as unknown as ReadonlyArray<PublicKeyHex>,
            authorEvidencePubkeys: ["member-b", "member-c"] as unknown as ReadonlyArray<PublicKeyHex>,
        });

        expect(merged).toEqual(["member-a", "member-b", "member-c"]);
    });

    it("keeps richer seed evidence when initializing a community member ledger from a thinner live projection", () => {
        const seeded = resolveCommunitySeedMemberPubkeys({
            seededMemberPubkeys: ["member-a", "member-b"] as unknown as ReadonlyArray<PublicKeyHex>,
            projectionMemberPubkeys: ["member-a"] as unknown as ReadonlyArray<PublicKeyHex>,
            localMemberPubkey: "member-a" as PublicKeyHex,
        });

        expect(seeded).toEqual(["member-a", "member-b"]);
    });

    it("keeps joined peers visible when roster projection is thinner but message-author evidence still exists", () => {
        const visible = resolveVisibleCommunityMemberPubkeys({
            seededMemberPubkeys: ["member-a"] as unknown as ReadonlyArray<PublicKeyHex>,
            projectionMemberPubkeys: ["member-a"] as unknown as ReadonlyArray<PublicKeyHex>,
            authorEvidencePubkeys: ["member-b"] as unknown as ReadonlyArray<PublicKeyHex>,
            localMemberPubkey: "member-a" as PublicKeyHex,
        });

        expect(visible).toEqual(["member-a", "member-b"]);
    });

    it("still removes members with explicit leave or expel evidence even when older author evidence exists", () => {
        const visible = resolveVisibleCommunityMemberPubkeys({
            seededMemberPubkeys: ["member-a", "member-b", "member-c"] as unknown as ReadonlyArray<PublicKeyHex>,
            projectionMemberPubkeys: ["member-a"] as unknown as ReadonlyArray<PublicKeyHex>,
            authorEvidencePubkeys: ["member-b", "member-c"] as unknown as ReadonlyArray<PublicKeyHex>,
            leftMemberPubkeys: ["member-b"] as unknown as ReadonlyArray<PublicKeyHex>,
            expelledMemberPubkeys: ["member-c"] as unknown as ReadonlyArray<PublicKeyHex>,
            localMemberPubkey: "member-a" as PublicKeyHex,
        });

        expect(visible).toEqual(["member-a"]);
    });

    it("keeps previously evidenced participants visible until explicit removal evidence exists", () => {
        const stable = stabilizeCommunityMemberPubkeys({
            previousMemberPubkeys: ["member-a", "member-b"] as unknown as ReadonlyArray<PublicKeyHex>,
            nextMemberPubkeys: ["member-a"] as unknown as ReadonlyArray<PublicKeyHex>,
        });

        expect(stable).toMatchObject({
            shouldApply: false,
            reasonCode: "missing_removal_evidence",
            nextMemberPubkeys: ["member-a", "member-b"],
            removedWithoutEvidence: ["member-b"],
            confidence: "unknown",
            guardRelaxed: false,
        });
    });

    it("drops session-stable participants when explicit leave or expel evidence arrives", () => {
        const stable = stabilizeCommunityMemberPubkeys({
            previousMemberPubkeys: ["member-a", "member-b", "member-c"] as unknown as ReadonlyArray<PublicKeyHex>,
            nextMemberPubkeys: ["member-a"] as unknown as ReadonlyArray<PublicKeyHex>,
            leftMemberPubkeys: ["member-b"] as unknown as ReadonlyArray<PublicKeyHex>,
            expelledMemberPubkeys: ["member-c"] as unknown as ReadonlyArray<PublicKeyHex>,
        });

        expect(stable).toMatchObject({
            shouldApply: true,
            reasonCode: "apply_snapshot",
            nextMemberPubkeys: ["member-a"],
            removedWithoutEvidence: [],
            confidence: "unknown",
            guardRelaxed: false,
        });
    });
});
