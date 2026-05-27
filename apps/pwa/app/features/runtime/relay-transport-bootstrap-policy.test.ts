import { afterEach, describe, expect, it, vi } from "vitest";
import {
  RELAY_RUNTIME_REFRESH_MIN_INTERVAL_MS,
  RELAY_TRANSPORT_BOOTSTRAP_DELAY_MS,
} from "./relay-transport-bootstrap-policy";

describe("relay-transport-bootstrap-policy", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("defines a post-shell relay bootstrap delay", () => {
    expect(RELAY_TRANSPORT_BOOTSTRAP_DELAY_MS).toBeGreaterThanOrEqual(1_000);
  });

  it("defines a minimum runtime refresh interval", () => {
    expect(RELAY_RUNTIME_REFRESH_MIN_INTERVAL_MS).toBeGreaterThanOrEqual(500);
  });
});
