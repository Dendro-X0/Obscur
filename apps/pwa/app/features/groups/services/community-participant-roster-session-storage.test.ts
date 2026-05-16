import { describe, expect, it, beforeEach } from "vitest";
import type { PublicKeyHex } from "@dweb/crypto/public-key-hex";
import {
  loadCommunityParticipantRosterSession,
  saveCommunityParticipantRosterSession,
} from "./community-participant-roster-session-storage";

const PK_A = "a".repeat(64) as PublicKeyHex;
const PK_B = "b".repeat(64) as PublicKeyHex;

describe("community-participant-roster-session-storage", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("persists and reloads widen-only session across page revisits", () => {
    saveCommunityParticipantRosterSession("community:test", "profile-1", [PK_A, PK_B]);
    expect(loadCommunityParticipantRosterSession("community:test", "profile-1")).toEqual([PK_A, PK_B]);
  });
});
