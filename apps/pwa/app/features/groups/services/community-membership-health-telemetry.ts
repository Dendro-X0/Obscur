import { logAppEvent } from "@/app/shared/log-app-event";
import type { CommunityMembershipHealth } from "./community-membership-health";

export const logMembershipHealthSnapshot = (params: Readonly<{
  health: CommunityMembershipHealth;
  communityId?: string;
  groupId?: string;
  relayUrl?: string;
}>): void => {
  logAppEvent({
    name: "groups.membership_health_snapshot",
    level: params.health.ready ? "info" : "warn",
    scope: { feature: "groups", action: "membership_health" },
    context: {
      ready: params.health.ready ? 1 : 0,
      chatEnabled: params.health.chatEnabled ? 1 : 0,
      blockers: params.health.blockers.join(","),
      recoveryActions: params.health.recoveryActions.join(","),
      communityId: params.communityId ?? null,
      groupId: params.groupId ?? null,
      relayUrl: params.relayUrl ?? null,
    },
  });
};
