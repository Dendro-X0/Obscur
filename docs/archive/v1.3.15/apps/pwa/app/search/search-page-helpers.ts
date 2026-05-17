import { isValidInviteCode } from "@/app/features/invites/utils/invite-parser";
import { extractContactCardFromQuery } from "@/app/features/search/services/contact-card";
import { parsePublicKeyInput } from "@/app/features/profile/utils/parse-public-key-input";

export const isDeterministicDirectQuery = (
  value: string,
  options?: Readonly<{ allowLegacyInviteCode?: boolean }>
): boolean => {
  void options;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (parsePublicKeyInput(trimmed).ok) return true;
  if (Boolean(extractContactCardFromQuery(trimmed))) return true;
  // Legacy OBSCUR-* friend codes are a public compatibility contract and must
  // remain resolvable even if rollout flags drift.
  if (isValidInviteCode(trimmed.toUpperCase())) return true;
  return false;
};

export const searchPageHelpers = {
  isDeterministicDirectQuery,
};
