/**
 * Cut 8–13 — Vite Continuity M1/M2/M4 + M5 registry + M6 home backfill ports.
 * No apps/pwa import · ≠ Continuity Pass · Soft L3 paused · M5 ≠ live sync · M6 ≠ invent CRM.
 * @see specs/backend/cut8-native-continuity-m1-adapter-design-2026-11-10.md
 * @see specs/backend/cut9-continuity-m2-auto-dc-design-2026-11-10.md
 * @see specs/backend/cut10-continuity-m4-device-transfer-design-2026-11-10.md
 * @see specs/backend/cut12-continuity-m5-linked-devices-design-2026-11-10.md
 * @see specs/backend/cut13-continuity-m6-home-backfill-design-2026-11-10.md
 */

import type { Passphrase } from "@dweb/crypto/passphrase";
import { decryptPrivateKeyHex } from "@dweb/crypto/decrypt-private-key-hex";
import { derivePublicKeyHex } from "@dweb/crypto/derive-public-key-hex";
import { encryptPrivateKeyHex } from "@dweb/crypto/encrypt-private-key-hex";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import {
  fetchLatestPrivateDcContinuityBackup,
  putPrivateDcContinuityBackup,
  type PrivateDcHomeSession,
} from "@obscur/private-trust-engine";
import {
  readViteIdentityRecord,
  writeViteIdentityRecord,
  type ViteIdentityRecord,
} from "../auth/vite-passphrase-device-unlock";
import { readVitePrivateDcSession } from "../private-trust/vite-private-dc-session";
import {
  enrollContinuityLinkedDevice,
  readContinuityLinkedDevices,
  revokeContinuityLinkedDevice,
  writeContinuityLinkedDevices,
} from "./continuity-linked-devices";
import {
  createContinuityM4Offer,
  serializeContinuityM4Offer,
  verifyContinuityM4Offer,
} from "./continuity-m4-offer";
import {
  readContinuityM6BackfillReport,
  runContinuityM6HomeBackfill,
} from "./continuity-m6-backfill";
import {
  acceptContinuityPeerHistoryGrant,
  buildOpaquePeerHistoryJson,
  createContinuityPeerHistoryGrantOffer,
  readContinuityPeerHistoryGrants,
  recordOutgoingContinuityPeerHistoryGrant,
  serializeContinuityPeerHistoryGrantOffer,
} from "./continuity-peer-history-grant";
import {
  CONTINUITY_M1_SNAPSHOT_FORMAT,
  presentContinuityM1FieldNames,
  type ContinuityM1PeerTrust,
  type ContinuityM1Snapshot,
} from "./continuity-m1-snapshot";
import type { ContinuityPorts } from "./ports";
import { inventorySealedSnapshotFields } from "./sealed-snapshot-inventory";
import {
  sealContinuityM1Snapshot,
  serializeContinuityM1SealedEnvelope,
  unsealContinuityM1Snapshot,
} from "./vite-continuity-m1-seal";
import {
  readViteSettingsResidue,
  writeViteSettingsResidue,
} from "../settings/vite-settings-residue";

/** Same key prefix as pwa peer-trust storage — duplicated, not imported. */
export const VITE_PEER_TRUST_STORAGE_PREFIX = "obscur.peer_trust.v1";

export const getVitePeerTrustStorageKey = (publicKeyHex: string): string => (
  `${VITE_PEER_TRUST_STORAGE_PREFIX}.${publicKeyHex}`
);

const emptyInventory = () => inventorySealedSnapshotFields([]);

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === "object" && value !== null
);

export const readVitePeerTrust = (publicKeyHex: string): ContinuityM1PeerTrust => {
  if (typeof window === "undefined" || !publicKeyHex.trim()) {
    return { acceptedPeers: [], mutedPeers: [] };
  }
  const raw = window.localStorage.getItem(getVitePeerTrustStorageKey(publicKeyHex));
  if (!raw) {
    return { acceptedPeers: [], mutedPeers: [] };
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed)) {
      return { acceptedPeers: [], mutedPeers: [] };
    }
    const acceptedPeers = Array.isArray(parsed.acceptedPeers)
      ? parsed.acceptedPeers.filter((v): v is string => typeof v === "string")
      : [];
    const mutedPeers = Array.isArray(parsed.mutedPeers)
      ? parsed.mutedPeers.filter((v): v is string => typeof v === "string")
      : [];
    return { acceptedPeers, mutedPeers };
  } catch {
    return { acceptedPeers: [], mutedPeers: [] };
  }
};

export const writeVitePeerTrust = (
  publicKeyHex: string,
  peerTrust: ContinuityM1PeerTrust,
): void => {
  if (typeof window === "undefined" || !publicKeyHex.trim()) {
    return;
  }
  window.localStorage.setItem(
    getVitePeerTrustStorageKey(publicKeyHex),
    JSON.stringify({
      acceptedPeers: [...peerTrust.acceptedPeers],
      mutedPeers: [...peerTrust.mutedPeers],
    }),
  );
};

const unwrapIdentityPrivateKey = async (params: Readonly<{
  record: ViteIdentityRecord;
  devicePassphrase: Passphrase;
}>): Promise<PrivateKeyHex> => {
  const privateKeyHex = await decryptPrivateKeyHex({
    payload: params.record.encryptedPrivateKey,
    passphrase: params.devicePassphrase,
  });
  const derived = derivePublicKeyHex(privateKeyHex);
  if (derived.toLowerCase() !== params.record.publicKeyHex.toLowerCase()) {
    throw new Error("Incorrect device password");
  }
  return privateKeyHex;
};

const downloadSealedFile = (serialized: string, publicKeyHex: string): void => {
  if (typeof document === "undefined") {
    return;
  }
  const blob = new Blob([serialized], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const short = publicKeyHex.slice(0, 8) || "account";
  anchor.href = url;
  anchor.download = `obscur-continuity-m1-${short}.json`;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

export type CreateViteContinuityPortsParams = Readonly<{
  profileId: string;
  readIdentityRecord?: (profileId: string) => ViteIdentityRecord | null;
  readPeerTrust?: (publicKeyHex: string) => ContinuityM1PeerTrust;
  writeIdentityRecord?: (profileId: string, record: ViteIdentityRecord) => void;
  writePeerTrust?: (publicKeyHex: string, peerTrust: ContinuityM1PeerTrust) => void;
  downloadOnExport?: boolean;
  readHomeSession?: (profileId: string) => PrivateDcHomeSession | null;
  fetchImpl?: typeof fetch;
}>;

export const createViteContinuityPorts = (
  params: CreateViteContinuityPortsParams,
): ContinuityPorts => {
  const readIdentity = params.readIdentityRecord ?? readViteIdentityRecord;
  const readPeerTrust = params.readPeerTrust ?? readVitePeerTrust;
  const writeIdentity = params.writeIdentityRecord ?? writeViteIdentityRecord;
  const writePeerTrust = params.writePeerTrust ?? writeVitePeerTrust;
  const downloadOnExport = params.downloadOnExport !== false;
  const readHomeSession = params.readHomeSession ?? readVitePrivateDcSession;
  const fetchImpl = params.fetchImpl ?? fetch;

  const inventoryFromLocal = () => {
    const record = readIdentity(params.profileId);
    if (!record) {
      return emptyInventory();
    }
    const peerTrust = readPeerTrust(record.publicKeyHex);
    const linkedDevices = readContinuityLinkedDevices(params.profileId);
    const settings = readViteSettingsResidue(params.profileId);
    const synthetic: ContinuityM1Snapshot = {
      version: 1,
      format: CONTINUITY_M1_SNAPSHOT_FORMAT,
      createdAtUnixMs: Date.now(),
      publicKeyHex: record.publicKeyHex,
      identityUnlock: {
        encryptedPrivateKey: record.encryptedPrivateKey,
        username: record.username,
      },
      profile: {
        username: settings.displayName || record.username,
      },
      peerTrust,
      privacySettings: settings.privacySettings,
      relayList: settings.relayList,
      uiSettings: settings.uiSettings,
      linkedDevices: linkedDevices.length > 0 ? linkedDevices : undefined,
    };
    return inventorySealedSnapshotFields(presentContinuityM1FieldNames(synthetic));
  };

  const ports: ContinuityPorts = {
    getHonesty: () => inventoryFromLocal().honesty,
    getInventory: () => inventoryFromLocal(),

    exportSealedSnapshot: async (request) => {
      const continuityPassphrase = request.continuityPassphrase?.trim() ?? "";
      if (!continuityPassphrase) {
        const snap = inventoryFromLocal();
        return {
          ok: false,
          honesty: snap.honesty,
          inventory: snap,
          reasonCode: "missing_passphrase",
          error: "Continuity passphrase required for sealed export",
        };
      }

      const record = readIdentity(params.profileId);
      if (!record) {
        const snap = emptyInventory();
        return {
          ok: false,
          honesty: snap.honesty,
          inventory: snap,
          reasonCode: "empty_snapshot",
          error: "No local identity to export (Plane 3 Continuity — unlock first if needed)",
        };
      }

      const devicePassphrase = (request.devicePassphrase?.trim() || continuityPassphrase) as Passphrase;
      let privateKeyHex: PrivateKeyHex;
      try {
        privateKeyHex = await unwrapIdentityPrivateKey({ record, devicePassphrase });
      } catch {
        const snap = inventoryFromLocal();
        return {
          ok: false,
          honesty: snap.honesty,
          inventory: snap,
          reasonCode: "export_failed",
          error: "Could not unwrap identity — check device password / Continuity passphrase",
        };
      }

      try {
        const wrappedForContinuity = await encryptPrivateKeyHex({
          privateKeyHex,
          passphrase: continuityPassphrase as Passphrase,
        });
        const peerTrust = readPeerTrust(record.publicKeyHex);
        const linkedDevices = readContinuityLinkedDevices(params.profileId);
        const settings = readViteSettingsResidue(params.profileId);
        const snapshot: ContinuityM1Snapshot = {
          version: 1,
          format: CONTINUITY_M1_SNAPSHOT_FORMAT,
          createdAtUnixMs: Date.now(),
          publicKeyHex: record.publicKeyHex,
          identityUnlock: {
            encryptedPrivateKey: wrappedForContinuity,
            username: record.username,
          },
          profile: {
            username: settings.displayName || record.username,
          },
          peerTrust,
          privacySettings: settings.privacySettings,
          relayList: settings.relayList,
          uiSettings: settings.uiSettings,
          linkedDevices: linkedDevices.length > 0 ? linkedDevices : undefined,
        };
        const inventory = inventorySealedSnapshotFields(presentContinuityM1FieldNames(snapshot));
        const envelope = await sealContinuityM1Snapshot({
          snapshot,
          continuityPassphrase: continuityPassphrase as Passphrase,
        });
        const serialized = serializeContinuityM1SealedEnvelope(envelope);
        if (downloadOnExport) {
          downloadSealedFile(serialized, record.publicKeyHex);
        }
        return {
          ok: true,
          honesty: inventory.honesty,
          inventory,
          serialized,
        };
      } catch (error) {
        const snap = inventoryFromLocal();
        return {
          ok: false,
          honesty: snap.honesty,
          inventory: snap,
          reasonCode: "export_failed",
          error: error instanceof Error ? error.message : "Continuity export failed",
        };
      }
    },

    importSealedSnapshot: async (raw, request) => {
      const continuityPassphrase = request.continuityPassphrase?.trim() ?? "";
      if (!continuityPassphrase) {
        const snap = inventoryFromLocal();
        return {
          ok: false,
          honesty: snap.honesty,
          inventory: snap,
          reasonCode: "missing_passphrase",
          error: "Continuity passphrase required for sealed import",
        };
      }
      if (!raw.trim()) {
        const snap = inventoryFromLocal();
        return {
          ok: false,
          honesty: snap.honesty,
          inventory: snap,
          reasonCode: "invalid_bundle",
          error: "Sealed Continuity file is empty",
        };
      }

      try {
        const snapshot = await unsealContinuityM1Snapshot({
          envelope: raw,
          continuityPassphrase: continuityPassphrase as Passphrase,
        });
        // identityUnlock already Continuity-passphrase wrapped on export.
        writeIdentity(params.profileId, {
          encryptedPrivateKey: snapshot.identityUnlock.encryptedPrivateKey,
          publicKeyHex: snapshot.publicKeyHex,
          username: snapshot.identityUnlock.username ?? snapshot.profile.username,
        });
        writePeerTrust(snapshot.publicKeyHex, snapshot.peerTrust);
        if (snapshot.linkedDevices) {
          writeContinuityLinkedDevices(params.profileId, snapshot.linkedDevices);
        }
        writeViteSettingsResidue(params.profileId, {
          displayName: snapshot.profile.username ?? "",
          relayList: snapshot.relayList,
          privacySettings: snapshot.privacySettings,
          uiSettings: snapshot.uiSettings,
        });
        const inventory = inventorySealedSnapshotFields(presentContinuityM1FieldNames(snapshot));
        return {
          ok: true,
          honesty: inventory.honesty,
          inventory,
        };
      } catch (error) {
        const snap = inventoryFromLocal();
        return {
          ok: false,
          honesty: snap.honesty,
          inventory: snap,
          reasonCode: "import_failed",
          error: error instanceof Error ? error.message : "Continuity import failed",
        };
      }
    },

    publishSealedSnapshotToHome: async (request) => {
      const session = readHomeSession(params.profileId);
      if (!session) {
        const snap = inventoryFromLocal();
        return {
          ok: false,
          honesty: snap.honesty,
          inventory: snap,
          reasonCode: "home_unavailable",
          error: "Private home session missing — set OBSCUR_PRIVATE_DC_BASE_URL or Continuity home session",
        };
      }
      const exported = await ports.exportSealedSnapshot({
        ...request,
      });
      if (!exported.ok || !exported.serialized) {
        return exported;
      }
      const record = readIdentity(params.profileId);
      const publicKeyHexHint = record?.publicKeyHex?.trim() ?? "";
      if (!publicKeyHexHint) {
        return {
          ...exported,
          ok: false,
          reasonCode: "home_publish_failed",
          error: "Missing publicKeyHex for Continuity home publish",
        };
      }
      try {
        const ack = await putPrivateDcContinuityBackup(
          session,
          {
            publicKeyHexHint,
            sealedEnvelopeJson: exported.serialized,
            clientBackupId: `cb-${Date.now()}`,
          },
          fetchImpl,
        );
        return {
          ...exported,
          ok: true,
          homeBackupId: ack.id,
        };
      } catch (error) {
        return {
          ...exported,
          ok: false,
          reasonCode: "home_publish_failed",
          error: error instanceof Error ? error.message : "Continuity home publish failed",
        };
      }
    },

    restoreSealedSnapshotFromHome: async (request) => {
      const session = readHomeSession(params.profileId);
      if (!session) {
        const snap = inventoryFromLocal();
        return {
          ok: false,
          honesty: snap.honesty,
          inventory: snap,
          reasonCode: "home_unavailable",
          error: "Private home session missing — set OBSCUR_PRIVATE_DC_BASE_URL or Continuity home session",
        };
      }
      const record = readIdentity(params.profileId);
      const publicKeyHexHint = (request.publicKeyHexHint?.trim() || record?.publicKeyHex || "").toLowerCase();
      if (!publicKeyHexHint) {
        const snap = inventoryFromLocal();
        return {
          ok: false,
          honesty: snap.honesty,
          inventory: snap,
          reasonCode: "home_restore_failed",
          error: "publicKeyHexHint required to fetch Continuity backup from home",
        };
      }
      try {
        const backup = await fetchLatestPrivateDcContinuityBackup(
          session,
          { publicKeyHexHint },
          fetchImpl,
        );
        if (!backup) {
          const snap = inventoryFromLocal();
          return {
            ok: false,
            honesty: snap.honesty,
            inventory: snap,
            reasonCode: "home_empty",
            error: "No Continuity backup on private home for this account",
          };
        }
        return ports.importSealedSnapshot(backup.sealedEnvelopeJson, {
          continuityPassphrase: request.continuityPassphrase,
        });
      } catch (error) {
        const snap = inventoryFromLocal();
        return {
          ok: false,
          honesty: snap.honesty,
          inventory: snap,
          reasonCode: "home_restore_failed",
          error: error instanceof Error ? error.message : "Continuity home restore failed",
        };
      }
    },

    createDeviceTransferOffer: async (request) => {
      const exported = await ports.exportSealedSnapshot({
        ...request,
      });
      if (!exported.ok || !exported.serialized) {
        return {
          ...exported,
          reasonCode: exported.reasonCode ?? "transfer_offer_failed",
        };
      }
      try {
        const record = readIdentity(params.profileId);
        const offer = createContinuityM4Offer({
          sealedEnvelopeJson: exported.serialized,
          publicKeyHexHint: record?.publicKeyHex,
        });
        return {
          ...exported,
          ok: true,
          transferOfferJson: serializeContinuityM4Offer(offer),
          transferCode: offer.transferCode,
        };
      } catch (error) {
        return {
          ...exported,
          ok: false,
          reasonCode: "transfer_offer_failed",
          error: error instanceof Error ? error.message : "Continuity M4 offer failed",
        };
      }
    },

    acceptDeviceTransferOffer: async (request) => {
      const verified = verifyContinuityM4Offer({
        offer: request.transferOfferJson,
        transferCode: request.transferCode,
      });
      if (!verified.ok) {
        const snap = inventoryFromLocal();
        return {
          ok: false,
          honesty: snap.honesty,
          inventory: snap,
          reasonCode: verified.reasonCode,
          error: verified.error,
        };
      }
      return ports.importSealedSnapshot(verified.offer.sealedEnvelopeJson, {
        continuityPassphrase: request.continuityPassphrase,
      });
    },

    listLinkedDevices: () => readContinuityLinkedDevices(params.profileId),

    enrollThisDevice: (enrollParams) => enrollContinuityLinkedDevice({
      profileId: params.profileId,
      label: enrollParams?.label,
    }),

    revokeLinkedDevice: (deviceId) => revokeContinuityLinkedDevice({
      profileId: params.profileId,
      deviceId,
    }),

    backfillFromPrivateHome: async (backfillParams) => {
      const session = readHomeSession(params.profileId);
      if (!session) {
        return {
          ok: false,
          reasonCode: "home_unavailable",
          error: "Private home session missing — set private home before M6 backfill",
        };
      }
      return runContinuityM6HomeBackfill({
        profileId: params.profileId,
        session,
        sinceUnixMs: backfillParams?.sinceUnixMs,
        fetchImpl,
      });
    },

    getLastHomeBackfillReport: () => readContinuityM6BackfillReport(params.profileId),

    createPeerHistoryGrant: (request) => {
      try {
        const record = readIdentity(params.profileId);
        const prior = readContinuityM6BackfillReport(params.profileId);
        const opaqueHistoryJson = request.opaqueHistoryJson?.trim()
          || buildOpaquePeerHistoryJson({
            envelopeIds: prior?.envelopeIds,
          });
        const offer = createContinuityPeerHistoryGrantOffer({
          recipientPublicKeyHex: request.recipientPublicKeyHex,
          grantorPublicKeyHexHint: record?.publicKeyHex,
          opaqueHistoryJson,
        });
        recordOutgoingContinuityPeerHistoryGrant(params.profileId, offer);
        return {
          ok: true,
          grant: offer,
          grantOfferJson: serializeContinuityPeerHistoryGrantOffer(offer),
          transferCode: offer.transferCode,
        };
      } catch (error) {
        return {
          ok: false,
          reasonCode: "grant_create_failed",
          error: error instanceof Error ? error.message : "Peer history grant create failed",
        };
      }
    },

    acceptPeerHistoryGrant: (request) => {
      const identity = readIdentity(params.profileId);
      const accepted = acceptContinuityPeerHistoryGrant({
        profileId: params.profileId,
        offer: request.grantOfferJson,
        transferCode: request.transferCode,
        expectedRecipientPublicKeyHex: identity?.publicKeyHex,
      });
      if (!accepted.ok) {
        return accepted;
      }
      return {
        ok: true,
        record: accepted.record,
      };
    },

    listPeerHistoryGrants: () => readContinuityPeerHistoryGrants(params.profileId),
  };

  return ports;
};
