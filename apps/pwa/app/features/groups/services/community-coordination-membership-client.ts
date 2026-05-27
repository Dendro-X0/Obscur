import type { MembershipDeltaAction } from "@dweb/coordination-contracts";
import { signMembershipDelta } from "@dweb/coordination-contracts";
import type { PrivateKeyHex } from "@dweb/crypto/private-key-hex";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import { mapCoordinationDeltaToSemanticCommunityEvent } from "@dweb/transport-coordination";
import type { SemanticCommunityMemberEvent } from "@dweb/transport-contracts";
import { cryptoService, NATIVE_KEY_SENTINEL } from "../../crypto/crypto-service";
import { NativeCryptoService } from "../../crypto/native-crypto-service";
import { hasNativeRuntime } from "../../runtime/runtime-capabilities";
import {
  CoordinationFetchError,
  fetchCoordinationWithTimeout,
} from "./community-coordination-fetch";
import { getCoordinationBaseUrl } from "./community-membership-sync-mode";

export type CoordinationMembershipDeltaRecord = Readonly<{
  deltaId: string;
  communityId: string;
  seq: number;
  action: MembershipDeltaAction;
  subjectPubkey: string;
  actorPubkey: string;
  createdAtUnixMs: number;
  signature: string;
}>;

export type CoordinationMembershipHead = Readonly<{
  communityId: string;
  seq: number;
  headHash: string;
  updatedAtUnixMs: number;
}>;

const encodeCommunityPath = (communityId: string): string => (
  encodeURIComponent(communityId.trim())
);

const parseApiData = <T>(payload: unknown): T | null => {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const record = payload as Record<string, unknown>;
  if (record.ok !== true || !record.data || typeof record.data !== "object") {
    return null;
  }
  return record.data as T;
};

/** Desktop stores identity keys in native keychain; JS signing must resolve the sentinel first. */
export const resolveActorPrivateKeyForMembershipDeltaSigning = async (
  actorPrivateKeyHex: PrivateKeyHex,
): Promise<PrivateKeyHex> => {
  if (actorPrivateKeyHex !== NATIVE_KEY_SENTINEL) {
    return actorPrivateKeyHex;
  }
  if (!hasNativeRuntime() || !(cryptoService instanceof NativeCryptoService)) {
    throw new Error("native_signing_unavailable");
  }
  return cryptoService.resolveIdentityPrivateKeyForSigning(actorPrivateKeyHex);
};

export const fetchCoordinationMembershipHead = async (
  communityId: string,
): Promise<CoordinationMembershipHead | null> => {
  const baseUrl = getCoordinationBaseUrl();
  if (!baseUrl) {
    return null;
  }
  const response = await fetchCoordinationWithTimeout(
    `${baseUrl}/communities/${encodeCommunityPath(communityId)}/membership/head`,
    { method: "GET" },
  );
  if (!response.ok) {
    return null;
  }
  const json: unknown = await response.json();
  const data = parseApiData<CoordinationMembershipHead>(json);
  return data ?? null;
};

export type CoordinationMembershipDeltasFetchResult = Readonly<{
  ok: true;
  deltas: ReadonlyArray<CoordinationMembershipDeltaRecord>;
}> | Readonly<{
  ok: false;
  status: number | null;
  error: string;
}>;

export const fetchCoordinationMembershipDeltasSince = async (
  communityId: string,
  sinceSeq: number,
): Promise<CoordinationMembershipDeltasFetchResult> => {
  const baseUrl = getCoordinationBaseUrl();
  if (!baseUrl) {
    return { ok: false, status: null, error: "coordination_not_configured" };
  }
  const safeSince = Number.isFinite(sinceSeq) && sinceSeq >= 0 ? Math.floor(sinceSeq) : 0;
  try {
    const response = await fetchCoordinationWithTimeout(
      `${baseUrl}/communities/${encodeCommunityPath(communityId)}/membership/deltas?since=${safeSince}`,
      { method: "GET" },
    );
    if (!response.ok) {
      return { ok: false, status: response.status, error: `http_${response.status}` };
    }
    const json: unknown = await response.json();
    const data = parseApiData<{ deltas: ReadonlyArray<CoordinationMembershipDeltaRecord> }>(json);
    return { ok: true, deltas: data?.deltas ?? [] };
  } catch (error) {
    return {
      ok: false,
      status: null,
      error: error instanceof Error ? error.message : "fetch_failed",
    };
  }
};

export const publishCoordinationMembershipDelta = async (params: Readonly<{
  communityId: string;
  action: MembershipDeltaAction;
  subjectPubkey: PublicKeyHex;
  actorPubkey: PublicKeyHex;
  actorPrivateKeyHex: PrivateKeyHex;
  createdAtUnixMs?: number;
}>): Promise<Readonly<{ success: boolean; seq?: number; errorMessage?: string }>> => {
  const baseUrl = getCoordinationBaseUrl();
  if (!baseUrl) {
    return { success: false, errorMessage: "coordination_not_configured" };
  }
  const createdAtUnixMs = params.createdAtUnixMs ?? Date.now();
  let signature: string;
  try {
    const actorPrivateKeyHex = await resolveActorPrivateKeyForMembershipDeltaSigning(
      params.actorPrivateKeyHex,
    );
    signature = await signMembershipDelta({
      communityId: params.communityId,
      action: params.action,
      subjectPubkey: params.subjectPubkey,
      actorPubkey: params.actorPubkey,
      createdAtUnixMs,
      actorPrivateKeyHex,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "sign_failed";
    return {
      success: false,
      errorMessage: message === "native_signing_unavailable" ? message : "sign_failed",
    };
  }
  let response: Response;
  try {
    response = await fetchCoordinationWithTimeout(
      `${baseUrl}/communities/${encodeCommunityPath(params.communityId)}/membership/delta`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: params.action,
          subjectPubkey: params.subjectPubkey,
          actorPubkey: params.actorPubkey,
          createdAtUnixMs,
          signature,
        }),
      },
    );
  } catch (error) {
    if (error instanceof CoordinationFetchError) {
      return { success: false, errorMessage: error.message };
    }
    return { success: false, errorMessage: "coordination_unreachable" };
  }
  if (!response.ok) {
    let errorMessage = `http_${response.status}`;
    try {
      const errorJson: unknown = await response.json();
      if (errorJson && typeof errorJson === "object") {
        const record = errorJson as Record<string, unknown>;
        if (typeof record.error === "string" && record.error.trim().length > 0) {
          errorMessage = `http_${response.status}:${record.error.trim()}`;
        }
      }
    } catch {
      // keep status-only code
    }
    return { success: false, errorMessage };
  }
  const json: unknown = await response.json();
  const data = parseApiData<{ seq: number }>(json);
  return { success: true, seq: data?.seq };
};

export const mapCoordinationRecordToSemantic = (
  record: CoordinationMembershipDeltaRecord,
): SemanticCommunityMemberEvent | null => (
  mapCoordinationDeltaToSemanticCommunityEvent({
    communityId: record.communityId,
    seq: record.seq,
    action: record.action,
    subjectPubkey: record.subjectPubkey,
    actorPubkey: record.actorPubkey,
    createdAtUnixMs: record.createdAtUnixMs,
  })
);
