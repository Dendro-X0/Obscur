import type { SemanticCommunityMemberEvent } from "@dweb/transport-contracts";
import { mapSealedControlPayloadToSemanticCommunityEvent } from "@dweb/transport-nostr";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

export type MapSealedMembershipSemanticParams = Readonly<{
  communityId: string;
  actorPublicKeyHex: PublicKeyHex;
  logicalEventId: string;
  createdAtUnixMs: number;
  innerPayload: Readonly<Record<string, unknown>>;
}>;

export const mapSealedMembershipSemanticEvent = (
  params: MapSealedMembershipSemanticParams,
): SemanticCommunityMemberEvent | null => (
  mapSealedControlPayloadToSemanticCommunityEvent({
    communityId: params.communityId,
    actorPublicKeyHex: params.actorPublicKeyHex,
    logicalEventId: params.logicalEventId,
    createdAtUnixMs: params.createdAtUnixMs,
    innerPayload: params.innerPayload,
    source: "nostr",
  })
);

export type MembershipControlEventBase = Readonly<{
  eventType: SemanticCommunityMemberEvent["type"];
  logicalEventId: string;
  createdAtUnixMs: number;
  subjectPublicKeyHex: PublicKeyHex;
}>;

export const toMembershipControlEventBase = (
  semantic: SemanticCommunityMemberEvent,
): MembershipControlEventBase => ({
  eventType: semantic.type,
  logicalEventId: semantic.logicalEventId,
  createdAtUnixMs: semantic.createdAtUnixMs,
  subjectPublicKeyHex: semantic.subjectPublicKeyHex as PublicKeyHex,
});
