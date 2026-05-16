/**
 * Every account-scoped persistence operation must carry explicit scope.
 * Do not derive profile from ambient globals at the port boundary.
 */
export type ProfileId = string;

export type PublicKeyHex = string;

export type ScopedPersistenceScope = Readonly<{
    profileId: ProfileId;
    publicKeyHex: PublicKeyHex;
}>;
