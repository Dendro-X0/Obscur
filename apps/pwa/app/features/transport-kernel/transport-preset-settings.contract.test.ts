import { describe, expect, it } from "vitest";
import { RELAY_PRESETS } from "@/app/settings/settings-tab-panel-shared";
import {
  DEFAULT_STABLE_PRESET,
  TRANSPORT_PRESET_CATALOG,
  buildRelayRowsFromPreset,
  getTransportPreset,
} from "./transport-preset-catalog";

describe("transport-preset-catalog settings wiring", () => {
  it("settings re-exports the same catalog as transport-kernel owner", () => {
    expect(RELAY_PRESETS).toBe(TRANSPORT_PRESET_CATALOG);
  });

  it("E1: apply inputs — public redundancy pack yields rows + redundancy mode", () => {
    const preset = getTransportPreset("default_stable") ?? DEFAULT_STABLE_PRESET;
    const rows = buildRelayRowsFromPreset(preset);
    expect(preset.transportMode).toBe("redundancy");
    expect(rows.map((row) => row.url)).toEqual([
      "wss://nos.lol",
      "wss://relay.primal.net",
      "wss://relay.damus.io",
    ]);
    expect(rows.every((row) => row.enabled)).toBe(true);
  });
});
