import { describe, expect, it } from "vitest";
import { evaluateMembershipDeltaAcl } from "./membership-delta-acl";

const STEWARD = "aa".repeat(32);
const MEMBER = "bb".repeat(32);
const INTRUDER = "cc".repeat(32);

describe("evaluateMembershipDeltaAcl", () => {
  it("allows bootstrap self-join when community has no deltas", () => {
    const decision = evaluateMembershipDeltaAcl({
      existingDeltas: [],
      delta: {
        action: "join",
        subjectPubkey: STEWARD,
        actorPubkey: STEWARD,
        createdAtUnixMs: 1,
        signature: "sig",
      },
    });
    expect(decision).toEqual({ allowed: true });
  });

  it("allows second member self-join", () => {
    const decision = evaluateMembershipDeltaAcl({
      existingDeltas: [{
        seq: 1,
        action: "join",
        subjectPubkey: STEWARD,
        actorPubkey: STEWARD,
      }],
      delta: {
        action: "join",
        subjectPubkey: MEMBER,
        actorPubkey: MEMBER,
        createdAtUnixMs: 2,
        signature: "sig",
      },
    });
    expect(decision).toEqual({ allowed: true });
  });

  it("rejects third-party join attestation", () => {
    const decision = evaluateMembershipDeltaAcl({
      existingDeltas: [{
        seq: 1,
        action: "join",
        subjectPubkey: STEWARD,
        actorPubkey: STEWARD,
      }],
      delta: {
        action: "join",
        subjectPubkey: MEMBER,
        actorPubkey: INTRUDER,
        createdAtUnixMs: 2,
        signature: "sig",
      },
    });
    expect(decision).toEqual({ allowed: false, error: "join_requires_self_attestation" });
  });

  it("allows self leave and rejects steward leave on behalf of member", () => {
    const existing = [
      { seq: 1, action: "join" as const, subjectPubkey: STEWARD, actorPubkey: STEWARD },
      { seq: 2, action: "join" as const, subjectPubkey: MEMBER, actorPubkey: MEMBER },
    ];
    expect(evaluateMembershipDeltaAcl({
      existingDeltas: existing,
      delta: {
        action: "leave",
        subjectPubkey: MEMBER,
        actorPubkey: MEMBER,
        createdAtUnixMs: 3,
        signature: "sig",
      },
    })).toEqual({ allowed: true });

    expect(evaluateMembershipDeltaAcl({
      existingDeltas: existing,
      delta: {
        action: "leave",
        subjectPubkey: MEMBER,
        actorPubkey: STEWARD,
        createdAtUnixMs: 3,
        signature: "sig",
      },
    })).toEqual({ allowed: false, error: "leave_requires_self_attestation" });
  });

  it("allows bootstrap steward expel and rejects non-steward expel", () => {
    const existing = [
      { seq: 1, action: "join" as const, subjectPubkey: STEWARD, actorPubkey: STEWARD },
      { seq: 2, action: "join" as const, subjectPubkey: MEMBER, actorPubkey: MEMBER },
    ];
    expect(evaluateMembershipDeltaAcl({
      existingDeltas: existing,
      delta: {
        action: "expel",
        subjectPubkey: MEMBER,
        actorPubkey: STEWARD,
        createdAtUnixMs: 4,
        signature: "sig",
      },
    })).toEqual({ allowed: true });

    expect(evaluateMembershipDeltaAcl({
      existingDeltas: existing,
      delta: {
        action: "expel",
        subjectPubkey: STEWARD,
        actorPubkey: MEMBER,
        createdAtUnixMs: 4,
        signature: "sig",
      },
    })).toEqual({ allowed: false, error: "expel_requires_bootstrap_steward" });
  });
});
