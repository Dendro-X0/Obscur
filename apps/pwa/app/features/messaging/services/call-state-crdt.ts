/**
 * Call State CRDT - Phase 4 Implementation
 *
 * LWW-Register based call state with TTL for automatic cleanup.
 * Fixes ghost calls by deriving state from CRDT, not event replay.
 *
 * Problem (Ghost Calls):
 * - Historical "call start" events were being replayed as commands
 * - Old calls would "resurrect" after sync
 * - No reliable way to determine if a call is truly active
 *
 * Solution:
 * - Call state is LWW-Register with timestamp-based resolution
 * - TTL ensures calls auto-end even if "end" event lost
 * - State derived from CRDT merge, not event replay
 * - Each participant asserts their view of call state
 *
 * @example
 * ```typescript
 * // Alice initiates call
 * let state = createCallState();
 * state = assertCallActive(state, callId, ALICE, now);
 *
 * // Bob joins
 * state = assertCallActive(state, callId, BOB, now);
 *
 * // Either can end
 * state = assertCallEnded(state, callId, ALICE, now + 3600000);
 *
 * // TTL auto-expires old calls
 * const status = getCallStatus(state, callId, now + 3 * 3600000); // 'ended'
 * ```
 */

import type { LWWRegister } from '@dweb/crdt/lww-register';
import {
  createLWWRegister,
  mergeLWWRegisters,
  getLWWRegisterValueWithTTL,
  hasRegisterExpired,
} from '@dweb/crdt/lww-register';

/** Unique call identifier */
export type CallId = string;

/** Participant identifier (pubkey) */
export type ParticipantId = string;

/** Call state value */
export interface CallStateValue {
  /** Call identifier */
  callId: CallId;
  /** Whether call is active */
  isActive: boolean;
  /** Who asserted this state */
  assertedBy: ParticipantId;
  /** When state was asserted */
  assertedAt: number;
  /** Optional: participants currently in call */
  participants: Set<ParticipantId>;
  /** Call metadata */
  metadata: CallMetadata;
}

/** Call metadata */
export interface CallMetadata {
  /** Call type */
  type: 'voice' | 'video';
  /** When call was initiated */
  initiatedAt: number;
  /** Who initiated */
  initiatedBy: ParticipantId;
  /** TTL in ms (default: 2 hours) */
  ttlMs: number;
}

/** Per-call entry with LWW-Register for each participant */
export interface CallEntry {
  /** Call ID */
  callId: CallId;
  /** LWW-Register per participant - their view of call state */
  participantRegisters: Map<ParticipantId, LWWRegister<CallStateValue>>;
  /** Default TTL for this call */
  defaultTtlMs: number;
}

/** Call state container */
export interface CallStateCRDT {
  /** Map of callId -> call entry */
  calls: Map<CallId, CallEntry>;
  /** Default TTL configuration */
  defaultTtlMs: number;
}

/** Derived call status for UI */
export interface CallStatus {
  /** Call ID */
  callId: CallId;
  /** Current state */
  state: 'idle' | 'ringing' | 'active' | 'ended' | 'expired';
  /** Participants currently in call */
  participants: ParticipantId[];
  /** Who initiated */
  initiatedBy: ParticipantId | null;
  /** When call started */
  startedAt: number | null;
  /** When call ended (or null if active) */
  endedAt: number | null;
  /** Whether call has expired due to TTL */
  isExpired: boolean;
  /** How many participants view as active */
  activeCount: number;
  /** How many participants view as ended */
  endedCount: number;
}

/** Default TTL: 2 hours */
export const DEFAULT_CALL_TTL_MS = 2 * 60 * 60 * 1000;

/** Create empty call state CRDT */
export const createCallState = (
  defaultTtlMs: number = DEFAULT_CALL_TTL_MS
): CallStateCRDT => ({
  calls: new Map(),
  defaultTtlMs,
});

/**
 * Get or create call entry
 */
const getOrCreateCallEntry = (
  state: CallStateCRDT,
  callId: CallId,
  defaultTtlMs?: number
): CallEntry => {
  const existing = state.calls.get(callId);
  if (existing) return existing;

  const newEntry: CallEntry = {
    callId,
    participantRegisters: new Map(),
    defaultTtlMs: defaultTtlMs ?? state.defaultTtlMs,
  };
  return newEntry;
};

/**
 * Assert that a call is active.
 * Called when participant joins or confirms active state.
 */
export const assertCallActive = (
  state: CallStateCRDT,
  callId: CallId,
  participantId: ParticipantId,
  now: number = Date.now(),
  metadata?: Partial<CallMetadata>,
  ttlMs?: number
): CallStateCRDT => {
  const entry = getOrCreateCallEntry(state, callId, ttlMs);

  // Get existing register or create new
  const existingRegister = entry.participantRegisters.get(participantId);
  const ttl = ttlMs ?? entry.defaultTtlMs;
  const existingValue = existingRegister
    ? getLWWRegisterValueWithTTL(existingRegister, ttl, now)
    : null;

  // Create new state value
  const newValue: CallStateValue = {
    callId,
    isActive: true,
    assertedBy: participantId,
    assertedAt: now,
    participants: existingValue?.participants ?? new Set([participantId]),
    metadata: existingValue?.metadata ?? {
      type: metadata?.type ?? 'voice',
      initiatedAt: metadata?.initiatedAt ?? now,
      initiatedBy: metadata?.initiatedBy ?? participantId,
      ttlMs: ttlMs ?? entry.defaultTtlMs,
    },
  };

  // Create/update register with vector clock
  const newRegister = createLWWRegister(
    newValue,
    participantId,
    { [participantId]: (existingRegister?.vectorClock[participantId] ?? 0) + 1 },
    now,
  );

  // Update entry
  const newParticipantRegisters = new Map(entry.participantRegisters);
  newParticipantRegisters.set(participantId, newRegister);

  const newEntry: CallEntry = {
    ...entry,
    participantRegisters: newParticipantRegisters,
  };

  const newCalls = new Map(state.calls);
  newCalls.set(callId, newEntry);

  return {
    ...state,
    calls: newCalls,
  };
};

/**
 * Assert that a call has ended.
 * Called when participant leaves or explicitly ends call.
 */
export const assertCallEnded = (
  state: CallStateCRDT,
  callId: CallId,
  participantId: ParticipantId,
  now: number = Date.now()
): CallStateCRDT => {
  const entry = state.calls.get(callId);
  if (!entry) return state;

  const existingRegister = entry.participantRegisters.get(participantId);
  const existingValue = existingRegister
    ? getLWWRegisterValueWithTTL(existingRegister, entry.defaultTtlMs, now)
    : null;

  // Create ended state
  const newValue: CallStateValue = {
    callId,
    isActive: false,
    assertedBy: participantId,
    assertedAt: now,
    participants: existingValue?.participants ?? new Set(),
    metadata: existingValue?.metadata ?? {
      type: 'voice',
      initiatedAt: now,
      initiatedBy: participantId,
      ttlMs: entry.defaultTtlMs,
    },
  };

  const newRegister = createLWWRegister(
    newValue,
    participantId,
    { [participantId]: (existingRegister?.vectorClock[participantId] ?? 0) + 1 },
    now,
  );

  const newParticipantRegisters = new Map(entry.participantRegisters);
  newParticipantRegisters.set(participantId, newRegister);

  const newEntry: CallEntry = {
    ...entry,
    participantRegisters: newParticipantRegisters,
  };

  const newCalls = new Map(state.calls);
  newCalls.set(callId, newEntry);

  return {
    ...state,
    calls: newCalls,
  };
};

/**
 * Get current call status.
 * Derives state from all participant LWW-Registers.
 */
export const getCallStatus = (
  state: CallStateCRDT,
  callId: CallId,
  now: number = Date.now()
): CallStatus => {
  const entry = state.calls.get(callId);

  if (!entry) {
    return {
      callId,
      state: 'idle',
      participants: [],
      initiatedBy: null,
      startedAt: null,
      endedAt: null,
      isExpired: false,
      activeCount: 0,
      endedCount: 0,
    };
  }

  // Collect all participant views
  let activeCount = 0;
  let endedCount = 0;
  let latestActiveTimestamp: number | null = null;
  let latestEndedTimestamp: number | null = null;
  let initiatedBy: ParticipantId | null = null;
  let startedAt: number | null = null;
  const allParticipants = new Set<ParticipantId>();
  let isExpired = false;

  for (const [participantId, register] of entry.participantRegisters) {
    const ttl = entry.defaultTtlMs;
    const expired = hasRegisterExpired(register, ttl, now);
    const value = register.value;

    allParticipants.add(participantId);

    if (expired) {
      isExpired = true;
      continue;
    }

    if (value.isActive) {
      activeCount++;
      if (latestActiveTimestamp === null || value.assertedAt > latestActiveTimestamp) {
        latestActiveTimestamp = value.assertedAt;
        initiatedBy = value.metadata.initiatedBy;
        startedAt = value.metadata.initiatedAt;
      }
    } else {
      endedCount++;
      if (latestEndedTimestamp === null || value.assertedAt > latestEndedTimestamp) {
        latestEndedTimestamp = value.assertedAt;
      }
    }

    if (value.metadata.initiatedAt && startedAt === null) {
      startedAt = value.metadata.initiatedAt;
    }
    if (value.metadata.initiatedBy && initiatedBy === null) {
      initiatedBy = value.metadata.initiatedBy;
    }
  }

  // Derive state
  let callState: CallStatus['state'];
  if (activeCount > 0 && !isExpired) {
    callState = activeCount === 1 ? 'ringing' : 'active';
  } else if (endedCount > 0 || isExpired) {
    callState = isExpired ? 'expired' : 'ended';
  } else {
    callState = 'idle';
  }

  return {
    callId,
    state: callState,
    participants: Array.from(allParticipants),
    initiatedBy,
    startedAt,
    endedAt: latestEndedTimestamp,
    isExpired,
    activeCount,
    endedCount,
  };
};

/**
 * Check if there is an active call involving a specific participant.
 */
export const hasActiveCallWithParticipant = (
  state: CallStateCRDT,
  participantId: ParticipantId,
  now: number = Date.now()
): boolean => {
  for (const [callId, entry] of state.calls) {
    const status = getCallStatus(state, callId, now);
    if ((status.state === 'active' || status.state === 'ringing') &&
        status.participants.includes(participantId)) {
      return true;
    }
  }
  return false;
};

/**
 * Get all active calls.
 */
export const getActiveCalls = (
  state: CallStateCRDT,
  now: number = Date.now()
): CallStatus[] => {
  const active: CallStatus[] = [];

  for (const callId of state.calls.keys()) {
    const status = getCallStatus(state, callId, now);
    // Only include non-expired calls in active list
    if (!status.isExpired && (status.state === 'active' || status.state === 'ringing')) {
      active.push(status);
    }
  }

  return active;
};

/**
 * Merge two call state CRDTs.
 * Used during sync/restore.
 */
export const mergeCallStates = (
  local: CallStateCRDT,
  remote: CallStateCRDT,
  _now: number = Date.now()
): CallStateCRDT => {
  const mergedCalls = new Map(local.calls);

  for (const [callId, remoteEntry] of remote.calls) {
    const localEntry = mergedCalls.get(callId);

    if (!localEntry) {
      // Remote has call we don't have
      mergedCalls.set(callId, remoteEntry);
    } else {
      // Merge participant registers
      const mergedRegisters = new Map(localEntry.participantRegisters);

      for (const [participantId, remoteRegister] of remoteEntry.participantRegisters) {
        const localRegister = mergedRegisters.get(participantId);

        if (!localRegister) {
          mergedRegisters.set(participantId, remoteRegister);
        } else {
          // LWW-Register merge
          const merged = mergeLWWRegisters(localRegister, remoteRegister);
          mergedRegisters.set(participantId, merged);
        }
      }

      mergedCalls.set(callId, {
        ...localEntry,
        participantRegisters: mergedRegisters,
      });
    }
  }

  return {
    calls: mergedCalls,
    defaultTtlMs: local.defaultTtlMs,
  };
};

/**
 * Cleanup expired calls.
 * Call periodically to reclaim memory.
 */
export const cleanupExpiredCalls = (
  state: CallStateCRDT,
  now: number = Date.now()
): CallStateCRDT => {
  const cleaned = new Map<CallId, CallEntry>();

  for (const [callId, entry] of state.calls) {
    const status = getCallStatus(state, callId, now);

    // Keep if not expired and has active participants, or very recently ended
    if (!status.isExpired) {
      // Also remove if ended more than TTL ago
      const timeSinceEnd = status.endedAt ? now - status.endedAt : 0;
      if (status.state !== 'ended' || timeSinceEnd < entry.defaultTtlMs) {
        cleaned.set(callId, entry);
      }
    }
  }

  return {
    ...state,
    calls: cleaned,
  };
};

/**
 * Add participant to existing call.
 */
export const addParticipantToCall = (
  state: CallStateCRDT,
  callId: CallId,
  participantId: ParticipantId,
  now: number = Date.now()
): CallStateCRDT => {
  // Avoid unused parameter warning by using now in assertion
  void now;
  const entry = state.calls.get(callId);
  if (!entry) return state;

  // Assert active state for new participant
  return assertCallActive(state, callId, participantId, now);
};

/**
 * Remove participant from call.
 * If last participant, call ends.
 */
export const removeParticipantFromCall = (
  state: CallStateCRDT,
  callId: CallId,
  participantId: ParticipantId,
  now: number = Date.now()
): CallStateCRDT => {
  const entry = state.calls.get(callId);
  if (!entry) return state;

  // Remove participant's register
  const newRegisters = new Map(entry.participantRegisters);
  newRegisters.delete(participantId);

  // If no participants left, call is effectively ended
  if (newRegisters.size === 0) {
    const newCalls = new Map(state.calls);
    newCalls.delete(callId);
    return {
      ...state,
      calls: newCalls,
    };
  }

  // Otherwise update entry
  const newEntry: CallEntry = {
    ...entry,
    participantRegisters: newRegisters,
  };

  const newCalls = new Map(state.calls);
  newCalls.set(callId, newEntry);

  return {
    ...state,
    calls: newCalls,
  };
};

/**
 * Get diagnostics for debugging.
 */
export const getCallDiagnostics = (
  state: CallStateCRDT,
  now: number = Date.now()
): {
  totalCalls: number;
  activeCalls: number;
  endedCalls: number;
  expiredCalls: number;
  totalParticipants: number;
} => {
  let active = 0;
  let ended = 0;
  let expired = 0;
  let totalParticipants = 0;

  for (const callId of state.calls.keys()) {
    const status = getCallStatus(state, callId, now);
    totalParticipants += status.participants.length;

    if (status.state === 'active' || status.state === 'ringing') {
      active++;
    } else if (status.state === 'ended' || status.state === 'expired') {
      // Count both ended and expired as "ended"
      if (status.state === 'ended') ended++;
      else expired++;
    }
  }

  return {
    totalCalls: state.calls.size,
    activeCalls: active,
    endedCalls: ended,
    expiredCalls: expired,
    totalParticipants,
  };
};
