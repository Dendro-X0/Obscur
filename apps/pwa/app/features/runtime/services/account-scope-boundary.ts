import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { logAppEvent } from "@/app/shared/log-app-event";

export type AccountScopeKey = Readonly<{
  profileId: string;
  publicKeyHex: PublicKeyHex;
}>;

export const ACCOUNT_SCOPE_BOUNDARY_CHANGED_EVENT = "obscur:account-scope-boundary-changed";

export type AccountScopeBoundaryChangedDetail = Readonly<{
  previous: AccountScopeKey | null;
  next: AccountScopeKey | null;
}>;

export const toAccountScopeKey = (
  profileId: string | null | undefined,
  publicKeyHex: string | null | undefined,
): AccountScopeKey | null => {
  const normalizedProfileId = profileId?.trim() ?? "";
  const normalizedPublicKeyHex = publicKeyHex?.trim().toLowerCase() ?? "";
  if (normalizedProfileId.length === 0 || normalizedPublicKeyHex.length !== 64) {
    return null;
  }
  return {
    profileId: normalizedProfileId,
    publicKeyHex: normalizedPublicKeyHex as PublicKeyHex,
  };
};

export const formatAccountScopeKey = (scope: AccountScopeKey): string => (
  `${scope.profileId}::${scope.publicKeyHex}`
);

export const accountScopeKeysEqual = (
  left: AccountScopeKey | null | undefined,
  right: AccountScopeKey | null | undefined,
): boolean => (
  left?.profileId === right?.profileId
  && left?.publicKeyHex === right?.publicKeyHex
);

export const emitAccountScopeBoundaryChanged = (detail: AccountScopeBoundaryChangedDetail): void => {
  if (typeof window === "undefined") {
    return;
  }
  logAppEvent({
    name: "runtime.account_scope_boundary_changed",
    level: "info",
    scope: { feature: "runtime", action: "account_scope" },
    context: {
      previousProfileId: detail.previous?.profileId ?? null,
      previousPublicKeySuffix: detail.previous?.publicKeyHex.slice(-8) ?? null,
      nextProfileId: detail.next?.profileId ?? null,
      nextPublicKeySuffix: detail.next?.publicKeyHex.slice(-8) ?? null,
    },
  });
  window.dispatchEvent(new CustomEvent(ACCOUNT_SCOPE_BOUNDARY_CHANGED_EVENT, { detail }));
};
