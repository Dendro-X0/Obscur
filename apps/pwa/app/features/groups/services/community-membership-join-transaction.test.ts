import { describe, expect, it, vi } from "vitest";
import { isManagedWorkspaceJoinSuccessful } from "./community-membership-join-transaction";
import type { WorkspaceMembershipActivationResult } from "./community-workspace-activation";

vi.mock("./community-dev-flags", () => ({
  isCoordinationOnlyWorkspaceDevMode: vi.fn(() => false),
}));

const activationBase = (
  overrides: Partial<WorkspaceMembershipActivationResult> = {},
): WorkspaceMembershipActivationResult => ({
  relay: {
    status: "synced",
    canonicalUrl: "ws://localhost:7000",
    publishTargets: ["ws://localhost:7000"],
  },
  coordination: { status: "synced" },
  summary: {
    severity: "success",
    title: "Joined",
    recovery: [],
  },
  ...overrides,
});

describe("isManagedWorkspaceJoinSuccessful (R4)", () => {
  it("requires relay publish when coordination does not confirm the actor", () => {
    const activation = activationBase({
      relay: {
        status: "failed",
        canonicalUrl: "ws://localhost:7000",
        publishTargets: [],
        lastError: "no_writable_relay_targets",
      },
      summary: {
        severity: "partial",
        title: "Joined locally",
        recovery: ["configure_relays"],
      },
    });
    expect(isManagedWorkspaceJoinSuccessful({
      roomKeyPresent: true,
      coordinationSynced: false,
      coordinationActorActive: false,
      activation,
    })).toBe(false);
  });

  it("allows join when coordination confirms even if relay publish failed", () => {
    const activation = activationBase({
      relay: {
        status: "failed",
        canonicalUrl: "ws://localhost:7000",
        publishTargets: [],
        lastError: "relay_events_missing",
      },
      coordination: { status: "failed", lastError: "already_active" },
      summary: {
        severity: "partial",
        title: "Join recorded locally; network sync incomplete",
        recovery: ["configure_relays"],
      },
    });
    expect(isManagedWorkspaceJoinSuccessful({
      roomKeyPresent: true,
      coordinationSynced: false,
      coordinationActorActive: true,
      activation,
    })).toBe(true);
  });

  it("allows coordination-only dev profile without relay sync", async () => {
    const { isCoordinationOnlyWorkspaceDevMode } = await import("./community-dev-flags");
    vi.mocked(isCoordinationOnlyWorkspaceDevMode).mockReturnValue(true);

    const activation = activationBase({
      relay: {
        status: "skipped",
        canonicalUrl: "ws://localhost:7000",
        publishTargets: [],
      },
      summary: {
        severity: "success",
        title: "Joined",
        recovery: [],
      },
    });
    expect(isManagedWorkspaceJoinSuccessful({
      roomKeyPresent: true,
      coordinationSynced: true,
      coordinationActorActive: false,
      activation,
    })).toBe(true);
  });
});
