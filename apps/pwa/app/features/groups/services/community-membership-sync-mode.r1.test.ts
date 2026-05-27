import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./community-dev-flags", () => ({
  isWorkspaceR1MembershipEnforced: vi.fn(() => true),
}));

import { isWorkspaceR1MembershipEnforced } from "./community-dev-flags";
import {
  readMembershipSyncMode,
  writeMembershipSyncMode,
} from "./community-membership-sync-mode";

describe("community-membership-sync-mode R1", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_COORDINATION_URL", "http://127.0.0.1:8787");
    vi.mocked(isWorkspaceR1MembershipEnforced).mockReturnValue(true);
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    window.localStorage.clear();
  });

  it("forces coordination_preferred when coordination is configured and R1 enforced", () => {
    window.localStorage.setItem("obscur.membership_sync_mode.v1", "nostr_only");
    expect(readMembershipSyncMode()).toBe("coordination_preferred");
  });

  it("writeMembershipSyncMode ignores nostr_only when R1 enforced", () => {
    writeMembershipSyncMode("nostr_only");
    expect(window.localStorage.getItem("obscur.membership_sync_mode.v1")).toBeNull();
    writeMembershipSyncMode("coordination_preferred");
    expect(window.localStorage.getItem("obscur.membership_sync_mode.v1")).toBe(
      "coordination_preferred",
    );
  });
});
