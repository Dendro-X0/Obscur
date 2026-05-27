import type {
  SemanticCommunityMemberEvent,
  TransportKind,
} from "@dweb/transport-contracts";

export type MapSealedControlPayloadParams = Readonly<{
  communityId: string;
  actorPublicKeyHex: string;
  logicalEventId: string;
  createdAtUnixMs: number;
  innerPayload: Readonly<Record<string, unknown>>;
  source?: TransportKind;
}>;

const readPayloadType = (innerPayload: Readonly<Record<string, unknown>>): string | null => (
  typeof innerPayload.type === "string" ? innerPayload.type : null
);

const readPayloadTimestamp = (
  innerPayload: Readonly<Record<string, unknown>>,
  fallbackUnixMs: number,
): number => {
  const raw = innerPayload.created_at;
  return typeof raw === "number" && Number.isFinite(raw) ? raw : fallbackUnixMs;
};

/**
 * Maps decrypted sealed community control `innerPayload` (Kind 10105) to kernel semantic events.
 * Returns null when the payload is not a membership control message handled by this adapter.
 */
export const mapSealedControlPayloadToSemanticCommunityEvent = (
  params: MapSealedControlPayloadParams,
): SemanticCommunityMemberEvent | null => {
  const source = params.source ?? "nostr";
  const payloadType = readPayloadType(params.innerPayload);
  if (!payloadType) {
    return null;
  }

  const createdAtUnixMs = readPayloadTimestamp(params.innerPayload, params.createdAtUnixMs);

  if (payloadType === "leave") {
    return {
      type: "COMMUNITY_MEMBER_LEFT",
      communityId: params.communityId,
      subjectPublicKeyHex: params.actorPublicKeyHex,
      actorPublicKeyHex: params.actorPublicKeyHex,
      createdAtUnixMs,
      logicalEventId: params.logicalEventId,
      source,
    };
  }

  if (payloadType === "join") {
    return {
      type: "COMMUNITY_MEMBER_JOINED",
      communityId: params.communityId,
      subjectPublicKeyHex: params.actorPublicKeyHex,
      actorPublicKeyHex: params.actorPublicKeyHex,
      createdAtUnixMs,
      logicalEventId: params.logicalEventId,
      source,
    };
  }

  if (payloadType === "membership_restate") {
    return {
      type: "COMMUNITY_MEMBER_JOINED",
      communityId: params.communityId,
      subjectPublicKeyHex: params.actorPublicKeyHex,
      actorPublicKeyHex: params.actorPublicKeyHex,
      createdAtUnixMs,
      logicalEventId: `restate:${params.logicalEventId}`,
      source,
    };
  }

  return null;
};
