/**
 * R-RELAY-RUST-4a — profile-scoped gate: Rust mesh owns failover.
 * Set from configureMeshConduits / applyRustMeshConfigureFromPreset.
 */

const ownershipByProfile = new Map<string, boolean>();

export const setMeshSchedulerOwnsFailover = (
  profileId: string,
  owns: boolean,
): void => {
  const id = profileId.trim();
  if (!id) {
    return;
  }
  if (owns) {
    ownershipByProfile.set(id, true);
  } else {
    ownershipByProfile.delete(id);
  }
};

export const meshSchedulerOwnsFailover = (profileId: string): boolean => {
  const id = profileId.trim();
  if (!id) {
    return false;
  }
  return ownershipByProfile.get(id) === true;
};

export const clearMeshSchedulerOwnsFailover = (profileId?: string): void => {
  if (!profileId?.trim()) {
    ownershipByProfile.clear();
    return;
  }
  ownershipByProfile.delete(profileId.trim());
};

/** Parse configureMeshConduits / MeshConfigureOutcome payload. */
export const extractMeshSchedulerOwnsFailover = (data: unknown): boolean | undefined => {
  if (!data || typeof data !== "object") {
    return undefined;
  }
  const record = data as Record<string, unknown>;
  if (typeof record.meshSchedulerOwnsFailover === "boolean") {
    return record.meshSchedulerOwnsFailover;
  }
  const snapshot = record.snapshot;
  if (snapshot && typeof snapshot === "object") {
    const snap = snapshot as Record<string, unknown>;
    if (typeof snap.meshSchedulerOwnsFailover === "boolean") {
      return snap.meshSchedulerOwnsFailover;
    }
  }
  return undefined;
};
