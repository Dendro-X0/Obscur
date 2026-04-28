/**
 * Use Call State Hook
 *
 * React hook for integrating Call State CRDT with UI components.
 * Provides reactive call state for voice/video call UI.
 *
 * Ghost Call Prevention:
 * - Uses CRDT-derived state, not raw event replay
 * - TTL auto-expires old calls
 * - Only active/ringing calls trigger UI updates
 *
 * @example
 * ```tsx
 * function CallUI({ callId }: { callId: string }) {
 *   const { status, isActive, endCall } = useCallState(callId);
 *
 *   if (!isActive) return null; // Ghost call prevention
 *
 *   return (
 *     <CallInterface
 *       participants={status.participants}
 *       onEnd={() => endCall()}
 *     />
 *   );
 * }
 * ```
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getCurrentCallStatus,
  getAllActiveCalls,
  initiateCall,
  endCall,
  isInActiveCallWith,
  subscribeToCallEvents,
  type CallStatus,
  type CallSignalType,
} from "../services/call-state-runtime.js";

/** Hook return value */
export interface UseCallStateResult {
  /** Current call status */
  status: CallStatus | null;
  /** Whether call is active */
  isActive: boolean;
  /** Whether call is ringing */
  isRinging: boolean;
  /** Call participants */
  participants: string[];
  /** Initiate a new call */
  initiateCall: (participantPubkey: string, type?: "voice" | "video") => void;
  /** End current call */
  endCall: () => void;
  /** Accept incoming call */
  acceptCall: () => void;
  /** Reject incoming call */
  rejectCall: () => void;
  /** Whether another call is active */
  hasOtherActiveCall: boolean;
}

/** Hook options */
export interface UseCallStateOptions {
  /** Profile ID (current user) */
  profileId: string;
  /** Call ID to monitor (optional - if not provided, monitors all) */
  callId?: string;
  /** Auto-accept calls from these pubkeys */
  autoAcceptFrom?: string[];
  /** Callback when call becomes active */
  onCallActive?: (status: CallStatus) => void;
  /** Callback when call ends */
  onCallEnd?: (status: CallStatus) => void;
  /** Callback for WebRTC signals */
  onWebRTCSignal?: (type: CallSignalType, data: unknown) => void;
}

/**
 * React hook for call state management.
 */
export const useCallState = (
  options: UseCallStateOptions
): UseCallStateResult => {
  const { profileId, callId, onCallActive, onCallEnd, onWebRTCSignal } =
    options;

  // Track call status
  const [status, setStatus] = useState<CallStatus | null>(
    callId ? getCurrentCallStatus(profileId, callId) : null
  );

  // Track other active calls
  const [activeCalls, setActiveCalls] = useState<CallStatus[]>(
    getAllActiveCalls(profileId)
  );

  // Refs for callbacks
  const onCallActiveRef = useRef(onCallActive);
  const onCallEndRef = useRef(onCallEnd);
  const onWebRTCSignalRef = useRef(onWebRTCSignal);

  // Update refs when callbacks change
  useEffect(() => {
    onCallActiveRef.current = onCallActive;
    onCallEndRef.current = onCallEnd;
    onWebRTCSignalRef.current = onWebRTCSignal;
  }, [onCallActive, onCallEnd, onWebRTCSignal]);

  // Subscribe to call events
  useEffect(() => {
    const unsubscribe = subscribeToCallEvents(profileId, (event) => {
      // Update status if this is our call
      if (callId && event.callId === callId) {
        setStatus(event.status);

        // Trigger callbacks
        if (
          event.status.state === "active" ||
          event.status.state === "ringing"
        ) {
          onCallActiveRef.current?.(event.status);
        } else if (event.type === "call-end") {
          onCallEndRef.current?.(event.status);
        }
      }

      // Handle WebRTC signals
      if (
        event.type === "call-offer" ||
        event.type === "call-answer" ||
        event.type === "call-ice"
      ) {
        onWebRTCSignalRef.current?.(event.type, event.webrtcData);
      }

      // Update active calls list
      setActiveCalls(getAllActiveCalls(profileId));
    });

    return unsubscribe;
  }, [profileId, callId]);

  // Periodic status refresh (for TTL expiry)
  useEffect(() => {
    if (!callId) return;

    const interval = setInterval(() => {
      const current = getCurrentCallStatus(profileId, callId);
      setStatus(current);
    }, 5000); // Check every 5 seconds

    return () => clearInterval(interval);
  }, [profileId, callId]);

  // Initiate call callback
  const initiateCallCallback = useCallback(
    (participantPubkey: string, type: "voice" | "video" = "voice") => {
      if (!callId) return;

      const newStatus = initiateCall(
        profileId,
        callId,
        participantPubkey,
        type
      );
      setStatus(newStatus);
    },
    [profileId, callId]
  );

  // End call callback
  const endCallCallback = useCallback(() => {
    if (!callId) return;

    const newStatus = endCall(profileId, callId);
    setStatus(newStatus);
  }, [profileId, callId]);

  // Accept call callback
  const acceptCallCallback = useCallback(() => {
    if (!callId) return;

    // Accept = add self to active participants
    const newStatus = initiateCall(profileId, callId, profileId);
    setStatus(newStatus);
  }, [profileId, callId]);

  // Reject call callback
  const rejectCallCallback = useCallback(() => {
    if (!callId) return;

    const newStatus = endCall(profileId, callId);
    setStatus(newStatus);
  }, [profileId, callId]);

  // Derived state
  const isActive = status?.state === "active" || false;
  const isRinging = status?.state === "ringing" || false;
  const participants = status?.participants ?? [];

  // Check if there's another active call with someone else
  const hasOtherActiveCall = activeCalls.some(
    (call) =>
      call.callId !== callId &&
      (call.state === "active" || call.state === "ringing") &&
      call.participants.some((p) => p !== profileId)
  );

  return {
    status,
    isActive,
    isRinging,
    participants,
    initiateCall: initiateCallCallback,
    endCall: endCallCallback,
    acceptCall: acceptCallCallback,
    rejectCall: rejectCallCallback,
    hasOtherActiveCall,
  };
};

/**
 * Hook for listing all active calls.
 */
export const useActiveCalls = (profileId: string): {
  activeCalls: CallStatus[];
  hasActiveCall: boolean;
} => {
  const [activeCalls, setActiveCalls] = useState<CallStatus[]>(
    getAllActiveCalls(profileId)
  );

  useEffect(() => {
    const unsubscribe = subscribeToCallEvents(profileId, () => {
      setActiveCalls(getAllActiveCalls(profileId));
    });

    // Periodic refresh for TTL
    const interval = setInterval(() => {
      setActiveCalls(getAllActiveCalls(profileId));
    }, 5000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [profileId]);

  return {
    activeCalls,
    hasActiveCall: activeCalls.length > 0,
  };
};

/**
 * Hook for checking if in call with specific participant.
 */
export const useHasActiveCallWith = (
  profileId: string,
  participantPubkey: string
): boolean => {
  const [hasCall, setHasCall] = useState(
    isInActiveCallWith(profileId, participantPubkey)
  );

  useEffect(() => {
    const unsubscribe = subscribeToCallEvents(profileId, () => {
      setHasCall(isInActiveCallWith(profileId, participantPubkey));
    });

    const interval = setInterval(() => {
      setHasCall(isInActiveCallWith(profileId, participantPubkey));
    }, 5000);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [profileId, participantPubkey]);

  return hasCall;
};
