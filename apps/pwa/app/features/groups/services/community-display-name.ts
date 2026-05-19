export const PLACEHOLDER_GROUP_DISPLAY_NAME = "Private Group";

const OPAQUE_HEX_IDENTIFIER_PATTERN = /^[0-9a-f]{16,}$/i;

export type CommunityDisplayNameContext = Readonly<{
  groupId?: string | null;
  communityId?: string | null;
}>;

export const normalizeCommunityDisplayName = (value: string | undefined | null): string => (
  (value ?? "").trim()
);

/** Relay/sealed metadata often falls back to the raw group id — not a human label. */
export const isLikelyOpaqueGroupIdentifier = (
  value: string | undefined,
  context?: CommunityDisplayNameContext,
): boolean => {
  const trimmed = normalizeCommunityDisplayName(value);
  if (trimmed.length === 0) {
    return false;
  }
  const groupId = normalizeCommunityDisplayName(context?.groupId);
  const communityId = normalizeCommunityDisplayName(context?.communityId);
  if (groupId.length > 0 && trimmed.toLowerCase() === groupId.toLowerCase()) {
    return true;
  }
  if (communityId.length > 0 && trimmed.toLowerCase() === communityId.toLowerCase()) {
    return true;
  }
  return OPAQUE_HEX_IDENTIFIER_PATTERN.test(trimmed);
};

export const hasMeaningfulCommunityDisplayName = (
  value: string | undefined,
  context?: CommunityDisplayNameContext,
): boolean => {
  const trimmed = normalizeCommunityDisplayName(value);
  if (trimmed.length === 0) {
    return false;
  }
  if (trimmed === PLACEHOLDER_GROUP_DISPLAY_NAME) {
    return false;
  }
  return !isLikelyOpaqueGroupIdentifier(trimmed, context);
};

export const pickPreferredCommunityDisplayName = (
  primary: string | undefined,
  fallback: string | undefined,
  context?: CommunityDisplayNameContext,
): string => {
  if (hasMeaningfulCommunityDisplayName(primary, context)) {
    return normalizeCommunityDisplayName(primary);
  }
  if (hasMeaningfulCommunityDisplayName(fallback, context)) {
    return normalizeCommunityDisplayName(fallback);
  }
  const primaryTrimmed = normalizeCommunityDisplayName(primary);
  const fallbackTrimmed = normalizeCommunityDisplayName(fallback);
  if (primaryTrimmed.length > 0 && !isLikelyOpaqueGroupIdentifier(primaryTrimmed, context)) {
    return primaryTrimmed;
  }
  if (fallbackTrimmed.length > 0 && !isLikelyOpaqueGroupIdentifier(fallbackTrimmed, context)) {
    return fallbackTrimmed;
  }
  return primaryTrimmed || fallbackTrimmed || PLACEHOLDER_GROUP_DISPLAY_NAME;
};

export type ResolveCommunityDisplayNameParams = Readonly<{
  /** Relay / sealed metadata name (may be group id hex). */
  metadataName?: string | null;
  /** Locally persisted operator-chosen name (`createdGroups.displayName`). */
  persistedDisplayName?: string | null;
  groupId?: string | null;
  communityId?: string | null;
  fallback?: string;
}>;

/** Prefer durable local display name over thin relay metadata. */
export const resolveCommunityDisplayName = (
  params: ResolveCommunityDisplayNameParams,
): string => {
  const context: CommunityDisplayNameContext = {
    groupId: params.groupId,
    communityId: params.communityId,
  };
  const resolved = pickPreferredCommunityDisplayName(
    params.persistedDisplayName ?? undefined,
    params.metadataName ?? undefined,
    context,
  );
  if (hasMeaningfulCommunityDisplayName(resolved, context)) {
    return resolved;
  }
  const fallback = normalizeCommunityDisplayName(params.fallback);
  if (fallback.length > 0) {
    return fallback;
  }
  return resolved;
};
