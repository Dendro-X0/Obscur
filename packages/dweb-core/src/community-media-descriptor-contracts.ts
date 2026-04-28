export type CommunityMediaKind = "image" | "video" | "audio" | "file";

export type CommunityMediaEncryptionSuite =
  | "obscur-file-aead-v1";

export type CommunityMediaThumbnailDescriptor = Readonly<{
  mediaDescriptorId: string;
  storageUrl: string;
  encryptedMetadataState: "unknown" | "available" | "missing";
}>;

export type CommunityMediaDescriptor = Readonly<{
  mediaDescriptorId: string;
  communityId: string;
  sourceLogicalMessageId: string;
  kind: CommunityMediaKind;
  encryptionSuite: CommunityMediaEncryptionSuite;
  storageUrl: string;
  encryptedBlobDigestHex: string;
  encryptedByteLength?: number;
  wrappedFileKey?: string;
  encryptedMetadataState: "unknown" | "available" | "missing";
  localCacheState: "uncached" | "cached" | "failed";
  contentAvailabilityState: "available" | "pending_key" | "quarantined" | "deleted";
  thumbnailDescriptor?: CommunityMediaThumbnailDescriptor;
}>;
