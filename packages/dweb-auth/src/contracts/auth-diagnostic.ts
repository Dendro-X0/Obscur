import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";

export type AuthSessionOverallStatus =
  | "unavailable"
  | "off"
  | "active"
  | "ready"
  | "keychain_missing"
  | "mismatch"
  | "persist_error";

export type AuthIdentityMatch = "ok" | "mismatch" | "unknown";

export type AuthSessionDiagnosticSnapshot = Readonly<{
  profileId: string;
  status: AuthSessionOverallStatus;
  staySignedInEnabled: boolean;
  usesNativeSecureStore: boolean;
  inMemorySessionActive: boolean;
  keychainPublicKeyHex: PublicKeyHex | null;
  storedPublicKeyHex: PublicKeyHex | null;
  identityMatch: AuthIdentityMatch;
  lastPersistError: string | null;
  checkedAtUnixMs: number;
}>;
