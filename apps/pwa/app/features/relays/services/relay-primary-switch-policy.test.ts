import { describe, expect, it } from "vitest";

import {
  isEmergencyRelayPrimarySwitch,
  RELAY_PRIMARY_SWITCH_MIN_INTERVAL_MS,
  shouldAllowRelayPrimarySwitch,
} from "./relay-primary-switch-policy";

describe("relay-primary-switch-policy", () => {
  it("allows emergency switch when primary is circuit-open", () => {
    expect(isEmergencyRelayPrimarySwitch("wss://nos.lol", [
      { url: "wss://nos.lol", isOpen: false, isCircuitOpen: true },
    ])).toBe(true);
  });

  it("blocks rapid non-emergency switches inside cooldown window", () => {
    const now = 10_000;
    expect(shouldAllowRelayPrimarySwitch({
      nowUnixMs: now,
      lastSwitchAtUnixMs: now - 500,
      emergency: false,
    })).toBe(false);
    expect(shouldAllowRelayPrimarySwitch({
      nowUnixMs: now,
      lastSwitchAtUnixMs: now - RELAY_PRIMARY_SWITCH_MIN_INTERVAL_MS,
      emergency: false,
    })).toBe(true);
  });

  it("always allows emergency switches regardless of cooldown", () => {
    expect(shouldAllowRelayPrimarySwitch({
      nowUnixMs: 10_000,
      lastSwitchAtUnixMs: 9_999,
      emergency: true,
    })).toBe(true);
  });
});
