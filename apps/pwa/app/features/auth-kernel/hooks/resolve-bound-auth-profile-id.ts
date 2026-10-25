import { resolveIdentityScopeProfileId } from "@/app/features/profiles/services/read-active-desktop-profile-id";

/**
 * Profile id for auth-kernel bound ops. Prefer identity scope over a stale
 * window-session "default" — assertAuthKernelProfileScope matches identity scope.
 */
export const resolveBoundAuthProfileId = (sessionProfileId: string): string => {
  const identityScope = resolveIdentityScopeProfileId().trim();
  return identityScope || sessionProfileId.trim();
};
