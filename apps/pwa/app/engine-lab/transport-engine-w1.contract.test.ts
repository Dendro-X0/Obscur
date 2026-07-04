import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  TRANSPORT_ENGINE_METHODS,
  buildTransportListConfiguredRelayUrlsRequest,
  buildTransportListRelayCheckpointsRequest,
  validateEngineInvokeRequest,
} from "@obscur/engine-contracts";

const REPO_ROOT = join(__dirname, "../../../../");

describe("transport-engine w1 — rust persistence + TS SDK", () => {
  it("defines transport listRelayCheckpoints invoke request", () => {
    const request = buildTransportListRelayCheckpointsRequest({ profileId: "default" });
    expect(request.engine).toBe("transport");
    expect(request.method).toBe(TRANSPORT_ENGINE_METHODS.listRelayCheckpoints);
    expect(validateEngineInvokeRequest(request)).toBeNull();
  });

  it("defines transport listConfiguredRelayUrls invoke request", () => {
    const request = buildTransportListConfiguredRelayUrlsRequest({ profileId: "default" });
    expect(request.engine).toBe("transport");
    expect(request.method).toBe(TRANSPORT_ENGINE_METHODS.listConfiguredRelayUrls);
    expect(validateEngineInvokeRequest(request)).toBeNull();
  });

  it("libobscur engine_invoke dispatches transport persistence methods", () => {
    const source = readFileSync(
      join(REPO_ROOT, "packages/libobscur/src/engine_invoke.rs"),
      "utf8",
    );
    expect(source).toContain("dispatch_transport");
    expect(source).toContain("\"listRelayCheckpoints\"");
    expect(source).toContain("\"listConfiguredRelayUrls\"");
  });

  it("transport-engine SDK exports persistence helpers", () => {
    const source = readFileSync(
      join(REPO_ROOT, "packages/obscur-transport-engine/src/index.ts"),
      "utf8",
    );
    expect(source).toContain("listRelayCheckpoints");
    expect(source).toContain("listConfiguredRelayUrls");
    expect(source).not.toMatch(/apps\/pwa/);
  });

  it("transport persistence SDK has no nostr imports", () => {
    const source = readFileSync(
      join(REPO_ROOT, "packages/obscur-transport-engine/src/transport-persistence.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/nostr/i);
    expect(source).not.toMatch(/WebSocket/);
  });
});
