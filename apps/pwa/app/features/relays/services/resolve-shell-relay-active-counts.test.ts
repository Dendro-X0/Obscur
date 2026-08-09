import { describe, expect, it } from "vitest";
import {
  countOpenRelayConnections,
  resolveShellRelayActiveCounts,
} from "./resolve-shell-relay-active-counts";

describe("resolveShellRelayActiveCounts", () => {
  it("counts open sockets only", () => {
    expect(countOpenRelayConnections([
      { status: "open" },
      { status: "closed" },
      { status: "connecting" },
    ])).toBe(1);
  });

  it("uses enabled list when connections are thin", () => {
    expect(resolveShellRelayActiveCounts({
      connections: [{ status: "closed" }],
      enabledRelayUrls: ["wss://nos.lol", "wss://relay.primal.net", "wss://relay.damus.io"],
    })).toEqual({ openCount: 0, totalCount: 3 });
  });

  it("does not invent opens from empty enabled when sockets are open", () => {
    expect(resolveShellRelayActiveCounts({
      connections: [
        { status: "open" },
        { status: "open" },
      ],
      enabledRelayUrls: ["wss://nos.lol"],
    })).toEqual({ openCount: 2, totalCount: 2 });
  });
});
