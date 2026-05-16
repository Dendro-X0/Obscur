import { logAppEvent } from "@/app/shared/log-app-event";

export type MembershipIngressChannel =
  | "gossip"
  | "anti_entropy_request"
  | "anti_entropy_response";

export type MembershipIngressRejectReason =
  | "self_echo"
  | "missing_community_tag"
  | "community_mismatch"
  | "anti_entropy_not_addressed_to_self"
  | "invalid_event_shape";

export type MembershipIngressVerdict = Readonly<
  | {
    accepted: true;
    channel: MembershipIngressChannel;
    senderDeviceId: string;
    communityId: string;
  }
  | {
    accepted: false;
    reason: MembershipIngressRejectReason;
  }
>;

export type RelayIngressEvent = Readonly<{
  id: string;
  pubkey: string;
  tags: string[][];
}>;

const getTagValue = (tags: string[][], name: string): string | null => {
  const found = tags.find((tag) => tag[0] === name);
  return typeof found?.[1] === "string" && found[1].trim().length > 0 ? found[1] : null;
};

export const resolveMembershipIngressVerdict = (params: Readonly<{
  event: RelayIngressEvent;
  expectedCommunityId: string;
  selfPubkey: string;
}>): MembershipIngressVerdict => {
  const tags = Array.isArray(params.event.tags) ? params.event.tags : [];
  let verdict: MembershipIngressVerdict;

  if (!params.event.pubkey || tags.length === 0) {
    verdict = { accepted: false, reason: "invalid_event_shape" };
  } else if (params.event.pubkey === params.selfPubkey) {
    verdict = { accepted: false, reason: "self_echo" };
  } else {
    const communityId = getTagValue(tags, "e");
    if (!communityId) {
      verdict = { accepted: false, reason: "missing_community_tag" };
    } else if (communityId !== params.expectedCommunityId) {
      verdict = { accepted: false, reason: "community_mismatch" };
    } else {
      const senderDeviceId = getTagValue(tags, "d") ?? "unknown";
      const kTag = getTagValue(tags, "k");
      if (kTag === "anti-entropy-response") {
        const pTag = getTagValue(tags, "p");
        if (!pTag || pTag !== params.selfPubkey) {
          verdict = { accepted: false, reason: "anti_entropy_not_addressed_to_self" };
        } else {
          verdict = {
            accepted: true,
            channel: "anti_entropy_response",
            senderDeviceId,
            communityId,
          };
        }
      } else if (kTag === "anti-entropy-request") {
        verdict = {
          accepted: true,
          channel: "anti_entropy_request",
          senderDeviceId,
          communityId,
        };
      } else {
        verdict = {
          accepted: true,
          channel: "gossip",
          senderDeviceId,
          communityId,
        };
      }
    }
  }

  logAppEvent({
    name: "groups.membership_ingress_verdict",
    level: verdict.accepted ? "debug" : "warn",
    scope: { feature: "groups", action: "membership_ingress" },
    context: verdict.accepted
      ? {
          result: "accepted",
          channel: verdict.channel,
          eventIdHint: params.event.id.slice(0, 16),
          communityIdHint: verdict.communityId.slice(0, 48),
        }
      : {
          result: "rejected",
          reason: verdict.reason,
          eventIdHint: params.event.id.slice(0, 16),
          expectedCommunityIdHint: params.expectedCommunityId.slice(0, 48),
        },
  });

  return verdict;
};

