import { describe, expect, it } from "vitest";
import fc from "fast-check";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  createCommunityLedgerState,
  reduceCommunityLedger,
  selectActiveMembers,
  selectExpelledMembers,
  selectLeftMembers,
  selectMembershipStatus,
  type CommunityLedgerEvent,
  type CommunityLedgerState
} from "./community-ledger-reducer";

const PK_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as PublicKeyHex;
const PK_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as PublicKeyHex;

const applyEvents = (initial: CommunityLedgerState, events: ReadonlyArray<CommunityLedgerEvent>): CommunityLedgerState => {
  return events.reduce((state, event) => reduceCommunityLedger(state, event), initial);
};

describe("community-ledger-reducer", () => {
  it("keeps latest status by timestamp and ignores stale lifecycle events", () => {
    const initial = createCommunityLedgerState();
    const state = applyEvents(initial, [
      { type: "MEMBER_JOINED", pubkey: PK_A, timestamp: 20 },
      { type: "MEMBER_LEFT", pubkey: PK_A, timestamp: 30 },
      { type: "MEMBER_JOINED", pubkey: PK_A, timestamp: 10 }
    ]);

    expect(selectActiveMembers(state)).toEqual([]);
    expect(selectLeftMembers(state)).toEqual([PK_A]);
    expect(selectMembershipStatus(state, PK_A)).toBe("not_member");
  });

  it("is idempotent for duplicate events", () => {
    const initial = createCommunityLedgerState();
    const event: CommunityLedgerEvent = { type: "MEMBER_JOINED", pubkey: PK_A, timestamp: 100 };
    const once = reduceCommunityLedger(initial, event);
    const twice = reduceCommunityLedger(once, event);

    expect(twice).toEqual(once);
    expect(selectActiveMembers(twice)).toEqual([PK_A]);
  });

  it("treats disband as terminal and blocks later membership transitions", () => {
    const initial = createCommunityLedgerState([PK_A, PK_B]);
    const state = applyEvents(initial, [
      { type: "COMMUNITY_DISBANDED", timestamp: 1000 },
      { type: "MEMBER_JOINED", pubkey: PK_A, timestamp: 5000 },
      { type: "MEMBER_LEFT", pubkey: PK_B, timestamp: 6000 }
    ]);

    expect(state.disbandedAt).toBe(1000);
    expect(selectActiveMembers(state)).toEqual([]);
    expect(selectMembershipStatus(state, PK_A)).toBe("not_member");
    expect(selectMembershipStatus(state, PK_B)).toBe("not_member");
  });

  it("handles expel transitions and selector projections", () => {
    const initial = createCommunityLedgerState([PK_A, PK_B]);
    const state = applyEvents(initial, [
      { type: "MEMBER_EXPELLED", pubkey: PK_B, timestamp: 120 }
    ]);

    expect(selectActiveMembers(state)).toEqual([PK_A]);
    expect(selectExpelledMembers(state)).toEqual([PK_B]);
    expect(selectMembershipStatus(state, PK_B)).toBe("not_member");
  });

  it("converges to the same final state under event reordering", () => {
    const events: CommunityLedgerEvent[] = [
      { type: "MEMBER_JOINED", pubkey: PK_A, timestamp: 10 },
      { type: "MEMBER_LEFT", pubkey: PK_A, timestamp: 30 },
      { type: "MEMBER_JOINED", pubkey: PK_B, timestamp: 20 },
      { type: "MEMBER_EXPELLED", pubkey: PK_B, timestamp: 40 }
    ];

    const expected = applyEvents(createCommunityLedgerState(), [...events].sort((a, b) => a.timestamp - b.timestamp));
    const reordered = applyEvents(createCommunityLedgerState(), [events[2], events[0], events[3], events[1]]);

    expect(reordered).toEqual(expected);
  });

  it("property: last timestamp wins for join/leave stream of one member", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            ts: fc.integer({ min: 1, max: 5000 }),
            kind: fc.constantFrom<"MEMBER_JOINED" | "MEMBER_LEFT">("MEMBER_JOINED", "MEMBER_LEFT")
          }),
          { minLength: 1, maxLength: 40 }
        ),
        (steps) => {
          const events: CommunityLedgerEvent[] = steps.map((s) => ({ type: s.kind, pubkey: PK_A, timestamp: s.ts }));
          const state = applyEvents(createCommunityLedgerState(), events);

          const maxTimestamp = steps.reduce((max, step) => Math.max(max, step.ts), 0);
          const latestAtMaxTs = steps.filter((step) => step.ts === maxTimestamp);
          const latest = latestAtMaxTs[latestAtMaxTs.length - 1];
          if (!latest) return;

          const active = selectActiveMembers(state).includes(PK_A);
          if (latest.kind === "MEMBER_JOINED") {
            expect(active).toBe(true);
            expect(selectMembershipStatus(state, PK_A)).toBe("member");
          } else {
            expect(active).toBe(false);
            expect(selectMembershipStatus(state, PK_A)).toBe("not_member");
          }
        }
      )
    );
  });
});
