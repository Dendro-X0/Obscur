import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readRelayTransportMode, writeRelayTransportMode } from "./relay-transport-mode";

describe("relay transport mode", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("defaults to redundancy when unset (prod-first Default Stable)", () => {
    expect(readRelayTransportMode("profile-fresh")).toBe("redundancy");
  });

  it("persists redundancy mode per profile scope", () => {
    writeRelayTransportMode("redundancy", "profile-a");
    writeRelayTransportMode("basic", "profile-b");
    expect(readRelayTransportMode("profile-a")).toBe("redundancy");
    expect(readRelayTransportMode("profile-b")).toBe("basic");
  });
});
