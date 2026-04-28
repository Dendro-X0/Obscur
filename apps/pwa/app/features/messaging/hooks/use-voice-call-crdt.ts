/**
 * useVoiceCallCRDT Hook
 * 
 * React hook for managing voice call state with CRDT semantics.
 * Prevents "ghost calls" by using LWW-Registers with staleness detection.
 * 
 * Key benefits:
 * - Auto-detects stale calls (old ringing/inviting/connected calls)
 * - No ghost calls from historical event replay
 * - Proper merge semantics for cross-device sync
 * - Transparent call lifecycle management
 */

"use client";

import { useCallback, useMemo, useState, useEffect } from "react";
import {
  createVoiceCallCRDT,
  transitionCallStatus,
  addParticipant,
  removeParticipant,
  mergeCallStates,
  isCallActive,
  isCallStale,
  getEffectiveCallStatus,
  formatCallDuration,
  type VoiceCallCRDTState,
  type CallStatus,
  type CallType,
  type StalenessConfig,
} from "../services/voice-call-crdt";

export interface UseVoiceCallCRDTOptions {
  /** Actor/device identifier */
  actor?: string;
  /** Staleness detection config */
  stalenessConfig?: StalenessConfig;
  /** Auto-end stale calls */
  autoEndStale?: boolean;
}

export interface UseVoiceCallCRDTReturn {
  /** Current call state */
  call: VoiceCallCRDTState | null;
  
  /** Whether there is an active call */
  hasActiveCall: boolean;
  
  /** Effective call status (accounts for staleness) */
  effectiveStatus: CallStatus | null;
  
  /** Whether the call is stale (ghost call) */
  isStale: boolean;
  
  /** Formatted call duration */
  duration: string;
  
  /** Number of participants */
  participantCount: number;
  
  /** Create a new call */
  createCall: (callId: string, initiatorPubkey: string, callType?: CallType) => void;
  
  /** Transition call status */
  transitionStatus: (newStatus: CallStatus) => void;
  
  /** Accept/answer the call */
  acceptCall: () => void;
  
  /** End the call */
  endCall: () => void;
  
  /** Reject the call */
  rejectCall: () => void;
  
  /** Add a participant */
  addCallParticipant: (pubkey: string) => void;
  
  /** Remove a participant */
  removeCallParticipant: (pubkey: string) => void;
  
  /** Merge state from another device */
  mergeCallState: (otherState: VoiceCallCRDTState) => void;
  
  /** Clear the current call */
  clearCall: () => void;
  
  /** Manual staleness check (for debugging) */
  checkStaleness: () => { isStale: boolean; reason?: string; effectiveEndedAt?: number };
}

/**
 * React hook for CRDT-based voice call management
 * 
 * Prevents ghost calls through staleness detection and LWW semantics.
 * 
 * @param options - Configuration options
 */
export const useVoiceCallCRDT = (
  options: UseVoiceCallCRDTOptions = {}
): UseVoiceCallCRDTReturn => {
  const { actor, stalenessConfig, autoEndStale = true } = options;
  
  const [call, setCall] = useState<VoiceCallCRDTState | null>(null);
  const [currentTime, setCurrentTime] = useState<number>(0);
  
  // Initialize and update current time periodically for staleness checks
  useEffect(() => {
    setCurrentTime(Date.now());
    const interval = setInterval(() => {
      setCurrentTime(Date.now());
    }, 1000); // Update every second for accurate staleness detection
    return () => clearInterval(interval);
  }, []);

  /**
   * Create a new call
   */
  const createCall = useCallback((
    callId: string,
    initiatorPubkey: string,
    callType: CallType = "audio"
  ) => {
    setCall(createVoiceCallCRDT(callId, initiatorPubkey, callType, actor));
  }, [actor]);

  /**
   * Transition call to a new status
   */
  const transitionStatus = useCallback((newStatus: CallStatus) => {
    setCall((current) => {
      if (!current) return null;
      return transitionCallStatus(current, newStatus, actor ?? "unknown", Date.now());
    });
  }, [actor]);

  /**
   * Accept/answer the call
   */
  const acceptCall = useCallback(() => {
    transitionStatus("connected");
  }, [transitionStatus]);

  /**
   * End the call
   */
  const endCall = useCallback(() => {
    transitionStatus("ended");
  }, [transitionStatus]);

  /**
   * Reject the call
   */
  const rejectCall = useCallback(() => {
    transitionStatus("rejected");
  }, [transitionStatus]);

  /**
   * Add a participant
   */
  const addCallParticipant = useCallback((pubkey: string) => {
    setCall((current) => {
      if (!current) return null;
      return addParticipant(current, pubkey, actor ?? "unknown", Date.now());
    });
  }, [actor]);

  /**
   * Remove a participant
   */
  const removeCallParticipant = useCallback((pubkey: string) => {
    setCall((current) => {
      if (!current) return null;
      return removeParticipant(current, pubkey, actor ?? "unknown", Date.now());
    });
  }, [actor]);

  /**
   * Merge state from another device
   */
  const mergeCallState = useCallback((otherState: VoiceCallCRDTState) => {
    setCall((current) => {
      if (!current) return otherState;
      return mergeCallStates(current, otherState);
    });
  }, []);

  /**
   * Clear the current call
   */
  const clearCall = useCallback(() => {
    setCall(null);
  }, []);

  /**
   * Check staleness of current call
   */
  const checkStaleness = useCallback(() => {
    if (!call) return { isStale: false };
    return isCallStale(call, currentTime, stalenessConfig);
  }, [call, currentTime, stalenessConfig]);

  /**
   * Auto-end stale calls
   */
  useEffect(() => {
    if (!autoEndStale || !call) return;
    
    const staleness = isCallStale(call, currentTime, stalenessConfig);
    if (staleness.isStale) {
      console.log(`[VoiceCallCRDT] Auto-ending stale call: ${staleness.reason}`);
      transitionStatus("ended");
    }
  }, [call, currentTime, stalenessConfig, autoEndStale, transitionStatus]);

  /**
   * Derived values
   */
  const hasActiveCall = useMemo(() => 
    call ? isCallActive(call, currentTime, stalenessConfig) : false,
    [call, currentTime, stalenessConfig]
  );

  const effectiveStatus = useMemo(() => {
    if (!call) return null;
    const { status } = getEffectiveCallStatus(call, currentTime, stalenessConfig);
    return status;
  }, [call, currentTime, stalenessConfig]);

  const isStale = useMemo(() => {
    if (!call) return false;
    return isCallStale(call, currentTime, stalenessConfig).isStale;
  }, [call, currentTime, stalenessConfig]);

  const duration = useMemo(() => {
    if (!call) return "0s";
    return formatCallDuration(call, currentTime);
  }, [call, currentTime]);

  const participantCount = useMemo(() => {
    if (!call) return 0;
    return call.participants.value.length;
  }, [call]);

  return {
    call,
    hasActiveCall,
    effectiveStatus,
    isStale,
    duration,
    participantCount,
    createCall,
    transitionStatus,
    acceptCall,
    endCall,
    rejectCall,
    addCallParticipant,
    removeCallParticipant,
    mergeCallState,
    clearCall,
    checkStaleness,
  };
};

/**
 * Hook for managing multiple concurrent calls
 * Useful for handling call history while showing active call UI
 */
export const useVoiceCallManager = (
  options: UseVoiceCallCRDTOptions = {}
): {
  activeCall: UseVoiceCallCRDTReturn | null;
  callHistory: VoiceCallCRDTState[];
  createNewCall: (callId: string, initiator: string, type?: CallType) => UseVoiceCallCRDTReturn;
  endAndArchive: () => void;
} => {
  const [callHistory, setCallHistory] = useState<VoiceCallCRDTState[]>([]);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  
  const activeCallHook = useVoiceCallCRDT({
    ...options,
    autoEndStale: true,
  });

  /**
   * Create a new call and archive any existing active call
   */
  const createNewCall = useCallback((
    callId: string,
    initiator: string,
    type: CallType = "audio"
  ) => {
    // Archive current active call if exists
    if (activeCallHook.call && activeCallId) {
      setCallHistory(prev => [activeCallHook.call!, ...prev]);
    }
    
    // Create new call
    activeCallHook.createCall(callId, initiator, type);
    setActiveCallId(callId);
    
    return activeCallHook;
  }, [activeCallHook, activeCallId]);

  /**
   * End active call and move to history
   */
  const endAndArchive = useCallback(() => {
    if (activeCallHook.call && activeCallId) {
      // Ensure call is ended
      activeCallHook.endCall();
      
      // Move to history
      setCallHistory(prev => [activeCallHook.call!, ...prev]);
      
      // Clear active
      activeCallHook.clearCall();
      setActiveCallId(null);
    }
  }, [activeCallHook, activeCallId]);

  return {
    activeCall: activeCallId ? activeCallHook : null,
    callHistory,
    createNewCall,
    endAndArchive,
  };
};

export default useVoiceCallCRDT;
