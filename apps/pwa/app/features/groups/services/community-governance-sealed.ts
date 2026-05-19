import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type {
  CommunityGovernanceActionType,
  CommunityGovernanceResolution,
  CommunityGovernanceVote,
} from "@dweb/core/community-control-event-contracts";
import type { GovernanceProposalPayload, GovernanceReducerEvent } from "./community-governance-reducer";

const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === "object" && value !== null && !Array.isArray(value)
);

const readString = (record: Record<string, unknown>, key: string): string | undefined => {
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : undefined;
};

const readNumber = (record: Record<string, unknown>, key: string): number | undefined => {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
};

const parseActionType = (value: string | undefined): CommunityGovernanceActionType | null => {
  if (
    value === "expel_member"
    || value === "restore_member"
    || value === "update_descriptor"
    || value === "rotate_room_key"
    || value === "policy_change"
  ) {
    return value;
  }
  return null;
};

const parseVote = (value: string | undefined): CommunityGovernanceVote | null => {
  if (value === "approve" || value === "reject" || value === "abstain") {
    return value;
  }
  return null;
};

const parseResolution = (value: string | undefined): CommunityGovernanceResolution | null => {
  if (value === "accepted" || value === "rejected" || value === "expired") {
    return value;
  }
  return null;
};

const parsePayload = (
  actionType: CommunityGovernanceActionType,
  raw: unknown,
): GovernanceProposalPayload | null => {
  if (!isRecord(raw)) {
    return null;
  }
  if (actionType === "update_descriptor") {
    const access = readString(raw, "access");
    return {
      ...(readString(raw, "name") ? { name: readString(raw, "name") } : {}),
      ...(readString(raw, "about") ? { about: readString(raw, "about") } : {}),
      ...(readString(raw, "picture") ? { picture: readString(raw, "picture") } : {}),
      ...(access === "open" || access === "invite-only" || access === "discoverable"
        ? { access }
        : {}),
    };
  }
  if (actionType === "expel_member") {
    const targetPublicKeyHex = readString(raw, "targetPublicKeyHex") ?? readString(raw, "target");
    if (!targetPublicKeyHex) {
      return null;
    }
    return {
      targetPublicKeyHex: targetPublicKeyHex as PublicKeyHex,
      ...(readString(raw, "reason") ? { reason: readString(raw, "reason") } : {}),
    };
  }
  return {};
};

export const toGovernanceReducerEventFromSealed = (
  innerPayload: Record<string, unknown>,
  logicalEventId: string,
  fallbackActor: PublicKeyHex,
): GovernanceReducerEvent | null => {
  const type = readString(innerPayload, "type");
  const createdAtUnixMs = (readNumber(innerPayload, "created_at") ?? 0) * 1000;
  const actor = (readString(innerPayload, "pubkey") ?? fallbackActor) as PublicKeyHex;

  if (type === "governance.proposed") {
    const proposalId = readString(innerPayload, "proposalId");
    const actionType = parseActionType(readString(innerPayload, "actionType"));
    const quorumThreshold = readNumber(innerPayload, "quorumThreshold");
    if (!proposalId || !actionType || !quorumThreshold || quorumThreshold < 1) {
      return null;
    }
    const payload = parsePayload(actionType, innerPayload.payload);
    if (!payload) {
      return null;
    }
    return {
      type: "PROPOSED",
      proposalId,
      actionType,
      proposerPublicKeyHex: actor,
      createdAtUnixMs: createdAtUnixMs || Date.now(),
      quorumThreshold,
      ...(readNumber(innerPayload, "proposalExpiresAtUnixMs")
        ? { proposalExpiresAtUnixMs: readNumber(innerPayload, "proposalExpiresAtUnixMs") }
        : {}),
      payload,
      logicalEventId,
    };
  }

  if (type === "governance.vote") {
    const proposalId = readString(innerPayload, "proposalId");
    const vote = parseVote(readString(innerPayload, "vote"));
    if (!proposalId || !vote) {
      return null;
    }
    return {
      type: "VOTE_CAST",
      proposalId,
      voterPublicKeyHex: actor,
      vote,
      createdAtUnixMs: createdAtUnixMs || Date.now(),
      logicalEventId,
    };
  }

  if (type === "governance.resolved") {
    const proposalId = readString(innerPayload, "proposalId");
    const resolution = parseResolution(readString(innerPayload, "resolution"));
    if (!proposalId || !resolution) {
      return null;
    }
    return {
      type: "RESOLVED",
      proposalId,
      resolution,
      resolverPublicKeyHex: actor,
      createdAtUnixMs: createdAtUnixMs || Date.now(),
      logicalEventId,
    };
  }

  return null;
};
