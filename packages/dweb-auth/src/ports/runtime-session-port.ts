import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { AuthBootSnapshot } from "../contracts/auth-boot-snapshot";
import type { AuthSessionDiagnosticSnapshot } from "../contracts/auth-diagnostic";
import type { AuthResult } from "../contracts/auth-result";

export type RuntimeSessionStatus = Readonly<{
  profileId: string;
  isActive: boolean;
  publicKeyHex: PublicKeyHex | null;
  isNative: boolean;
}>;

/** Plane D — in-memory signing session + boot hydrate owner (Rust-first in AUTH-K2). */
export type RuntimeSessionPort = Readonly<{
  readBootSnapshot: (params: Readonly<{
    profileId: string;
    expectedPublicKeyHex?: PublicKeyHex;
    restoreEligible?: boolean;
  }>) => Promise<AuthResult<AuthBootSnapshot>>;
  readSessionStatus: (profileId: string) => Promise<AuthResult<RuntimeSessionStatus>>;
  forceRestoreSession: (params: Readonly<{
    profileId: string;
    expectedPublicKeyHex?: PublicKeyHex;
  }>) => Promise<AuthResult<RuntimeSessionStatus>>;
  lockSession: (profileId: string) => Promise<AuthResult<void>>;
  signOutSession: (profileId: string) => Promise<AuthResult<void>>;
  readDiagnostic: (params: Readonly<{
    profileId: string;
    storedPublicKeyHex?: PublicKeyHex | null;
  }>) => Promise<AuthResult<AuthSessionDiagnosticSnapshot>>;
}>;

export const RUNTIME_SESSION_PORT_ID = "obscur.auth.runtime-session" as const;
