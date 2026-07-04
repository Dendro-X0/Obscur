import { invoke } from "@tauri-apps/api/core";
import type { AuthBootSnapshot } from "@dweb/auth";

type AuthBootSnapshotWire = Readonly<{
  profileId: string;
  phase: string;
  storedPublicKeyHex?: string | null;
  sessionPublicKeyHex?: string | null;
  keychainPresent: boolean;
  restoreEligible: boolean;
  atUnixMs: number;
}>;

const normalizeBootSnapshot = (wire: AuthBootSnapshotWire): AuthBootSnapshot => ({
  profileId: wire.profileId,
  phase: wire.phase as AuthBootSnapshot["phase"],
  storedPublicKeyHex: wire.storedPublicKeyHex ?? null,
  sessionPublicKeyHex: wire.sessionPublicKeyHex ?? null,
  keychainPresent: wire.keychainPresent,
  restoreEligible: wire.restoreEligible,
  atUnixMs: wire.atUnixMs,
});

export const createTauriAuthBootHost = (): Readonly<{
  fetchBootSnapshot: (params: Readonly<{
    expectedPubkeyHex?: string;
    restoreEligible: boolean;
  }>) => Promise<AuthBootSnapshot>;
}> => ({
  fetchBootSnapshot: async (params) => {
    const wire = await invoke<AuthBootSnapshotWire>("auth_boot_snapshot", {
      expectedPubkeyHex: params.expectedPubkeyHex ?? null,
      restoreEligible: params.restoreEligible,
    });
    return normalizeBootSnapshot(wire);
  },
});
