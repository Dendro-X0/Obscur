import { describe, expect, it } from "vitest";
import fc from "fast-check";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import type { CommunityControlEvent } from "@dweb/core/community-control-event-contracts";
import {
  createCommunityLedgerState,
  reduceCommunityLedger,
  selectActiveMembers,
  selectExpelledMembers,
  selectLeftMembers,
  selectMembershipStatus,
  toCommunityLedgerEventFromControlEvent,
  type CommunityLedgerEvent,
  type CommunityLedgerState
} from "./community-ledger-reducer";

const PK_A = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa" as PublicKeyHex;
const PK_B = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb" as PublicKeyHex;

const applyEvents = (initial: CommunityLedgerState, events: ReadonlyArray<CommunityLedgerEvent>): CommunityLedgerState => {
  return events.reduce((state, event) => reduceCommunityLedger(state, event), initial);
};

const createControlEvent = (
  params: Readonly<{
    eventType: CommunityControlEvent["eventType"];
    createdAtUnixMs: number;
    subjectPublicKeyHex?: PublicKeyHex;
  }>
): CommunityControlEvent => {
  const common = {
    communityId: "community-alpha",
    groupId: "group-alpha",
    relayScope: "wss://relay.alpha",
    logicalEventId: `${params.eventType.toLowerCase()}-${params.createdAtUnixMs}`,
    idempotencyKey: `${params.eventType.toLowerCase()}:${params.createdAtUnixMs}`,
    actorPublicKeyHex: PK_A,
    createdAtUnixMs: params.createdAtUnixMs,
    source: "relay_live" as const,
  };
  switch (params.eventType) {
    case "COMMUNITY_MEMBER_JOINED":
      return {
        ...common,
        eventFamily: "membership",
        eventType: "COMMUNITY_MEMBER_JOINED",
        membershipVersion: 1,
        subjectPublicKeyHex: params.subjectPublicKeyHex ?? PK_A,
      };
    case "COMMUNITY_MEMBER_LEFT":
      return {
        ...common,
        eventFamily: "membership",
        eventType: "COMMUNITY_MEMBER_LEFT",
        membershipVersion: 1,
        subjectPublicKeyHex: params.subjectPublicKeyHex ?? PK_A,
      };
    case "COMMUNITY_MEMBER_EXPELLED":
      return {
        ...common,
        eventFamily: "membership",
        eventType: "COMMUNITY_MEMBER_EXPELLED",
        membershipVersion: 1,
        subjectPublicKeyHex: params.subjectPublicKeyHex ?? PK_A,
      };
    case "COMMUNITY_DISBANDED":
      return {
        ...common,
        eventFamily: "terminal_lifecycle",
        eventType: "COMMUNITY_DISBANDED",
        reasonCode: "disbanded",
      };
    default:
      return {
        ...common,
        eventFamily: "descriptor",
        eventType: "COMMUNITY_CREATED",
        descriptorVersion: 1,
        metadata: { displayName: "Alpha" },
      };
  }
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

  it("maps shared control membership events onto reducer events", () => {
    expect(toCommunityLedgerEventFromControlEvent(createControlEvent({
      eventType: "COMMUNITY_MEMBER_JOINED",
      createdAtUnixMs: 10,
      subjectPublicKeyHex: PK_A,
    }))).toEqual({
      type: "MEMBER_JOINED",
      pubkey: PK_A,
      timestamp: 10,
    });

    expect(toCommunityLedgerEventFromControlEvent(createControlEvent({
      eventType: "COMMUNITY_MEMBER_LEFT",
      createdAtUnixMs: 20,
      subjectPublicKeyHex: PK_A,
    }))).toEqual({
      type: "MEMBER_LEFT",
      pubkey: PK_A,
      timestamp: 20,
    });

    expect(toCommunityLedgerEventFromControlEvent(createControlEvent({
      eventType: "COMMUNITY_MEMBER_EXPELLED",
      createdAtUnixMs: 30,
      subjectPublicKeyHex: PK_B,
    }))).toEqual({
      type: "MEMBER_EXPELLED",
      pubkey: PK_B,
      timestamp: 30,
    });

    expect(toCommunityLedgerEventFromControlEvent(createControlEvent({
      eventType: "COMMUNITY_DISBANDED",
      createdAtUnixMs: 40,
    }))).toEqual({
      type: "COMMUNITY_DISBANDED",
      timestamp: 40,
    });
  });

  it("ignores shared control events that are outside the ledger reducer scope", () => {
    expect(toCommunityLedgerEventFromControlEvent(createControlEvent({
      eventType: "COMMUNITY_CREATED",
      createdAtUnixMs: 50,
    }))).toBeNull();
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
