"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { CommunityMode } from "../types";
import type { CoordinationMembershipMaterialization } from "../services/community-coordination-membership-materializer";
import { resolveRoomKeyHexForMembershipHealthPanel } from "../services/community-coordination-room-key-owner";
import { COORDINATION_MEMBERSHIP_DIRECTORY_CHANGED_EVENT } from "../services/community-coordination-membership-directory-store";
import { COMMUNITY_MEMBERSHIP_LEDGER_UPDATED_EVENT } from "../services/community-membership-ledger";
import { hasWritableCommunityRelayTransport } from "../services/community-relay-transport";
import { isCoordinationOnlyWorkspaceDevMode } from "../services/community-dev-flags";
import {
  resolveCommunityMembershipHealth,
  type CommunityMembershipHealth,
} from "../services/community-membership-health";
import { logMembershipHealthSnapshot } from "../services/community-membership-health-telemetry";

export type UseCommunityMembershipHealthParams = Readonly<{
  communityId?: string;
  communityMode?: CommunityMode | null;
  relayUrl?: string | null;
  localMemberPubkey?: PublicKeyHex | null;
  localPrivateKeyHex?: PrivateKeyHex | null;
  coordinationDirectory: CoordinationMembershipMaterialization | null;
  relayActivationSynced: boolean;
  activationPending?: boolean;
  groupIdCandidates: ReadonlyArray<string>;
  accountPublicKeyHex?: PublicKeyHex | null;
  enabled?: boolean;
}>;

export const useCommunityMembershipHealth = (
  params: UseCommunityMembershipHealthParams,
): Readonly<{
  health: CommunityMembershipHealth;
  roomKeyHex: string | undefined;
}> => {
  const enabled = params.enabled ?? true;
  const [roomKeyHex, setRoomKeyHex] = useState<string | undefined>();
  const [revision, setRevision] = useState(0);

  const groupIdCandidates = useMemo(() => (
    Array.from(new Set(
      params.groupIdCandidates
        .map((value) => value.trim())
        .filter((value) => value.length > 0),
    ))
  ), [params.groupIdCandidates]);

  const coordinationHeadSeq = params.coordinationDirectory?.headSeq ?? null;

  useEffect(() => {
    if (!enabled || groupIdCandidates.length === 0) {
      setRoomKeyHex(undefined);
      return;
    }
    let cancelled = false;
    void (async () => {
      const resolved = await resolveRoomKeyHexForMembershipHealthPanel({
        groupIdCandidates,
        communityId: params.communityId,
        localPubkey: params.localMemberPubkey,
        localPrivateKeyHex: params.localPrivateKeyHex,
        activeMemberPubkeys: params.coordinationDirectory?.activeMemberPubkeys,
      });
      if (cancelled) {
        return;
      }
      setRoomKeyHex(resolved ?? undefined);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    enabled,
    groupIdCandidates,
    params.communityId,
    params.coordinationDirectory?.activeMemberPubkeys,
    params.localMemberPubkey,
    params.localPrivateKeyHex,
    coordinationHeadSeq,
    revision,
  ]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") {
      return;
    }
    const bump = (): void => setRevision((value) => value + 1);
    window.addEventListener(COORDINATION_MEMBERSHIP_DIRECTORY_CHANGED_EVENT, bump);
    window.addEventListener(COMMUNITY_MEMBERSHIP_LEDGER_UPDATED_EVENT, bump);
    return () => {
      window.removeEventListener(COORDINATION_MEMBERSHIP_DIRECTORY_CHANGED_EVENT, bump);
      window.removeEventListener(COMMUNITY_MEMBERSHIP_LEDGER_UPDATED_EVENT, bump);
    };
  }, [enabled, params.communityId]);

  const relayUrl = params.relayUrl?.trim() ?? "";
  const health = useMemo(() => resolveCommunityMembershipHealth({
    communityId: params.communityId,
    localMemberPubkey: params.localMemberPubkey,
    coordinationDirectory: params.coordinationDirectory,
    roomKeyPresent: Boolean(roomKeyHex?.trim()),
    relayTransportReady: hasWritableCommunityRelayTransport(relayUrl),
    relayActivationSynced: params.relayActivationSynced,
    activationPending: params.activationPending ?? false,
    devCoordinationOnly: isCoordinationOnlyWorkspaceDevMode(),
  }), [
    params.activationPending,
    params.communityId,
    params.coordinationDirectory,
    params.localMemberPubkey,
    params.relayActivationSynced,
    relayUrl,
    roomKeyHex,
  ]);

  const lastSnapshotRef = useRef<string | null>(null);
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const snapshot = [
      health.ready ? "1" : "0",
      health.chatEnabled ? "1" : "0",
      health.blockers.join(","),
      params.communityId ?? "",
      roomKeyHex ?? "",
    ].join("|");
    if (lastSnapshotRef.current === snapshot) {
      return;
    }
    lastSnapshotRef.current = snapshot;
    logMembershipHealthSnapshot({
      health,
      communityId: params.communityId,
      groupId: groupIdCandidates[0],
      relayUrl,
    });
  }, [
    enabled,
    groupIdCandidates,
    health,
    params.communityId,
    relayUrl,
    roomKeyHex,
  ]);

  return {
    health,
    roomKeyHex,
  };
};
