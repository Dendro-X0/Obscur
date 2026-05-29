import { describe, expect, it } from "vitest";
import {
  createWorkspaceActivationPublisher,
  resolveWorkspaceActivationPublishTargets,
  summarizeWorkspaceActivation,
} from "./community-workspace-activation";
import { workspaceRelayUrlsMatch } from "./workspace-relay-url";

describe("community-workspace-activation", () => {
  it("resolveWorkspaceActivationPublishTargets returns one writable alias", () => {
    const targets = resolveWorkspaceActivationPublishTargets({
      canonicalUrl: "ws://localhost:7000",
      pool: {
        getWritableRelaySnapshot: () => ({
          atUnixMs: Date.now(),
          configuredRelayUrls: ["ws://127.0.0.1:7000"],
          writableRelayUrls: ["ws://127.0.0.1:7000"],
          totalRelayCount: 1,
          openRelayCount: 1,
          relayCircuitStates: {},
        }),
      },
      openRelayUrls: ["ws://127.0.0.1:7000", "ws://localhost:7000"],
    });
    expect(targets).toHaveLength(1);
    expect(workspaceRelayUrlsMatch(targets[0]!, "ws://localhost:7000")).toBe(true);
  });

  it("createWorkspaceActivationPublisher succeeds when any alias accepts publish", async () => {
    const publish = createWorkspaceActivationPublisher(
      {
        publishToUrls: async (urls) => ({
          success: urls.some((url) => workspaceRelayUrlsMatch(url, "ws://127.0.0.1:7000")),
        }),
      },
      ["ws://localhost:7000", "ws://127.0.0.1:7000"],
    );
    await expect(publish('["EVENT",{}]')).resolves.toEqual({ success: true });
  });

  it("summarizeWorkspaceActivation returns partial when coordination pending", () => {
    const summary = summarizeWorkspaceActivation({
      relay: {
        status: "synced",
        canonicalUrl: "ws://localhost:7000",
        publishTargets: ["ws://localhost:7000"],
      },
      coordination: {
        status: "pending",
        lastError: "http_502",
      },
      context: "join",
      displayName: "GroupTset 5",
    });
    expect(summary.severity).toBe("partial");
    expect(summary.recovery).toContain("start_coordination");
    expect(summary.detail).toContain("502");
  });

  it("summarizeWorkspaceActivation returns success when both paths synced", () => {
    const summary = summarizeWorkspaceActivation({
      relay: {
        status: "synced",
        canonicalUrl: "ws://localhost:7000",
        publishTargets: ["ws://localhost:7000"],
      },
      coordination: { status: "synced" },
      context: "create",
    });
    expect(summary.severity).toBe("success");
    expect(summary.recovery).toHaveLength(0);
  });
});
