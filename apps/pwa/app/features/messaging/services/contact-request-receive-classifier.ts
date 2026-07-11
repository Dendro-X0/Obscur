import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { isPendingContactHandshake } from "./dm-peer-established-ui";

export type ConnectionReceiveLifecycleTag =
  | "connection-request"
  | "connection-qna"
  | "connection-accept"
  | "connection-decline"
  | "connection-cancel"
  | "connection-received"
  | "connection-receipt";

const CONNECTION_RECEIVE_LIFECYCLE_TAGS = new Set<string>([
  "connection-request",
  "connection-qna",
  "connection-accept",
  "connection-decline",
  "connection-cancel",
  "connection-received",
  "connection-receipt",
]);

export const resolveConnectionReceiveLifecycleTag = (
  tags: ReadonlyArray<ReadonlyArray<string>>,
): ConnectionReceiveLifecycleTag | null => {
  const lifecycleTag = tags.find((tag) => tag[0] === "t")?.[1];
  if (!lifecycleTag || !CONNECTION_RECEIVE_LIFECYCLE_TAGS.has(lifecycleTag)) {
    return null;
  }
  return lifecycleTag as ConnectionReceiveLifecycleTag;
};

export type ContactRequestReceiveRoute =
  | Readonly<{ kind: "sandbox_message"; lifecycleTag: "connection-request" | "connection-qna" }>
  | Readonly<{ kind: "lifecycle"; lifecycleTag: "connection-accept" | "connection-decline" | "connection-cancel" }>
  | Readonly<{ kind: "wire_evidence"; lifecycleTag: "connection-received" | "connection-receipt" }>
  | Readonly<{ kind: "none" }>;

export const resolveContactRequestReceiveRoute = (params: Readonly<{
  tags: ReadonlyArray<ReadonlyArray<string>>;
}>): ContactRequestReceiveRoute => {
  const lifecycleTag = resolveConnectionReceiveLifecycleTag(params.tags);
  if (!lifecycleTag) {
    return { kind: "none" };
  }
  if (lifecycleTag === "connection-request" || lifecycleTag === "connection-qna") {
    return { kind: "sandbox_message", lifecycleTag };
  }
  if (
    lifecycleTag === "connection-accept"
    || lifecycleTag === "connection-decline"
    || lifecycleTag === "connection-cancel"
  ) {
    return { kind: "lifecycle", lifecycleTag };
  }
  return { kind: "wire_evidence", lifecycleTag };
};

export type RequestStatusSnapshot = Readonly<{
  status?: string;
  isOutgoing?: boolean;
}> | null | undefined;

export const shouldBlockUntaggedStrangerDm = (params: Readonly<{
  isSelfAuthored: boolean;
  isPeerAcceptedByTrust: boolean;
  requestStatus: RequestStatusSnapshot;
}>): boolean => {
  if (params.isSelfAuthored) {
    return false;
  }
  if (params.isPeerAcceptedByTrust) {
    return false;
  }
  if (params.requestStatus?.status === "accepted") {
    return false;
  }
  return true;
};

export const shouldAcceptSandboxQna = (params: Readonly<{
  lifecycleTag: "connection-qna";
  isSelfAuthored: boolean;
  requestStatus: RequestStatusSnapshot;
}>): boolean => {
  if (params.isSelfAuthored) {
    return true;
  }
  return isPendingContactHandshake(params.requestStatus);
};

export const resolvePeerPublicKeyHexForIncomingEvent = (params: Readonly<{
  isSelfAuthored: boolean;
  senderPubkey: string;
  tags: ReadonlyArray<ReadonlyArray<string>>;
}>): PublicKeyHex | null => {
  const peerPubkey = params.isSelfAuthored
    ? (params.tags.find((tag) => tag[0] === "p")?.[1] || "")
    : params.senderPubkey;
  const trimmed = peerPubkey.trim();
  return trimmed.length > 0 ? (trimmed as PublicKeyHex) : null;
};

export const resolveRequestEventIdFromTags = (
  tags: ReadonlyArray<ReadonlyArray<string>>,
): string | undefined => {
  const eventId = tags.find((tag) => tag[0] === "e")?.[1]?.trim();
  return eventId && eventId.length > 0 ? eventId : undefined;
};
