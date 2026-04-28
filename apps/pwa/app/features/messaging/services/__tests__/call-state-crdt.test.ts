/**
 * Call State CRDT Tests - Phase 4
 *
 * Tests LWW-Register based call state with TTL for ghost call prevention.
 */

import { describe, it, expect } from 'vitest';
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
  removeParticipantFromCall,
  getCallDiagnostics,
  DEFAULT_CALL_TTL_MS,
} from '../call-state-crdt.js';

describe('Call State CRDT', () => {
  const ALICE = 'alice-pubkey';
  const BOB = 'bob-pubkey';
  const CHARLIE = 'charlie-pubkey';
  const CALL_ID = 'call-001';

  describe('Creation', () => {
    it('should create empty call state', () => {
      const state = createCallState();
      expect(state.calls.size).toBe(0);
      expect(state.defaultTtlMs).toBe(DEFAULT_CALL_TTL_MS);
    });

    it('should create with custom TTL', () => {
      const state = createCallState(3600000); // 1 hour
      expect(state.defaultTtlMs).toBe(3600000);
    });
  });

  describe('Asserting Active State', () => {
    it('should assert call active for participant', () => {
      let state = createCallState();
      const now = 1000000;

      state = assertCallActive(state, CALL_ID, ALICE, now);

      const status = getCallStatus(state, CALL_ID, now);
      expect(status.state).toBe('ringing'); // Only 1 participant = ringing
      expect(status.participants).toContain(ALICE);
      expect(status.initiatedBy).toBe(ALICE);
    });

    it('should transition to active when both participants join', () => {
      let state = createCallState();
      const now = 1000000;

      state = assertCallActive(state, CALL_ID, ALICE, now);
      state = assertCallActive(state, CALL_ID, BOB, now);

      const status = getCallStatus(state, CALL_ID, now);
      expect(status.state).toBe('active'); // 2+ participants = active
      expect(status.activeCount).toBe(2);
    });

    it('should track call metadata', () => {
      let state = createCallState();
      const now = 1000000;

      state = assertCallActive(state, CALL_ID, ALICE, now, {
        type: 'video',
        initiatedAt: now,
        initiatedBy: ALICE,
      });

      const status = getCallStatus(state, CALL_ID, now);
      expect(status.initiatedBy).toBe(ALICE);
      expect(status.startedAt).toBe(now);
    });
  });

  describe('Asserting Ended State', () => {
    it('should end call for participant', () => {
      let state = createCallState();
      const now = 1000000;

      state = assertCallActive(state, CALL_ID, ALICE, now);
      state = assertCallActive(state, CALL_ID, BOB, now);
      state = assertCallEnded(state, CALL_ID, ALICE, now + 5000);

      const status = getCallStatus(state, CALL_ID, now + 5000);
      expect(status.state).toBe('ringing'); // One participant remains active
      expect(status.endedCount).toBe(1);
    });

    it('should end call when both participants leave', () => {
      let state = createCallState();
      const now = 1000000;

      state = assertCallActive(state, CALL_ID, ALICE, now);
      state = assertCallActive(state, CALL_ID, BOB, now);
      state = assertCallEnded(state, CALL_ID, ALICE, now + 5000);
      state = assertCallEnded(state, CALL_ID, BOB, now + 5000);

      const status = getCallStatus(state, CALL_ID, now + 5000);
      expect(status.state).toBe('ended');
      expect(status.endedCount).toBe(2);
    });
  });

  describe('Ghost Call Prevention (Phase 4 Key Test)', () => {
    it('should NOT resurrect old call from historical event (ghost call prevention)', () => {
      // Simulate: Old call happened yesterday
      const yesterday = Date.now() - 24 * 60 * 60 * 1000;
      const now = Date.now();

      let state = createCallState();

      // Old call events arrive (from sync/history)
      state = assertCallActive(state, 'old-call', ALICE, yesterday);
      state = assertCallActive(state, 'old-call', BOB, yesterday);

      // Check current status - should be expired due to TTL
      const status = getCallStatus(state, 'old-call', now);
      expect(status.state).toBe('expired');
      expect(status.isExpired).toBe(true);
    });

    it('should auto-end call after TTL expires', () => {
      const now = 1000000;
      const ttl = 2 * 60 * 60 * 1000; // 2 hours

      let state = createCallState(ttl);
      state = assertCallActive(state, CALL_ID, ALICE, now);
      state = assertCallActive(state, CALL_ID, BOB, now);

      // Immediately after: active
      expect(getCallStatus(state, CALL_ID, now).state).toBe('active');

      // After 1 hour: still active
      expect(getCallStatus(state, CALL_ID, now + 3600000).state).toBe('active');

      // After 3 hours (past TTL): expired
      expect(getCallStatus(state, CALL_ID, now + 3 * 3600000).state).toBe('expired');
    });

    it('should not show historical calls in active calls list', () => {
      const yesterday = Date.now() - 24 * 60 * 60 * 1000;
      const now = Date.now();

      let state = createCallState();

      // Active call now
      state = assertCallActive(state, 'active-call', ALICE, now);

      // Ghost call from yesterday
      state = assertCallActive(state, 'ghost-call', ALICE, yesterday);

      const activeCalls = getActiveCalls(state, now);
      expect(activeCalls.length).toBe(1);
      expect(activeCalls[0].callId).toBe('active-call');
    });
  });

  describe('LWW-Register Semantics', () => {
    it('should use latest assertion per participant', () => {
      const now = 1000000;

      let state = createCallState();

      // Alice starts call
      state = assertCallActive(state, CALL_ID, ALICE, now);

      // Alice ends call later
      state = assertCallEnded(state, CALL_ID, ALICE, now + 10000);

      // Alice rejoins even later
      state = assertCallActive(state, CALL_ID, ALICE, now + 20000);

      const status = getCallStatus(state, CALL_ID, now + 20000);
      expect(status.state).toBe('ringing'); // Alice rejoined
    });

    it('should merge conflicting states correctly', () => {
      const now = 1000000;

      // Alice's view: call is active
      let aliceState = createCallState();
      aliceState = assertCallActive(aliceState, CALL_ID, ALICE, now);

      // Bob's view: call is ended (he left)
      let bobState = createCallState();
      bobState = assertCallActive(bobState, CALL_ID, BOB, now); // Joined
      bobState = assertCallEnded(bobState, CALL_ID, BOB, now + 5000); // Left

      // Merge
      const merged = mergeCallStates(aliceState, bobState, now + 5000);
      const status = getCallStatus(merged, CALL_ID, now + 5000);

      // Alice is still active, Bob has ended
      expect(status.activeCount).toBe(1);
      expect(status.endedCount).toBe(1);
      expect(status.state).toBe('ringing'); // Only Alice active
    });
  });

  describe('Participant Management', () => {
    it('should add participant to call', () => {
      const now = 1000000;

      let state = createCallState();
      state = assertCallActive(state, CALL_ID, ALICE, now);
      state = addParticipantToCall(state, CALL_ID, BOB, now);
      state = addParticipantToCall(state, CALL_ID, CHARLIE, now);

      const status = getCallStatus(state, CALL_ID, now);
      expect(status.participants.length).toBe(3);
      expect(status.state).toBe('active');
    });

    it('should remove participant from call', () => {
      const now = 1000000;

      let state = createCallState();
      state = assertCallActive(state, CALL_ID, ALICE, now);
      state = assertCallActive(state, CALL_ID, BOB, now);
      state = removeParticipantFromCall(state, CALL_ID, BOB, now);

      const status = getCallStatus(state, CALL_ID, now);
      expect(status.participants).toContain(ALICE);
      expect(status.participants).not.toContain(BOB);
    });

    it('should end call when all participants removed', () => {
      const now = 1000000;

      let state = createCallState();
      state = assertCallActive(state, CALL_ID, ALICE, now);
      state = removeParticipantFromCall(state, CALL_ID, ALICE, now);

      // Call should be gone from state
      expect(getCallStatus(state, CALL_ID, now).state).toBe('idle');
    });
  });

  describe('Querying', () => {
    it('should check if has active call with participant', () => {
      const now = 1000000;

      let state = createCallState();
      state = assertCallActive(state, CALL_ID, ALICE, now);
      state = assertCallActive(state, CALL_ID, BOB, now);

      expect(hasActiveCallWithParticipant(state, BOB, now)).toBe(true);
      expect(hasActiveCallWithParticipant(state, CHARLIE, now)).toBe(false);
    });

    it('should get all active calls', () => {
      const now = 1000000;

      let state = createCallState();
      state = assertCallActive(state, 'call-1', ALICE, now);
      state = assertCallActive(state, 'call-2', BOB, now);
      state = assertCallActive(state, 'call-3', CHARLIE, now - 24 * 60 * 60 * 1000); // Expired

      const active = getActiveCalls(state, now);
      expect(active.length).toBe(2); // Only call-1 and call-2
    });
  });

  describe('Cleanup', () => {
    it('should cleanup expired calls', () => {
      const now = 1000000;
      const ttl = 3600000; // 1 hour

      let state = createCallState(ttl);
      state = assertCallActive(state, 'active-call', ALICE, now);
      state = assertCallActive(state, 'expired-call', BOB, now - 2 * ttl); // Expired

      state = cleanupExpiredCalls(state, now);

      expect(getCallStatus(state, 'active-call', now).state).toBe('ringing');
      expect(getCallStatus(state, 'expired-call', now).state).toBe('idle');
    });

    it('should cleanup ended calls after TTL', () => {
      const now = 1000000;
      const ttl = 3600000;

      let state = createCallState(ttl);
      state = assertCallActive(state, CALL_ID, ALICE, now - 2 * ttl);
      state = assertCallEnded(state, CALL_ID, ALICE, now - 1.5 * ttl);

      state = cleanupExpiredCalls(state, now);

      expect(getCallStatus(state, CALL_ID, now).state).toBe('idle');
    });
  });

  describe('Diagnostics', () => {
    it('should provide call diagnostics', () => {
      const now = 1000000;
      const ttl = DEFAULT_CALL_TTL_MS;

      let state = createCallState();
      state = assertCallActive(state, 'active-1', ALICE, now);
      state = assertCallActive(state, 'active-2', BOB, now);
      state = assertCallActive(state, 'ended', CHARLIE, now - 2 * ttl);
      state = assertCallEnded(state, 'ended', CHARLIE, now - 1.5 * ttl);

      const diag = getCallDiagnostics(state, now);
      expect(diag.totalCalls).toBe(3);
      expect(diag.activeCalls).toBe(2);
      expect(diag.endedCalls).toBe(0);
      expect(diag.expiredCalls).toBe(1);
      expect(diag.totalParticipants).toBe(3);
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle ghost call scenario: old signal events dont resurrect call', () => {
      // This is the exact bug we're fixing
      const yesterday = Date.now() - 24 * 60 * 60 * 1000;
      const now = Date.now();

      let state = createCallState();

      // Simulate: Yesterday's call events in message history
      state = assertCallActive(state, 'historical-call', ALICE, yesterday);
      state = assertCallActive(state, 'historical-call', BOB, yesterday);

      // User opens app today
      // Ghost call would appear if we just replayed events
      const status = getCallStatus(state, 'historical-call', now);

      // Should be expired, not ringing/active.
      expect(status.state).toBe('expired');
      expect(status.isExpired).toBe(true);
    });

    it('should handle missed "end call" event', () => {
      // If "end call" event is lost, TTL should still expire the call
      const now = 1000000;
      const ttl = 3600000; // 1 hour

      let state = createCallState(ttl);

      // Call started, but "ended" event never arrived
      state = assertCallActive(state, CALL_ID, ALICE, now);
      state = assertCallActive(state, CALL_ID, BOB, now);

      // After TTL passes without "end" event
      const later = now + ttl + 1000;
      const status = getCallStatus(state, CALL_ID, later);

      // Should auto-expire when no end event arrives.
      expect(status.state).toBe('expired');
      expect(status.isExpired).toBe(true);
    });

    it('should handle concurrent join from both sides', () => {
      const now = 1000000;

      // Alice and Bob both try to join "same" call concurrently
      let aliceState = createCallState();
      aliceState = assertCallActive(aliceState, CALL_ID, ALICE, now);

      let bobState = createCallState();
      bobState = assertCallActive(bobState, CALL_ID, BOB, now);

      // Merge their states
      const merged = mergeCallStates(aliceState, bobState, now);
      const status = getCallStatus(merged, CALL_ID, now);

      // Both should see each other as active
      expect(status.activeCount).toBe(2);
      expect(status.state).toBe('active');
    });
  });
});
