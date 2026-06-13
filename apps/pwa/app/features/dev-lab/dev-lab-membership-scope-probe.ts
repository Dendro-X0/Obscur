import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { readCommunityLeaveOutbox } from "@/app/features/groups/services/community-leave-outbox";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { loadWorkspaceGroupMetadataRecords } from "@/app/features/workspace-kernel/workspace-kernel-group-metadata-store";
import { resolveManagedWorkspaceGroupList } from "@/app/features/workspace-kernel/workspace-kernel-list-port";
import { isWorkspaceKernelAuthority } from "@/app/features/workspace-kernel/workspace-kernel-policy";
import { runJoinerMembershipRepairProbe } from "./dev-lab-joiner-membership-probe";
import { isDevLabEnabled } from "./dev-lab-policy";

export type DevLabMembershipScopeSnapshot = Readonly<{
  profileId: string;
  publicKeyHex: PublicKeyHex | "";
  kernelAuthority: boolean;
  managedGroupScopes: ReadonlyArray<Readonly<{ groupId: string; relayUrl: string; displayName: string }>>;
  leaveOutboxCount: number;
  joinerProbe: ReturnType<typeof runJoinerMembershipRepairProbe>;
  capturedAtUnixMs: number;
}>;

const normalizeScopeKey = (groupId: string, relayUrl: string): string => (
  `${groupId.trim()}::${(relayUrl ?? "").trim()}`
);

/** COM / E-REL scope fingerprint for dual-browser stability probes. */
export const probeDevLabMembershipScope = (params: Readonly<{
  publicKeyHex: PublicKeyHex | string;
  profileId?: string;
}>): DevLabMembershipScopeSnapshot => {
  if (!isDevLabEnabled()) {
    return {
      profileId: "",
      publicKeyHex: "",
      kernelAuthority: false,
      managedGroupScopes: [],
      leaveOutboxCount: 0,
      joinerProbe: {
        ok: true,
        skipped: true,
        reason: "dev_lab_disabled",
        kernelAuthority: false,
        synthetic: false,
        groupsChecked: 0,
        groups: [],
      },
      capturedAtUnixMs: Date.now(),
    };
  }

  const profileId = params.profileId ?? getResolvedProfileId();
  const publicKeyHex = params.publicKeyHex.trim() as PublicKeyHex;
  const kernelAuthority = isWorkspaceKernelAuthority();
  let managedGroupScopes: DevLabMembershipScopeSnapshot["managedGroupScopes"] = [];

  if (kernelAuthority && publicKeyHex) {
    const persisted = loadWorkspaceGroupMetadataRecords(publicKeyHex, profileId);
    managedGroupScopes = resolveManagedWorkspaceGroupList({
      publicKeyHex,
      profileId,
      persistedGroups: persisted,
    }).map((group) => ({
      groupId: group.groupId,
      relayUrl: group.relayUrl ?? "",
      displayName: group.displayName ?? group.groupId,
    }));
  }

  const leaveOutboxCount = publicKeyHex
    ? readCommunityLeaveOutbox(publicKeyHex, profileId).length
    : 0;

  const joinerProbe = publicKeyHex
    ? runJoinerMembershipRepairProbe({ publicKeyHex, profileId })
    : {
      ok: false,
      skipped: true,
      reason: "missing_public_key",
      kernelAuthority,
      synthetic: false,
      groupsChecked: 0,
      groups: [],
    };

  return {
    profileId,
    publicKeyHex,
    kernelAuthority,
    managedGroupScopes,
    leaveOutboxCount,
    joinerProbe,
    capturedAtUnixMs: Date.now(),
  };
};

export const compareDevLabMembershipScopeSnapshots = (
  before: DevLabMembershipScopeSnapshot,
  after: DevLabMembershipScopeSnapshot,
): Readonly<{ stable: boolean; issues: ReadonlyArray<string> }> => {
  const issues: string[] = [];

  if (before.profileId !== after.profileId) {
    issues.push("profile_id_changed");
  }
  if (before.publicKeyHex !== after.publicKeyHex) {
    issues.push("public_key_changed");
  }
  if (before.leaveOutboxCount !== after.leaveOutboxCount) {
    issues.push(`leave_outbox_count_${before.leaveOutboxCount}_to_${after.leaveOutboxCount}`);
  }

  const beforeKeys = new Set(before.managedGroupScopes.map((entry) => normalizeScopeKey(entry.groupId, entry.relayUrl)));
  const afterKeys = new Set(after.managedGroupScopes.map((entry) => normalizeScopeKey(entry.groupId, entry.relayUrl)));

  for (const key of beforeKeys) {
    if (!afterKeys.has(key)) {
      issues.push(`group_scope_lost_${key}`);
    }
  }

  if (after.joinerProbe.ok === false && after.joinerProbe.skipped !== true) {
    issues.push(`joiner_probe_failed_${after.joinerProbe.reason}`);
  }

  return { stable: issues.length === 0, issues };
};

export const buildDevLabAuthScopeFingerprint = (snapshot: DevLabMembershipScopeSnapshot): string => (
  [
    snapshot.profileId,
    snapshot.publicKeyHex,
    snapshot.managedGroupScopes.map((entry) => normalizeScopeKey(entry.groupId, entry.relayUrl)).sort().join("|"),
    String(snapshot.leaveOutboxCount),
  ].join("::")
);
