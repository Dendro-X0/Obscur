import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * C2 exit contract — MatrixAdapter registered; no dual-write to Nostr.
 */
describe("protocol adaptation Matrix C2", () => {
  const dir = __dirname;
  const read = (name: string) => readFileSync(path.join(dir, name), "utf8");
  const pwaApp = path.resolve(dir, "../..");

  it("registers MatrixAdapter in the façade registry", () => {
    const layer = read("layer.ts");
    expect(layer).toContain('["matrix", matrixAdapter]');
    expect(layer).toContain("SELECTABLE_PROTOCOL_IDS");
    expect(layer).toContain('readActiveProtocolId() === "matrix"');
    expect(layer).toContain("getRichListAdapter");
  });

  it("Matrix adapter uses CS client only (no Nostr send/list)", () => {
    const adapter = read("matrix-adapter.ts");
    expect(adapter).toContain("matrixSyncRooms");
    expect(adapter).toContain("matrixSendRoomText");
    expect(adapter).not.toContain("dm-send-pipeline");
    expect(adapter).not.toContain("loadDmKernelSidebar");
    expect(adapter).not.toContain("loadDmKernelThread");
  });

  it("thin CS client talks to Matrix Client-Server API", () => {
    const client = read("matrix-cs-client.ts");
    expect(client).toContain("/_matrix/client/v3/login");
    expect(client).toContain("/_matrix/client/v3/account/whoami");
    expect(client).toContain("/_matrix/client/v3/sync");
    expect(client).toContain("m.room.message");
    expect(client).toContain("fetch only");
    expect(client).toContain("matrixWhoami");
  });

  it("adapter exports access-token login beside password", () => {
    const adapter = read("matrix-adapter.ts");
    expect(adapter).toContain("matrixLoginAccessToken");
    expect(adapter).toContain("loginAccessToken");
    expect(adapter).toContain("matrixWhoami");
  });

  it("Settings Protocols exposes Matrix login + switch", () => {
    const panel = readFileSync(
      path.join(pwaApp, "settings/panels/protocols-settings-tab-panel.tsx"),
      "utf8",
    );
    expect(panel).toContain("matrixLogin");
    expect(panel).toContain("matrixLoginAccessToken");
    expect(panel).toContain("SELECTABLE_PROTOCOL_IDS");
    expect(panel).toContain("protocol-option-");
    expect(panel).toContain('data-testid="matrix-login"');
    expect(panel).toContain('data-testid="matrix-access-token"');
    expect(panel).toContain('data-testid="matrix-token-login-submit"');
  });

  it("does not bridge Matrix sends into Nostr publish", () => {
    const layer = read("layer.ts");
    expect(layer).toContain("matrixAdapter.sendMessage");
    // Matrix branch must not call nostr pipeline
    const matrixBranch = layer.slice(
      layer.indexOf('readActiveProtocolId() === "matrix"'),
      layer.indexOf("return nostrAdapter.sendDm"),
    );
    expect(matrixBranch).not.toContain("nostrAdapter.sendDm");
    expect(matrixBranch).not.toContain("sendDmPipeline");
  });
});
