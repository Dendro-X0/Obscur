import { describe, expect, it } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  isCommunityParticipantInContacts,
  listCommunityParticipantsNotInContacts,
  summarizeCommunityParticipantContactCoverage,
} from "./community-participant-contact-read-model";

const SELF = "aa".repeat(32) as PublicKeyHex;
const PEER_A = "bb".repeat(32) as PublicKeyHex;
const PEER_B = "cc".repeat(32) as PublicKeyHex;

describe("community-participant-contact-read-model", () => {
  it("treats self as in contacts", () => {
    expect(isCommunityParticipantInContacts(SELF, [], SELF)).toBe(true);
  });

  it("detects accepted peers", () => {
    expect(isCommunityParticipantInContacts(PEER_A, [PEER_A], SELF)).toBe(true);
    expect(isCommunityParticipantInContacts(PEER_B, [PEER_A], SELF)).toBe(false);
  });

  it("lists participants not in contacts excluding self semantics", () => {
    const notInContacts = listCommunityParticipantsNotInContacts(
      [SELF, PEER_A, PEER_B],
      [PEER_A],
      SELF,
    );
    expect(notInContacts).toEqual([PEER_B]);
  });

  it("summarizes coverage for modal copy", () => {
    const summary = summarizeCommunityParticipantContactCoverage(
      [SELF, PEER_A, PEER_B],
      [PEER_A],
      SELF,
    );
    expect(summary.visibleCount).toBe(3);
    expect(summary.notInContactsCount).toBe(1);
    expect(summary.notInContactsPubkeys).toEqual([PEER_B]);
  });
});
