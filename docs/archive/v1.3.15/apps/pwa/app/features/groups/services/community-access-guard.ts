import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { GroupRole, GroupAccessMode } from "../types";

/**
 * Service to handle client-side access control for Sealed Communities.
 * Membership is defined by possession of the community Room Key.
 */
export class CommunityAccessGuard {
    /**
     * Determines if a message should be displayed.
     * In the Sealed Protocol, if you can decrypt it, you can view it.
     */
    static canViewMessage(params: {
        senderPubkey: string;
        memberPubkeys: ReadonlyArray<string>;
    }): boolean {
        // Basic anti-injection: sender must be in the known member roster
        return params.memberPubkeys.includes(params.senderPubkey);
    }

    /**
     * Determines if the current user can post to the group.
     */
    static canPost(params: {
        myRole: GroupRole;
    }): boolean {
        return params.myRole === "member";
    }

    /**
     * Determines the join method required for the group.
     */
    static getJoinMethod(access: GroupAccessMode): "direct" | "request" | "invite_only" {
        switch (access) {
            case "open":
                return "direct";
            case "discoverable":
                return "request";
            case "invite-only":
                return "invite_only";
            default:
                return "direct";
        }
    }
}
