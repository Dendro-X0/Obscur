import type { ProfileMessageBus } from "@dweb/core/profile-message-bus";
import {
  isCommunityMembershipIngressDetail,
  type CommunityMembershipIngressDetail,
} from "@/app/features/groups/services/community-membership-ingress-contract";

/** Subscribe to relay membership ingress on the profile bus (Phase 3 M1). */
export const subscribeCommunityMembershipIngress = (
  onDetail: (detail: CommunityMembershipIngressDetail) => void,
  optionalProfileBus: ProfileMessageBus | null,
): () => void => {
  const unsubBus = optionalProfileBus?.subscribeTo("community-membership-ingress", (event) => {
    const detail = event.detail;
    if (!isCommunityMembershipIngressDetail(detail)) {
      return;
    }
    onDetail(detail);
  }) ?? null;

  return (): void => {
    unsubBus?.();
  };
};
