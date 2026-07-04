import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  isTransportHostPublishNetworkEnvEnabled,
  shouldRouteTransportPublishToAsyncDesktopCommand,
} from "@obscur/engine-host";
import { buildTransportPublishRelayEventRequest } from "@obscur/engine-contracts";

const REPO_ROOT = join(__dirname, "../../../../");

const readFromRepo = (relFromRepoRoot: string): string => (
  readFileSync(join(REPO_ROOT, relFromRepoRoot), "utf8")
);

describe("transport-engine w46 — TS host async publish routing", () => {
  it("pins async publish routing charter", () => {
    const charter = readFromRepo(
      "docs/program/transport-engine-w46-ts-host-async-publish-routing-charter.md",
    );
    expect(charter).toContain("TS Host Async Publish Routing Charter");
    expect(charter).toContain("engine_invoke_transport_publish_relay_event");
    expect(charter).toContain("NEXT_PUBLIC_OBSCUR_TRANSPORT_HOST_PUBLISH_NETWORK");
  });

  it("routes publishRelayEvent to async desktop command when network env is on", () => {
    const host = readFromRepo("packages/obscur-engine-host/src/tauri-engine-host.ts");
    expect(host).toContain("resolveTauriEngineInvokeCommand");
    expect(host).toContain("engine_invoke_transport_publish_relay_event");
    expect(host).toContain('"engine_invoke"');
  });

  it("keeps network routing off by default in tests", () => {
    expect(isTransportHostPublishNetworkEnvEnabled()).toBe(false);
    const request = buildTransportPublishRelayEventRequest({
      profileId: "default",
      payload: {
        relayUrls: ["wss://relay.one"],
        payload: "[\"EVENT\",{\"id\":\"e1\"}]",
      },
    });
    expect(shouldRouteTransportPublishToAsyncDesktopCommand(request)).toBe(false);
  });
});
