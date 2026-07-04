import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildTransportPublishRelayEventRequest } from "@obscur/engine-contracts";
import { resolveTauriEngineInvokeCommand } from "@obscur/engine-host";

describe("transport-engine w46 — host async publish routing harness", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("resolves async desktop command when network lab env is enabled", () => {
    vi.stubEnv("NEXT_PUBLIC_OBSCUR_TRANSPORT_HOST_PUBLISH_NETWORK", "1");

    const request = buildTransportPublishRelayEventRequest({
      profileId: "default",
      windowLabel: "main",
      payload: {
        relayUrls: ["wss://relay.one"],
        payload: "[\"EVENT\",{\"id\":\"e1\"}]",
        correlationId: "corr-w46",
      },
    });

    expect(resolveTauriEngineInvokeCommand(request)).toBe(
      "engine_invoke_transport_publish_relay_event",
    );
  });

  it("resolves sync engine_invoke when network lab env is off", () => {
    const request = buildTransportPublishRelayEventRequest({
      profileId: "default",
      payload: {
        relayUrls: ["wss://relay.one"],
        payload: "[\"EVENT\",{\"id\":\"e1\"}]",
      },
    });

    expect(resolveTauriEngineInvokeCommand(request)).toBe("engine_invoke");
  });

  it("keeps non-publish transport invokes on sync engine_invoke when network env is on", () => {
    vi.stubEnv("NEXT_PUBLIC_OBSCUR_TRANSPORT_HOST_PUBLISH_NETWORK", "1");

    const request = {
      engine: "transport" as const,
      method: "listRelayCheckpoints",
      scope: { profileId: "default", windowLabel: "main" },
    };

    expect(resolveTauriEngineInvokeCommand(request)).toBe("engine_invoke");
  });
});
