import { describe, expect, it } from "vitest";
import {
  applyWorkspaceDevRelayBootstrap,
} from "./workspace-dev-relay-bootstrap";

describe("workspace-dev-relay-bootstrap", () => {
  it("enables an existing disabled localhost relay entry", () => {
    const result = applyWorkspaceDevRelayBootstrap([
      { url: "wss://relay.damus.io", enabled: true },
      { url: "ws://localhost:7000", enabled: false },
    ]);

    expect(result.changed).toBe(true);
    expect(result.workspaceRelayUrl).toBe("ws://localhost:7000");
    expect(result.relays).toEqual([
      { url: "wss://relay.damus.io", enabled: true },
      { url: "ws://localhost:7000", enabled: true },
    ]);
  });

  it("appends localhost relay when missing from the list", () => {
    const result = applyWorkspaceDevRelayBootstrap([
      { url: "wss://relay.damus.io", enabled: true },
    ]);

    expect(result.changed).toBe(true);
    expect(result.relays.at(-1)).toEqual({ url: "ws://localhost:7000", enabled: true });
  });

  it("is a no-op when localhost relay is already enabled", () => {
    const relays = [
      { url: "wss://relay.damus.io", enabled: true },
      { url: "ws://localhost:7000", enabled: true },
    ] as const;

    const result = applyWorkspaceDevRelayBootstrap(relays);

    expect(result.changed).toBe(false);
    expect(result.relays).toEqual(relays);
  });
});
