import { describe, expect, it } from "vitest";

import {
  humanizeRelayNodeDetailCode,
  isRelayNodeDetailMachineCode,
  relayNodeDetailCodeI18nKey,
  shouldRenderRelayNodeRoleChip,
} from "./relay-node-detail-copy";

describe("relay-node-detail-copy (TI-4)", () => {
  it("detects machine codes", () => {
    expect(isRelayNodeDetailMachineCode("websocket_error")).toBe(true);
    expect(isRelayNodeDetailMachineCode("This relay is connected.")).toBe(false);
  });

  it("humanizes websocket_error", () => {
    expect(humanizeRelayNodeDetailCode("websocket_error")).toBe(
      "WebSocket connection failed.",
    );
    expect(relayNodeDetailCodeI18nKey("websocket_error")).toBe(
      "settings.relays.node.detail.websocketError",
    );
  });

  it("skips empty role chips", () => {
    expect(shouldRenderRelayNodeRoleChip("")).toBe(false);
    expect(shouldRenderRelayNodeRoleChip("Disabled")).toBe(true);
    expect(shouldRenderRelayNodeRoleChip("Configured")).toBe(true);
  });
});
