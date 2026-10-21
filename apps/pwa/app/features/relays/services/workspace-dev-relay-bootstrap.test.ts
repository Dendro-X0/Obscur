import { beforeEach, describe, expect, it, vi } from "vitest";

const readOperatorWorkspaceRelayUrlMock = vi.hoisted(() => vi.fn((): string | null => null));

vi.mock("@/app/features/groups/services/operator-trust-config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/app/features/groups/services/operator-trust-config")>();
  return {
    ...actual,
    readOperatorWorkspaceRelayUrl: () => readOperatorWorkspaceRelayUrlMock(),
    writeOperatorWorkspaceRelayUrl: vi.fn(),
  };
});

import {
  applyWorkspaceDevRelayBootstrap,
  hasEnabledNonLocalRelay,
  pruneUnreachableLocalDevWorkspaceRelay,
  reconcileLocalDevWorkspaceRelay,
} from "./workspace-dev-relay-bootstrap";

describe("workspace-dev-relay-bootstrap", () => {
  beforeEach(() => {
    readOperatorWorkspaceRelayUrlMock.mockReturnValue(null);
  });

  it("detects enabled public remotes beside localhost", () => {
    expect(hasEnabledNonLocalRelay([
      { url: "wss://nos.lol", enabled: true },
      { url: "ws://localhost:7000", enabled: false },
    ])).toBe(true);
    expect(hasEnabledNonLocalRelay([
      { url: "ws://localhost:7000", enabled: true },
    ])).toBe(false);
    expect(hasEnabledNonLocalRelay([
      { url: "http://127.0.0.1:8788", enabled: true },
    ])).toBe(false);
  });

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

  it("disables enabled localhost relay when dev stack is offline", () => {
    const result = pruneUnreachableLocalDevWorkspaceRelay([
      { url: "wss://relay.damus.io", enabled: true },
      { url: "ws://localhost:7000", enabled: true },
    ]);

    expect(result?.changed).toBe(true);
    expect(result?.relays).toEqual([
      { url: "wss://relay.damus.io", enabled: true },
      { url: "ws://localhost:7000", enabled: false },
    ]);
  });

  it("keeps operator Team workspace relay enabled when public remotes are on", async () => {
    readOperatorWorkspaceRelayUrlMock.mockReturnValue("ws://localhost:7000");
    const result = await reconcileLocalDevWorkspaceRelay({
      relays: [
        { url: "wss://relay.damus.io", enabled: true },
        { url: "ws://localhost:7000", enabled: true },
        { url: "http://127.0.0.1:8788", enabled: true },
      ],
    });

    expect(result?.changed).toBe(true);
    expect(result?.relays).toEqual([
      { url: "wss://relay.damus.io", enabled: true },
      { url: "ws://localhost:7000", enabled: true },
      { url: "http://127.0.0.1:8788", enabled: false },
    ]);
  });
});
