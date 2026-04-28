/**
 * Voice Call State CRDT
 * 
 * This module provides a CRDT-based state container for voice calls
 * that prevents "ghost calls" - historical call records that appear
 * as active calls after sync.
 * 
 * The solution uses LWW-Registers (Last-Write-Wins) with staleness checks:
 * - Call state is a derived value, not a replay of events
 * - Old calls are automatically marked as "ended" based on time
 * - No ambiguity between historical and active calls
 */

import type { LWWRegister } from "@/app/shared/crdt";
import {
  createLWWRegister,
  setLWWRegister,
  mergeLWWRegisters,
  getLWWValue,
  formatLWWAge,
} from "@/app/shared/crdt/lww-register";

export type CallStatus = "inviting" | "ringing" | "connected" | "ended" | "missed" | "rejected";

export type CallType = "audio" | "video";

/**
 * Call state as a CRDT
 * Each field is an LWW-Register - concurrent writes resolve to the latest
 */
export interface VoiceCallCRDTState {
  // Unique call identifier (room ID)
  callId: string;
  
  // Who initiated the call
  initiator: LWWRegister<string>; // pubkey
  
  // Current status of the call
  status: LWWRegister<CallStatus>;
  
  // When the call was invited/started
  invitedAt: LWWRegister<number>; // Unix timestamp ms
  
  // When the call actually connected (participants joined)
  connectedAt: LWWRegister<number | null>;
  
  // When the call ended
  endedAt: LWWRegister<number | null>;
  
  // Call participants (those who actually joined)
  participants: LWWRegister<string[]>; // pubkeys
  
  // Call type (audio/video)
  callType: LWWRegister<CallType>;
  
  // Metadata
  version: number;
}

/**
 * Configuration for staleness detection
 */
export interface StalenessConfig {
  // Max time from invite to connect (auto-end if not connected)
  maxInviteTimeoutMs: number;
  // Max duration of a connected call (auto-end if still "connected")
  maxCallDurationMs: number;
  // Max time to show "ringing" before marking as missed
  maxRingingDurationMs: number;
}

const DEFAULT_STALENESS_CONFIG: StalenessConfig = {
  maxInviteTimeoutMs: 5 * 60 * 1000,      // 5 minutes
  maxCallDurationMs: 2 * 60 * 60 * 1000, // 2 hours
  maxRingingDurationMs: 60 * 1000,         // 1 minute
};

/**
 * Create a new voice call CRDT state
 */
export const createVoiceCallCRDT = (
  callId: string,
  initiatorPubkey: string,
  callType: CallType = "audio",
  actor?: string
): VoiceCallCRDTState => {
  const now = Date.now();
  
  return {
    callId,
    initiator: createLWWRegister(initiatorPubkey, actor ?? initiatorPubkey, now),
    status: createLWWRegister("inviting", actor ?? initiatorPubkey, now),
    invitedAt: createLWWRegister(now, actor ?? initiatorPubkey, now),
    connectedAt: createLWWRegister(null, actor ?? initiatorPubkey, now),
    endedAt: createLWWRegister(null, actor ?? initiatorPubkey, now),
    participants: createLWWRegister([initiatorPubkey], actor ?? initiatorPubkey, now),
    callType: createLWWRegister(callType, actor ?? initiatorPubkey, now),
    version: 1,
  };
};

/**
 * Check if a call is stale and should be auto-ended
 * This is the key function that prevents ghost calls!
 */
export const isCallStale = (
  call: VoiceCallCRDTState,
  currentTime: number,
  config: StalenessConfig = DEFAULT_STALENESS_CONFIG
): { isStale: boolean; reason?: string; effectiveEndedAt?: number } => {
  const status = getLWWValue(call.status);
  const invitedAt = getLWWValue(call.invitedAt);
  const connectedAt = getLWWValue(call.connectedAt);
  const endedAt = getLWWValue(call.endedAt);
  
  // Already ended - not stale
  if (status === "ended" || status === "missed" || status === "rejected") {
    return { isStale: false };
  }
  
  // Has explicit end time - not stale
  if (endedAt !== null && currentTime > endedAt) {
    return { isStale: false, effectiveEndedAt: endedAt };
  }
  
  // Check invite timeout (invited but never connected)
  if (status === "inviting" || status === "ringing") {
    const inviteAge = currentTime - invitedAt;
    if (inviteAge > config.maxRingingDurationMs && status === "ringing") {
      return {
        isStale: true,
        reason: `Ringing for ${Math.floor(inviteAge / 1000)}s, max ${config.maxRingingDurationMs / 1000}s`,
        effectiveEndedAt: invitedAt + config.maxRingingDurationMs,
      };
    }
    if (inviteAge > config.maxInviteTimeoutMs) {
      return {
        isStale: true,
        reason: `Invite ${Math.floor(inviteAge / 60000)}m old, max ${config.maxInviteTimeoutMs / 60000}m`,
        effectiveEndedAt: invitedAt + config.maxInviteTimeoutMs,
      };
    }
  }
  
  // Check connected call duration
  if (status === "connected" && connectedAt !== null) {
    const duration = currentTime - connectedAt;
    if (duration > config.maxCallDurationMs) {
      return {
        isStale: true,
        reason: `Call ${Math.floor(duration / 60000)}m long, max ${config.maxCallDurationMs / 60000}m`,
        effectiveEndedAt: connectedAt + config.maxCallDurationMs,
      };
    }
  }
  
  return { isStale: false };
};

/**
 * Get the effective status of a call
 * Returns "ended" for stale calls even if status register says "connected"
 */
export const getEffectiveCallStatus = (
  call: VoiceCallCRDTState,
  currentTime: number,
  config?: StalenessConfig
): { status: CallStatus; isStale: boolean; endedAt?: number } => {
  const rawStatus = getLWWValue(call.status);
  const staleness = isCallStale(call, currentTime, config);
  
  if (staleness.isStale) {
    return {
      status: "ended",
      isStale: true,
      endedAt: staleness.effectiveEndedAt,
    };
  }
  
  return {
    status: rawStatus,
    isStale: false,
  };
};

/**
 * Check if a call is currently active (non-stale and not ended)
 */
export const isCallActive = (
  call: VoiceCallCRDTState,
  currentTime: number,
  config?: StalenessConfig
): boolean => {
  const { status, isStale } = getEffectiveCallStatus(call, currentTime, config);
  return !isStale && status !== "ended" && status !== "missed" && status !== "rejected";
};

/**
 * Transition a call to a new status
 * Returns new call state with updated registers
 */
export const transitionCallStatus = (
  call: VoiceCallCRDTState,
  newStatus: CallStatus,
  actor: string,
  currentTime: number
): VoiceCallCRDTState => {
  const newStatusReg = setLWWRegister(call.status, newStatus, actor, currentTime);
  
  // Update connectedAt if transitioning to connected
  let newConnectedAt = call.connectedAt;
  if (newStatus === "connected" && getLWWValue(call.connectedAt) === null) {
    newConnectedAt = setLWWRegister(call.connectedAt, currentTime, actor, currentTime);
  }
  
  // Update endedAt if transitioning to ended/missed/rejected
  let newEndedAt = call.endedAt;
  if (["ended", "missed", "rejected"].includes(newStatus) && getLWWValue(call.endedAt) === null) {
    newEndedAt = setLWWRegister(call.endedAt, currentTime, actor, currentTime);
  }
  
  return {
    ...call,
    status: newStatusReg,
    connectedAt: newConnectedAt,
    endedAt: newEndedAt,
    version: call.version + 1,
  };
};

/**
 * Add a participant to the call
 */
export const addParticipant = (
  call: VoiceCallCRDTState,
  pubkey: string,
  actor: string,
  currentTime: number
): VoiceCallCRDTState => {
  const currentParticipants = getLWWValue(call.participants);
  if (currentParticipants.includes(pubkey)) {
    return call;
  }
  
  const newParticipants = [...currentParticipants, pubkey];
  
  return {
    ...call,
    participants: setLWWRegister(call.participants, newParticipants, actor, currentTime),
    version: call.version + 1,
  };
};

/**
 * Remove a participant from the call
 */
export const removeParticipant = (
  call: VoiceCallCRDTState,
  pubkey: string,
  actor: string,
  currentTime: number
): VoiceCallCRDTState => {
  const currentParticipants = getLWWValue(call.participants);
  const newParticipants = currentParticipants.filter((p) => p !== pubkey);
  
  // If all participants left, auto-end the call
  let newStatus = call.status;
  let newEndedAt = call.endedAt;
  if (newParticipants.length === 0) {
    newStatus = setLWWRegister(call.status, "ended", actor, currentTime);
    if (getLWWValue(call.endedAt) === null) {
      newEndedAt = setLWWRegister(call.endedAt, currentTime, actor, currentTime);
    }
  }
  
  return {
    ...call,
    participants: setLWWRegister(call.participants, newParticipants, actor, currentTime),
    status: newStatus,
    endedAt: newEndedAt,
    version: call.version + 1,
  };
};

/**
 * Merge two call states (used during sync)
 * LWW semantics: latest timestamp wins for each field
 */
export const mergeCallStates = (
  local: VoiceCallCRDTState,
  remote: VoiceCallCRDTState
): VoiceCallCRDTState => {
  if (local.callId !== remote.callId) {
    throw new Error(`Cannot merge calls with different IDs: ${local.callId} vs ${remote.callId}`);
  }
  
  return {
    callId: local.callId,
    initiator: mergeLWWRegisters(local.initiator, remote.initiator),
    status: mergeLWWRegisters(local.status, remote.status),
    invitedAt: mergeLWWRegisters(local.invitedAt, remote.invitedAt),
    connectedAt: mergeLWWRegisters(local.connectedAt, remote.connectedAt),
    endedAt: mergeLWWRegisters(local.endedAt, remote.endedAt),
    participants: mergeLWWRegisters(local.participants, remote.participants),
    callType: mergeLWWRegisters(local.callType, remote.callType),
    version: Math.max(local.version, remote.version) + 1,
  };
};

/**
 * Format call duration for display
 */
export const formatCallDuration = (
  call: VoiceCallCRDTState,
  currentTime: number
): string => {
  const connectedAt = getLWWValue(call.connectedAt);
  const endedAt = getLWWValue(call.endedAt);
  
  if (connectedAt === null) {
    return "Not connected";
  }
  
  const endTime = endedAt ?? currentTime;
  const duration = endTime - connectedAt;
  
  const minutes = Math.floor(duration / 60000);
  const seconds = Math.floor((duration % 60000) / 1000);
  
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
};

/**
 * Get a human-readable summary of the call state
 * Used for debugging and UI display
 */
export const getCallSummary = (
  call: VoiceCallCRDTState,
  currentTime: number,
  config?: StalenessConfig
) => {
  const { status, isStale, endedAt } = getEffectiveCallStatus(call, currentTime, config);
  const invitedAt = getLWWValue(call.invitedAt);
  
  return {
    callId: call.callId,
    status,
    isStale,
    isActive: isCallActive(call, currentTime, config),
    invited: formatLWWAge({ value: invitedAt, timestamp: invitedAt, actor: "" }),
    duration: formatCallDuration(call, currentTime),
    participants: getLWWValue(call.participants).length,
  };
};
