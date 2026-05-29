import { describe, expect, it } from "vitest";

import {
  expandWorkspaceRelayUrlCandidates,
  isLocalWorkspaceRelayHost,
  normalizeWorkspaceRelayUrl,
  resolveMatchingOpenRelayUrl,
  workspaceRelayUrlsMatch,
} from "./workspace-relay-url";

describe("workspace relay url", () => {
  it("uses ws:// for localhost hosts without a scheme", () => {
    expect(normalizeWorkspaceRelayUrl("localhost:7000")).toBe("ws://localhost:7000");
    expect(normalizeWorkspaceRelayUrl("127.0.0.1:7000")).toBe("ws://127.0.0.1:7000");
  });

  it("fixes mistaken wss://localhost to ws://", () => {
    expect(normalizeWorkspaceRelayUrl("wss://localhost:7000")).toBe("ws://localhost:7000");
  });

  it("uses wss:// for public relay hosts", () => {
    expect(normalizeWorkspaceRelayUrl("relay.team.example")).toBe("wss://relay.team.example");
    expect(normalizeWorkspaceRelayUrl("wss://relay.team.example")).toBe("wss://relay.team.example");
  });

  it("treats ws and wss localhost variants as equivalent", () => {
    expect(workspaceRelayUrlsMatch("wss://localhost:7000", "ws://localhost:7000")).toBe(true);
  });

  it("treats localhost and 127.0.0.1 on the same port as equivalent", () => {
    expect(workspaceRelayUrlsMatch("ws://localhost:7000", "ws://127.0.0.1:7000")).toBe(true);
  });

  it("detects local workspace hosts", () => {
    expect(isLocalWorkspaceRelayHost("localhost:7000")).toBe(true);
    expect(isLocalWorkspaceRelayHost("wss://relay.damus.io")).toBe(false);
  });

  it("expands local relay aliases into probe candidates", () => {
    const candidates = expandWorkspaceRelayUrlCandidates("wss://localhost:7000");
    expect(candidates).toContain("ws://localhost:7000");
    expect(candidates).toContain("ws://127.0.0.1:7000");
    expect(candidates.every((candidate) => /^wss?:\/\//.test(candidate))).toBe(true);
  });

  it("resolves localhost and 127.0.0.1 open relay aliases", () => {
    expect(resolveMatchingOpenRelayUrl(
      "ws://localhost:7000",
      ["ws://127.0.0.1:7000"],
    )).toBe("ws://127.0.0.1:7000");
  });
});
