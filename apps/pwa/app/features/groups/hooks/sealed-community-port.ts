"use client";

/**
 * Sealed-community legacy hook port — visual-only stub until workspace-kernel owns ingress.
 * Enablement gates live in `sealed-community-instance-policy.ts` (workspace-kernel authority).
 */
export {
  useLegacySealedCommunity,
  useSealedCommunity,
  type GroupMessageEvent,
  type UseSealedCommunityParams,
  type UseSealedCommunityResult,
  COMMUNITY_KNOWN_PARTICIPANTS_OBSERVED_EVENT,
  GROUP_MEMBERSHIP_SNAPSHOT_EVENT,
  hasCommunityBindingTag,
  isScopedRelayEvent,
  isValidScopedRelayUrl,
  mergeGroupMessagesDescending,
  normalizeRelayUrl,
  toScopedRelayUrl,
} from "./use-sealed-community-legacy";
