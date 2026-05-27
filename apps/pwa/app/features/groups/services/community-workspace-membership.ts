import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { publishCoordinationMembershipDelta } from "./community-coordination-membership-client";
import { writeMembershipSyncMode } from "./community-membership-sync-mode";

export {
    isWorkspaceR1MembershipEnforced,
    resolveWorkspaceActionMemberPubkeys,
    shouldUseCoordinationMembershipAuthority,
} from "./community-workspace-r1-policy";

export const ensureWorkspaceMembershipSyncMode = (): void => {
    writeMembershipSyncMode("coordination_preferred");
};

export const publishWorkspaceMemberJoin = async (params: Readonly<{
    communityId: string;
    memberPubkey: PublicKeyHex;
    actorPubkey: PublicKeyHex;
    actorPrivateKeyHex: PrivateKeyHex;
}>): Promise<Readonly<{ success: boolean; errorMessage?: string }>> => {
    ensureWorkspaceMembershipSyncMode();
    const result = await publishCoordinationMembershipDelta({
        communityId: params.communityId,
        action: "join",
        subjectPubkey: params.memberPubkey,
        actorPubkey: params.actorPubkey,
        actorPrivateKeyHex: params.actorPrivateKeyHex,
    });
    return {
        success: result.success,
        errorMessage: result.errorMessage,
    };
};
