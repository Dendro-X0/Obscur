/**
 * Cut 7.2 — inventory EncryptedAccountBackupPayload v1 fields → Continuity tiers.
 * Pure map — does not import apps/pwa (desktop-ui Continuity door later).
 * Green inventory ≠ Continuity Pass · ≠ Soft L3 Fixed.
 * @see specs/backend/cut7-continuity-m1-sealed-file-design-2026-11-10.md
 */

import {
  CONTINUITY_C0_REQUIRED_TIERS,
  type ContinuityRestoreHonesty,
  type ContinuityTierId,
} from "./continuity-tiers";

/** Payload keys that belong in M1 sealed snapshot (v1 as-built). */
export const SEALED_SNAPSHOT_FIELD_TIER = Object.freeze({
  publicKeyHex: "T0",
  identityUnlock: "T0",
  profile: "T0",
  peerTrust: "T1",
  requestFlowEvidence: "T1",
  requestOutbox: "T1",
  messageDeleteTombstones: "T1",
  privacySettings: "T2",
  relayList: "T2",
  uiSettings: "T2",
  syncCheckpoints: "T2",
  communityMembershipLedger: "T2",
  roomKeys: "T2",
  chatState: "T3",
  nativeSqliteEvidence: "T3",
} as const);

export type SealedSnapshotFieldName = keyof typeof SEALED_SNAPSHOT_FIELD_TIER;

export const SEALED_SNAPSHOT_CORE_FIELDS = Object.freeze(
  Object.keys(SEALED_SNAPSHOT_FIELD_TIER) as SealedSnapshotFieldName[],
);

export type SealedSnapshotInventory = Readonly<{
  presentFields: ReadonlyArray<SealedSnapshotFieldName>;
  tiersPresent: ReadonlyArray<ContinuityTierId>;
  missingRequiredTiers: ReadonlyArray<ContinuityTierId>;
  t3Present: boolean;
  t4Present: boolean;
  honesty: ContinuityRestoreHonesty;
}>;

const asFieldName = (value: string): SealedSnapshotFieldName | null => (
  Object.prototype.hasOwnProperty.call(SEALED_SNAPSHOT_FIELD_TIER, value)
    ? value as SealedSnapshotFieldName
    : null
);

/**
 * Inventory which Continuity tiers a sealed payload covers from present field names.
 * `restoring` is reserved for in-flight UI; this classifier is for payload evidence only.
 */
export const inventorySealedSnapshotFields = (
  presentFieldNames: ReadonlyArray<string>,
  options?: Readonly<{ restoring?: boolean }>,
): SealedSnapshotInventory => {
  if (options?.restoring === true) {
    return {
      presentFields: [],
      tiersPresent: [],
      missingRequiredTiers: [...CONTINUITY_C0_REQUIRED_TIERS],
      t3Present: false,
      t4Present: false,
      honesty: "restoring",
    };
  }

  const presentFields = presentFieldNames
    .map(asFieldName)
    .filter((name): name is SealedSnapshotFieldName => name !== null);

  const tierSet = new Set<ContinuityTierId>();
  for (const field of presentFields) {
    tierSet.add(SEALED_SNAPSHOT_FIELD_TIER[field]);
  }

  const tiersPresent = (["T0", "T1", "T2", "T3", "T4"] as const)
    .filter((tier) => tierSet.has(tier));

  const missingRequiredTiers = CONTINUITY_C0_REQUIRED_TIERS.filter(
    (tier) => !tierSet.has(tier),
  );

  const t3Present = tierSet.has("T3");
  const t4Present = tierSet.has("T4");

  let honesty: ContinuityRestoreHonesty = "empty";
  if (missingRequiredTiers.length === 0) {
    honesty = t3Present && t4Present ? "full" : "partial";
  } else if (tiersPresent.length > 0) {
    honesty = "partial";
  }

  return {
    presentFields,
    tiersPresent,
    missingRequiredTiers,
    t3Present,
    t4Present,
    honesty,
  };
};

/** C0 law: every M1 export must cover T0–T2 field slots (values may be empty arrays). */
export const sealedSnapshotMeetsC0RequiredTiers = (
  inventory: SealedSnapshotInventory,
): boolean => inventory.missingRequiredTiers.length === 0;
