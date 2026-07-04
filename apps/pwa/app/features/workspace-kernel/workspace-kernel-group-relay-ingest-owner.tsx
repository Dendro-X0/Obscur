"use client";

import { useCallback, useState } from "react";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { useIdentity } from "@/app/features/auth/hooks/use-identity";
import { useOptionalProfileRuntime } from "@/app/features/profiles/providers/profile-runtime-provider";
import { getResolvedProfileId } from "@/app/features/profiles/services/profile-runtime-scope";
import { useRelay } from "@/app/features/relays/providers/relay-provider";
import { useGroups } from "@/app/features/groups/providers/group-provider-port";
import { isWorkspaceKernelAuthority } from "./workspace-kernel-policy";
import {
  useWorkspaceKernelJoinedGroupsRelayIngest,
  useWorkspaceKernelJoinedGroupsRelayIngestRefresh,
} from "./use-workspace-kernel-joined-groups-relay-ingest";

/**
 * Background relay ingest for every joined managed workspace — not only the selected sidebar row.
 */
export const WorkspaceKernelGroupRelayIngestOwner = (): null => {
  const { state: identityState } = useIdentity();
  const { relayPool } = useRelay();
  const { createdGroups } = useGroups();
  const optionalProfileRuntime = useOptionalProfileRuntime();
  const profileId = optionalProfileRuntime?.profileId ?? getResolvedProfileId();
  const [metadataCacheEpoch, setMetadataCacheEpoch] = useState(0);
  const onRefresh = useCallback((): void => {
    setMetadataCacheEpoch((value) => value + 1);
  }, []);
  useWorkspaceKernelJoinedGroupsRelayIngestRefresh(onRefresh);

  useWorkspaceKernelJoinedGroupsRelayIngest({
    pool: relayPool,
    myPublicKeyHex: (identityState.publicKeyHex || null) as PublicKeyHex | null,
    myPrivateKeyHex: identityState.privateKeyHex || null,
    profileId,
    displayGroups: createdGroups,
    metadataCacheEpoch,
    enabled: isWorkspaceKernelAuthority(),
  });

  return null;
};
