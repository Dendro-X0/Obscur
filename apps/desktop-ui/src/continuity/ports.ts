import type { ContinuityLinkedDevice } from "./continuity-linked-devices";
import type {
  ContinuityM6BackfillReport,
  ContinuityM6HomeBackfillResult,
} from "./continuity-m6-backfill";
import type {
  ContinuityPeerHistoryGrantOffer,
  ContinuityPeerHistoryGrantRecord,
} from "./continuity-peer-history-grant";
import type { ContinuityRestoreHonesty } from "./continuity-tiers";
import type { SealedSnapshotInventory } from "./sealed-snapshot-inventory";

/**
 * Cut 7.4 / 8–15 — Continuity M1–M6 + peer history grant ports.
 * Implementations must not invent CRM from chat-state (Cut 7.3).
 * ≠ Continuity Pass · M5 ≠ live sync · M6 ≠ invent CRM · grants ≠ invent CRM.
 */

export type ContinuityM6BackfillResult = ContinuityM6HomeBackfillResult;

export type ContinuityPeerGrantCreateRequest = Readonly<{
  recipientPublicKeyHex: string;
  opaqueHistoryJson?: string;
}>;

export type ContinuityPeerGrantCreateResult = Readonly<{
  ok: boolean;
  grantOfferJson?: string;
  transferCode?: string;
  grant?: ContinuityPeerHistoryGrantOffer;
  error?: string;
  reasonCode?: "missing_recipient" | "grant_create_failed" | "lab_stub";
}>;

export type ContinuityPeerGrantAcceptRequest = Readonly<{
  grantOfferJson: string;
  transferCode: string;
}>;

export type ContinuityPeerGrantAcceptResult = Readonly<{
  ok: boolean;
  record?: ContinuityPeerHistoryGrantRecord;
  error?: string;
  reasonCode?:
    | "invalid_offer"
    | "expired"
    | "wrong_code"
    | "recipient_mismatch"
    | "lab_stub";
}>;


export type ContinuityExportRequest = Readonly<{
  /** Plane 3 Continuity passphrase — wraps the sealed file. */
  continuityPassphrase: string;
  /**
   * Device unlock passphrase used only to unwrap local identity into the snapshot.
   * When omitted, Continuity passphrase is tried as the device password.
   */
  devicePassphrase?: string;
}>;

export type ContinuityImportRequest = Readonly<{
  continuityPassphrase: string;
}>;

export type ContinuityExportResult = Readonly<{
  ok: boolean;
  honesty: ContinuityRestoreHonesty;
  inventory: SealedSnapshotInventory;
  /** Serialized sealed envelope when export succeeds; omitted on refuse. */
  serialized?: string;
  /** Home backup id when M2 publish succeeds. */
  homeBackupId?: string;
  /** M4 offer JSON when device transfer offer succeeds. */
  transferOfferJson?: string;
  /** M4 transfer code (show once to the receiving device operator). */
  transferCode?: string;
  error?: string;
  reasonCode?:
    | "lab_stub"
    | "empty_snapshot"
    | "export_failed"
    | "missing_passphrase"
    | "import_failed"
    | "home_unavailable"
    | "home_publish_failed"
    | "transfer_offer_failed";
}>;

export type ContinuityImportResult = Readonly<{
  ok: boolean;
  honesty: ContinuityRestoreHonesty;
  inventory: SealedSnapshotInventory;
  error?: string;
  reasonCode?:
    | "lab_stub"
    | "invalid_bundle"
    | "import_failed"
    | "missing_passphrase"
    | "home_unavailable"
    | "home_empty"
    | "home_restore_failed"
    | "invalid_offer"
    | "expired"
    | "wrong_code"
    | "transfer_accept_failed";
}>;

export type ContinuityDeviceTransferAcceptRequest = ContinuityImportRequest & Readonly<{
  transferOfferJson: string;
  transferCode: string;
}>;

export type ContinuityPorts = Readonly<{
  /** Current Continuity honesty for this device (Plane 3 — not unlock). */
  getHonesty: () => ContinuityRestoreHonesty;
  getInventory: () => SealedSnapshotInventory;
  exportSealedSnapshot: (request: ContinuityExportRequest) => Promise<ContinuityExportResult>;
  importSealedSnapshot: (
    raw: string,
    request: ContinuityImportRequest,
  ) => Promise<ContinuityImportResult>;
  /** Cut 9 — publish sealed Continuity M1 to named private home (M2). */
  publishSealedSnapshotToHome: (request: ContinuityExportRequest) => Promise<ContinuityExportResult>;
  /** Cut 9 — fetch latest sealed Continuity M1 from home and import locally. */
  restoreSealedSnapshotFromHome: (
    request: ContinuityImportRequest & Readonly<{ publicKeyHexHint?: string }>,
  ) => Promise<ContinuityImportResult>;
  /** Cut 10 — create M4 device-transfer offer (clipboard/sneakernet). */
  createDeviceTransferOffer: (request: ContinuityExportRequest) => Promise<ContinuityExportResult>;
  /** Cut 10 — accept M4 offer with transfer code + Continuity passphrase. */
  acceptDeviceTransferOffer: (
    request: ContinuityDeviceTransferAcceptRequest,
  ) => Promise<ContinuityImportResult>;
  /** Cut 12 — M5 linked-device registry (local; ≠ live sync). */
  listLinkedDevices: () => ReadonlyArray<ContinuityLinkedDevice>;
  enrollThisDevice: (params?: Readonly<{ label?: string }>) => ContinuityLinkedDevice;
  revokeLinkedDevice: (deviceId: string) => ContinuityLinkedDevice | null;
  /** Cut 13 — M6 opaque envelope backfill from private home (≠ invent CRM). */
  backfillFromPrivateHome: (params?: Readonly<{
    sinceUnixMs?: number;
  }>) => Promise<ContinuityM6BackfillResult>;
  getLastHomeBackfillReport: () => ContinuityM6BackfillReport | null;
  /** Cut 15 — Ingredient 5 peer history grants (opaque residue · ≠ invent CRM). */
  createPeerHistoryGrant: (
    request: ContinuityPeerGrantCreateRequest,
  ) => ContinuityPeerGrantCreateResult;
  acceptPeerHistoryGrant: (
    request: ContinuityPeerGrantAcceptRequest,
  ) => ContinuityPeerGrantAcceptResult;
  listPeerHistoryGrants: () => ReadonlyArray<ContinuityPeerHistoryGrantRecord>;
}>;
