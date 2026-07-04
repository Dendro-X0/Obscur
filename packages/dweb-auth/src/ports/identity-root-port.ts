import type { IdentityRecord } from "@dweb/core/identity-record";
import type { Passphrase } from "@dweb/crypto/passphrase";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { AuthResult } from "../contracts/auth-result";

export type CreateIdentityParams = Readonly<{
  profileId: string;
  passphrase: Passphrase;
  username?: string;
}>;

export type ImportIdentityParams = Readonly<{
  profileId: string;
  privateKeyHex: PrivateKeyHex;
  passphrase: Passphrase;
  username?: string;
}>;

export type ReadStoredIdentityParams = Readonly<{
  profileId: string;
}>;

export type StoredIdentitySnapshot = Readonly<{
  profileId: string;
  record: IdentityRecord | null;
  publicKeyHex: PublicKeyHex | null;
}>;

/** Plane A — local identity root lifecycle (no network). */
export type IdentityRootPort = Readonly<{
  createIdentity: (params: CreateIdentityParams) => Promise<AuthResult<IdentityRecord>>;
  importIdentity: (params: ImportIdentityParams) => Promise<AuthResult<IdentityRecord>>;
  readStoredIdentity: (params: ReadStoredIdentityParams) => Promise<AuthResult<StoredIdentitySnapshot>>;
}>;

export const IDENTITY_ROOT_PORT_ID = "obscur.auth.identity-root" as const;
