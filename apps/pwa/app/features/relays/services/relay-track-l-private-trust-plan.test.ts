import { describe, expect, it } from "vitest";
import { LOCAL_DEV_WORKSPACE_RELAY_URL } from "./relay-transport-scope";
import { buildTrackLPrivateTrustRelayPlan } from "./relay-track-l-private-trust-plan";

describe("buildTrackLPrivateTrustRelayPlan (Slice C)", () => {
  it("adds and enables local lab when missing, disables publics and invalid schemes", () => {
    const plan = buildTrackLPrivateTrustRelayPlan([
      { url: "wss://nos.lol", enabled: true },
      { url: "wss://relay.damus.io", enabled: true },
      { url: "http://127.0.0.1:8788", enabled: true },
    ]);

    expect(plan.primaryUrl).toBe(LOCAL_DEV_WORKSPACE_RELAY_URL);
    expect(plan.retainLabUrl).toBe(LOCAL_DEV_WORKSPACE_RELAY_URL);
    expect(plan.enabledLocal).toBe(true);
    expect(plan.disabledRemoteCount).toBe(2);
    expect(plan.disabledInvalidCount).toBe(1);
    expect(plan.changed).toBe(true);

    const local = plan.relays.find((row) => row.url === LOCAL_DEV_WORKSPACE_RELAY_URL);
    expect(local?.enabled).toBe(true);
    expect(plan.relays.find((row) => row.url === "wss://nos.lol")?.enabled).toBe(false);
    expect(plan.relays.find((row) => row.url === "http://127.0.0.1:8788")?.enabled).toBe(false);
  });

  it("force-enables existing disabled local lab", () => {
    const plan = buildTrackLPrivateTrustRelayPlan([
      { url: LOCAL_DEV_WORKSPACE_RELAY_URL, enabled: false },
      { url: "wss://relay.primal.net", enabled: true },
    ]);
    expect(plan.relays.find((row) => row.url === LOCAL_DEV_WORKSPACE_RELAY_URL)?.enabled).toBe(true);
    expect(plan.relays.find((row) => row.url === "wss://relay.primal.net")?.enabled).toBe(false);
    expect(plan.changed).toBe(true);
  });

  it("reports unchanged when already in Track L layout", () => {
    const plan = buildTrackLPrivateTrustRelayPlan([
      { url: LOCAL_DEV_WORKSPACE_RELAY_URL, enabled: true },
      { url: "wss://nos.lol", enabled: false },
    ]);
    expect(plan.changed).toBe(false);
    expect(plan.enabledLocal).toBe(true);
    expect(plan.disabledRemoteCount).toBe(1);
  });
});
