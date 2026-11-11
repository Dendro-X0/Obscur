import {
  inventorySealedSnapshotFields,
  type SealedSnapshotInventory,
} from "./sealed-snapshot-inventory";
import type { ContinuityPorts } from "./ports";
import type { ContinuityRestoreHonesty } from "./continuity-tiers";

/**
 * Cut 7.4 / 8–13 lab Continuity ports — honesty + inventory only.
 * Real M1/M2/M4/M5/M6: native vite adapter when prefer-native.
 * ≠ Continuity Pass.
 */

const LAB_FIELD_SET = Object.freeze([
  "publicKeyHex",
  "profile",
  "peerTrust",
  "privacySettings",
  "relayList",
  "uiSettings",
] as const);

export const createLabContinuityPorts = (params?: Readonly<{
  presentFields?: ReadonlyArray<string>;
  honestyOverride?: ContinuityRestoreHonesty;
}>): ContinuityPorts => {
  const presentFields = params?.presentFields ?? [...LAB_FIELD_SET];

  const inventory = (): SealedSnapshotInventory => {
    const base = inventorySealedSnapshotFields(presentFields);
    if (params?.honestyOverride) {
      return { ...base, honesty: params.honestyOverride };
    }
    return base;
  };

  const refuse = async () => {
    const snap = inventory();
    return {
      ok: false as const,
      honesty: snap.honesty,
      inventory: snap,
      reasonCode: "lab_stub" as const,
      error: "Lab Continuity door — native M1/M2/M4 adapter off (OBSCUR_DESKTOP_UI_LAB_STUBS or no host) · ≠ Continuity Pass",
    };
  };

  return {
    getHonesty: () => inventory().honesty,
    getInventory: () => inventory(),
    exportSealedSnapshot: async () => refuse(),
    importSealedSnapshot: async () => refuse(),
    publishSealedSnapshotToHome: async () => refuse(),
    restoreSealedSnapshotFromHome: async () => refuse(),
    createDeviceTransferOffer: async () => refuse(),
    acceptDeviceTransferOffer: async () => refuse(),
    listLinkedDevices: () => [],
    enrollThisDevice: () => {
      throw new Error("Lab Continuity door — linked-device enroll off · ≠ Continuity Pass");
    },
    revokeLinkedDevice: () => null,
    backfillFromPrivateHome: async () => ({
      ok: false,
      reasonCode: "home_unavailable",
      error: "Lab Continuity door — M6 home backfill off · ≠ Continuity Pass",
    }),
    getLastHomeBackfillReport: () => null,
    createPeerHistoryGrant: () => ({
      ok: false,
      reasonCode: "lab_stub",
      error: "Lab Continuity door — peer history grants off · ≠ Continuity Pass",
    }),
    acceptPeerHistoryGrant: () => ({
      ok: false,
      reasonCode: "lab_stub",
      error: "Lab Continuity door — peer history grants off · ≠ Continuity Pass",
    }),
    listPeerHistoryGrants: () => [],
  };
};
