import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

/** Rust boot owner → JS consumer contract (AUTH-K2). */
export type AuthBootPhase =
  | "pending"
  | "locked"
  | "unlocked"
  | "mismatch"
  | "error";

export type AuthBootSnapshot = Readonly<{
  profileId: string;
  phase: AuthBootPhase;
  storedPublicKeyHex: PublicKeyHex | null;
  sessionPublicKeyHex: PublicKeyHex | null;
  keychainPresent: boolean;
  restoreEligible: boolean;
  atUnixMs: number;
}>;
