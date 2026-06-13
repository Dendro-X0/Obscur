import { logAppEvent } from "@/app/shared/log-app-event";
import {
  detectRelationshipSyncDrift,
  type RelationshipDriftIssue,
} from "./relationship-sync-projection";
import { isRelationshipSyncExperimentEnabled } from "./relationship-sync-policy";

export const reportRelationshipSyncDrift = (
  params: Parameters<typeof detectRelationshipSyncDrift>[0],
): ReadonlyArray<RelationshipDriftIssue> => {
  if (!isRelationshipSyncExperimentEnabled()) {
    return [];
  }

  const issues = detectRelationshipSyncDrift(params);
  for (const issue of issues) {
    logAppEvent({
      name: "relationship.sync.drift_detected",
      level: "warn",
      scope: { feature: "relationship_sync", action: "drift" },
      context: {
        code: issue.code,
        communityId: issue.communityId,
        peerPublicKeySuffix: issue.peerPublicKeyHex.slice(-8),
        detail: issue.detail,
      },
    });
  }

  return issues;
};
