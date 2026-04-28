/**
 * Call State Runtime Integration - Phase 4 Runtime Integration
 *
 * Integrates Call State CRDT with voice call signal handling.
 * Fixes ghost calls by using CRDT-derived state instead of event replay.
 *
 * Ghost Call Problem:
 * - Historical "voice-call-signal" events were replayed during sync
 * - Old calls would "resurrect" and appear as active in UI
 * - No reliable way to distinguish active vs historical calls
 *
 * Solution:
 * - Call state is stored in LWW-Register CRDT with TTL
 * - TTL auto-expires old calls (default: 2 hours)
 * - State derived from CRDT merge, not event replay
 * - UI reads from CRDT state, not raw events
 *
 * @module CallStateRuntime
 */

import type { NostrEvent } from "@dweb/nostr/nostr-event";
// Re-export types from call-state-crdt for consumers
export type {
  CallStatus,
  CallStateCRDT,
  CallId,
} from "./call-state-crdt.js";

import {
  createCallState,
  assertCallActive,
  assertCallEnded,
  getCallStatus,
  hasActiveCallWithParticipant,
  getActiveCalls,
  mergeCallStates,
  cleanupExpiredCalls,
  addParticipantToCall,
  getCallDiagnostics,
  type CallStateCRDT as CallStateCRDTType,
  type CallStatus as CallStatusType,
} from "./call-state-crdt.js";

/** Call signal types from Nostr events */
export type CallSignalType =
  | "call-start"
  | "call-accept"
  | "call-reject"
  | "call-end"
  | "call-ice"
  | "call-offer"
  | "call-answer";

/** Parsed call signal from event */
export interface CallSignal {
  /** Call ID */
  callId: string;
  /** Signal type */
  type: CallSignalType;
  /** Sender pubkey */
  senderPubkey: string;
  /** Recipient pubkey */
  recipientPubkey: string;
  /** Call timestamp in milliseconds */
  timestamp: number;
  /** WebRTC data (offer/answer/ice) */
  webrtcData?: unknown;
  /** Call metadata */
  metadata?: {
    type?: "voice" | "video";
    initiatedBy?: string;
    initiatedAt?: number;
  };
}

/** Call event handler callback */
export type CallEventHandler = (
  event: {
    type: CallSignalType;
    callId: string;
    senderPubkey: string;
    status: CallStatusType;
    webrtcData?: unknown;
  }
) => void;

/** Global call state store - scoped by profile */
const callStates = new Map<string, CallStateCRDTType>();

/** Event handlers by profile */
const callEventHandlers = new Map<string, CallEventHandler[]>();

/**
 * Get or create call state CRDT for profile.
 */
export const getCallStateForProfile = (profileId: string): CallStateCRDTType => {
  const existing = callStates.get(profileId);
  if (existing) return existing;

  const newState = createCallState();
  callStates.set(profileId, newState);
  return newState;
};

/**
 * Clear call state for profile (e.g., on logout).
 */
export const clearCallStateForProfile = (profileId: string): void => {
  callStates.delete(profileId);
  callEventHandlers.delete(profileId);
};

/**
 * Parse call signal from Nostr event.
 */
export const parseCallSignal = (event: NostrEvent): CallSignal | null => {
  // Only process kind 2501 (voice call signals)
  if (event.kind !== 2501) return null;

  try {
    const content = JSON.parse(event.content);

    // Validate required fields
    if (!content.callId || !content.type) {
      return null;
    }

    // Extract pubkeys from tags
    const pTags = event.tags.filter((tag) => tag[0] === "p");
    const recipientPubkey = pTags[0]?.[1] ?? "";

    return {
      callId: content.callId as string,
      type: content.type as CallSignalType,
      senderPubkey: event.pubkey,
      recipientPubkey,
      timestamp: event.created_at * 1000,
      webrtcData: content.webrtcData,
      metadata: content.metadata,
    };
  } catch {
    return null;
  }
};

/**
 * Process incoming call signal event.
 * Updates CRDT state and notifies handlers.
 *
 * This is the KEY function for ghost call prevention:
 * - Updates CRDT state (not raw event log)
 * - TTL ensures old signals don't resurrect calls
 * - Only active calls are reported to UI
 */
export const processCallSignal = (
  profileId: string,
  event: NostrEvent,
  now: number = Date.now()
): void => {
  const signal = parseCallSignal(event);
  if (!signal) return;

  const state = getCallStateForProfile(profileId);

  // Update CRDT based on signal type
  let newState: CallStateCRDTType;

  switch (signal.type) {
    case "call-start":
      newState = assertCallActive(state, signal.callId, signal.senderPubkey, now, {
        type: signal.metadata?.type ?? "voice",
        initiatedAt: signal.timestamp,
        initiatedBy: signal.senderPubkey,
      });
      break;

    case "call-accept":
      newState = addParticipantToCall(
        state,
        signal.callId,
        signal.senderPubkey,
        now
      );
      break;

    case "call-end":
    case "call-reject":
      newState = assertCallEnded(state, signal.callId, signal.senderPubkey, now);
      break;

    case "call-offer":
    case "call-answer":
    case "call-ice":
      // These are WebRTC handshake messages - don't change call state
      // Just notify handlers for WebRTC processing
      newState = state;
      break;

    default:
      newState = state;
  }

  // Store updated state
  callStates.set(profileId, newState);

  // Get current status
  const status = getCallStatus(newState, signal.callId, now);

  // Notify handlers (only if call is active/ringing or was just ended)
  if (status.state === "active" || status.state === "ringing" || signal.type === "call-end") {
    notifyCallHandlers(profileId, {
      type: signal.type,
      callId: signal.callId,
      senderPubkey: signal.senderPubkey,
      status,
      webrtcData: signal.webrtcData,
    });
  }

  // Cleanup expired calls periodically (every ~50 calls)
  if (Math.random() < 0.02) {
    const cleaned = cleanupExpiredCalls(newState, now);
    callStates.set(profileId, cleaned);
  }
};

/**
 * Subscribe to call events for profile.
 */
export const subscribeToCallEvents = (
  profileId: string,
  handler: CallEventHandler
): (() => void) => {
  const handlers = callEventHandlers.get(profileId) ?? [];
  handlers.push(handler);
  callEventHandlers.set(profileId, handlers);

  // Return unsubscribe function
  return () => {
    const current = callEventHandlers.get(profileId) ?? [];
    callEventHandlers.set(
      profileId,
      current.filter((h) => h !== handler)
    );
  };
};

/**
 * Notify all handlers for profile.
 */
const notifyCallHandlers = (
  profileId: string,
  event: Parameters<CallEventHandler>[0]
): void => {
  const handlers = callEventHandlers.get(profileId) ?? [];
  for (const handler of handlers) {
    try {
      handler(event);
    } catch (err) {
      console.error("[CallState] Handler error:", err);
    }
  }
};

/**
 * Get current call status for UI.
 */
export const getCurrentCallStatus = (
  profileId: string,
  callId: string,
  now: number = Date.now()
): CallStatusType => {
  const state = getCallStateForProfile(profileId);
  return getCallStatus(state, callId, now);
};

/**
 * Check if there's an active call with a participant.
 */
export const isInActiveCallWith = (
  profileId: string,
  participantPubkey: string,
  now: number = Date.now()
): boolean => {
  const state = getCallStateForProfile(profileId);
  return hasActiveCallWithParticipant(state, participantPubkey, now);
};

/**
 * Get all active calls for UI.
 */
export const getAllActiveCalls = (
  profileId: string,
  now: number = Date.now()
): CallStatusType[] => {
  const state = getCallStateForProfile(profileId);
  return getActiveCalls(state, now);
};

/**
 * User-initiated call start.
 */
export const initiateCall = (
  profileId: string,
  callId: string,
  participantPubkey: string,
  callType: "voice" | "video" = "voice",
  now: number = Date.now()
): CallStatusType => {
  const state = getCallStateForProfile(profileId);

  const newState = assertCallActive(state, callId, participantPubkey, now, {
    type: callType,
    initiatedAt: now,
    initiatedBy: profileId, // My pubkey
  });

  callStates.set(profileId, newState);
  return getCallStatus(newState, callId, now);
};

/**
 * User-initiated call end.
 */
export const endCall = (
  profileId: string,
  callId: string,
  now: number = Date.now()
): CallStatusType => {
  const state = getCallStateForProfile(profileId);
  const newState = assertCallEnded(state, callId, profileId, now);

  callStates.set(profileId, newState);
  return getCallStatus(newState, callId, now);
};

/**
 * Merge call states during sync/restore.
 */
export const mergeProfileCallStates = (
  profileId: string,
  remoteState: CallStateCRDTType,
  now: number = Date.now()
): void => {
  const localState = getCallStateForProfile(profileId);
  const merged = mergeCallStates(localState, remoteState, now);

  // After merge, cleanup expired calls
  const cleaned = cleanupExpiredCalls(merged, now);
  callStates.set(profileId, cleaned);
};

/**
 * Export call state for backup.
 */
export const exportCallStateForBackup = (
  profileId: string
): CallStateCRDTType => {
  return getCallStateForProfile(profileId);
};

/**
 * Get call diagnostics for debugging.
 */
export const getCallStateDiagnostics = (
  profileId: string,
  now: number = Date.now()
): ReturnType<typeof getCallDiagnostics> => {
  const state = getCallStateForProfile(profileId);
  return getCallDiagnostics(state, now);
};

/**
 * Filter ghost calls from message list.
 * Use this to hide historical call signals that have expired.
 */
export const isGhostCallEvent = (
  profileId: string,
  event: NostrEvent,
  now: number = Date.now()
): boolean => {
  if (event.kind !== 2501) return false;

  const signal = parseCallSignal(event);
  if (!signal) return false;

  const state = getCallStateForProfile(profileId);
  const status = getCallStatus(state, signal.callId, now);

  // Ghost call = expired or ended call with old timestamp
  if (status.state === "expired") {
    return true;
  }

  // Check if signal is older than TTL (2 hours)
  const twoHoursMs = 2 * 60 * 60 * 1000;
  if (now - signal.timestamp > twoHoursMs) {
    return true;
  }

  return false;
};
