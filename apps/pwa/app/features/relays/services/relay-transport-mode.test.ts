import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readRelayTransportMode, writeRelayTransportMode } from "./relay-transport-mode";

describe("relay transport mode", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("persists redundancy mode per profile scope", () => {
    writeRelayTransportMode("redundancy", "profile-a");
    expect(readRelayTransportMode("profile-a")).toBe("redundancy");
    expect(readRelayTransportMode("profile-b")).toBe("basic");
  });
});
