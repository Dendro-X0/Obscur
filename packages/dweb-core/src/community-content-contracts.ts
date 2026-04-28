import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

export type CommunityContentProtocolVersion = "obscur.community_content.v1";

export type CommunityContentSemantic =
  | "message"
  | "announcement"
  | "moderation_notice"
  | "system";

export type CommunityContentEncryptionSuite =
  | "obscur-room-key-aead-v1";

export type CommunityContentPayloadEncoding = "json";

export type CommunityContentAttachmentReference = Readonly<{
  mediaDescriptorId: string;
}>;

export type CommunityContentTransportEnvelope = Readonly<{
  protocol: CommunityContentProtocolVersion;
  semantic: CommunityContentSemantic;
  envelopeId: string;
  logicalMessageId: string;
  communityId: string;
  groupId: string;
  keyEpoch: number;
  senderAccountPublicKeyHex: PublicKeyHex;
  eventCreatedAtUnixSeconds: number;
  encryptionSuite: CommunityContentEncryptionSuite;
  payloadEncoding: CommunityContentPayloadEncoding;
  ciphertext: string;
  signature: string;
  replyToLogicalMessageId?: string;
}>;

export type CommunityContentPayload = Readonly<{
  payloadType: CommunityContentSemantic;
  payloadVersion: 1;
  logicalMessageId: string;
  plaintextBody?: string;
  attachmentReferences: ReadonlyArray<CommunityContentAttachmentReference>;
  createdAtUnixSeconds: number;
  protocolExtensions?: Readonly<Record<string, string | number | boolean | null>>;
}>;

export type CommunityContentEnvelope = Readonly<{
  transport: CommunityContentTransportEnvelope;
  payload: CommunityContentPayload;
}>;
