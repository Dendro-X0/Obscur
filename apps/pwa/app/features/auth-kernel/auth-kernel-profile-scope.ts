/** AUTH-KERN-4 — profile scope invariants for auth-kernel plane C/D boundaries. */

export const authKernelProfileScopeMatches = (
  requestedProfileId: string,
  resolvedProfileId: string,
): boolean => (
  requestedProfileId.trim() === resolvedProfileId.trim()
);

export const authKernelKeychainEntryIdForProfile = (profileId: string): string => (
  `nsec::${profileId.trim()}`
);

export const authKernelLoginAssistEntryIdForProfile = (profileId: string): string => (
  `login_assist_${profileId.trim().replace(/:/g, "_")}`
);
