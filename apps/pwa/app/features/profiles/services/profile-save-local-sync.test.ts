import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/features/auth/utils/get-stored-identity", () => ({
  getStoredIdentity: vi.fn(async () => ({
    record: {
      publicKeyHex: "87cb2c20012587cb2c20012587cb2c20012587cb2c20012587cb2c20012587cb2c20",
      username: "OldName",
      encryptedPrivateKey: "cipher",
    },
  })),
}));

vi.mock("@/app/features/auth/utils/save-stored-identity", () => ({
  saveStoredIdentity: vi.fn(async () => undefined),
}));

vi.mock("@/app/features/account-sync/services/encrypted-account-backup-service", () => ({
  encryptedAccountBackupService: {
    publishEncryptedAccountBackup: vi.fn(async () => ({
      publishResult: { status: "ok" },
      envelope: null,
      backupPayload: {},
      signedEvent: null,
    })),
  },
}));

vi.mock("@/app/shared/log-app-event", () => ({
  logAppEvent: vi.fn(),
}));

import { saveStoredIdentity } from "@/app/features/auth/utils/save-stored-identity";
import { encryptedAccountBackupService } from "@/app/features/account-sync/services/encrypted-account-backup-service";
import {
  syncIdentityUsernameFromProfileSave,
  syncLocalAccountSnapshotAfterProfileSave,
} from "./profile-save-local-sync";

const PK = "87cb2c20012587cb2c20012587cb2c20012587cb2c20012587cb2c20012587cb2c20" as never;
const PRIV = "1111111111111111111111111111111111111111111111111111111111111111" as never;

describe("profile-save-local-sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates identity username when profile display name changes", async () => {
    await syncIdentityUsernameFromProfileSave({
      publicKeyHex: PK,
      username: "Demouser",
    });

    expect(saveStoredIdentity).toHaveBeenCalledWith({
      record: expect.objectContaining({
        publicKeyHex: PK,
        username: "Demouser",
      }),
    });
  });

  it("refreshes encrypted backup snapshot after local profile save", async () => {
    const result = await syncLocalAccountSnapshotAfterProfileSave({
      publicKeyHex: PK,
      privateKeyHex: PRIV,
      username: "Demouser",
      relayPool: {} as never,
      enabledRelayUrls: ["wss://relay.example"],
    });

    expect(result.identitySynced).toBe(true);
    expect(result.backupRefreshed).toBe(true);
    expect(encryptedAccountBackupService.publishEncryptedAccountBackup).toHaveBeenCalledWith({
      publicKeyHex: PK,
      privateKeyHex: PRIV,
      pool: {},
      scopedRelayUrls: ["wss://relay.example"],
    });
  });
});
