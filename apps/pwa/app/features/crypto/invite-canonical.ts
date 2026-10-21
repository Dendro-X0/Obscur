import type { InviteSignaturePayload } from "./crypto-interfaces";

/**
 * Wire-compatible canonicalize for invite / contact-card signatures.
 * Must match CryptoServiceImpl.canonicalizeData (including `undefined` values).
 * @see specs/backend/crypto-native-invite-sign-design-2026-10.md
 */
export function canonicalizeInviteData(data: InviteSignaturePayload): string {
  const keys = Object.keys(data).sort();
  return keys
    .map((k) => {
      const value = (data as unknown as Record<string, unknown>)[k];
      return `${k}:${typeof value === "object" ? JSON.stringify(value) : value}`;
    })
    .join("|");
}
