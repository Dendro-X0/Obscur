import type { IdentityRecord } from "@dweb/core/identity-record";

export const PASSWORDLESS_NATIVE_ONLY_SENTINEL = "__obscur_native_only__" as const;

export const isPasswordlessNativeOnlyIdentity = (
  record?: Pick<IdentityRecord, "encryptedPrivateKey"> | null,
): boolean => record?.encryptedPrivateKey === PASSWORDLESS_NATIVE_ONLY_SENTINEL;
