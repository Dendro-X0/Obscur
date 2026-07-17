import { describe, expect, it } from "vitest";
import { RELAY_PRESETS } from "@/app/settings/settings-tab-panel-shared";
import { TRANSPORT_PRESET_CATALOG } from "./transport-preset-catalog";

describe("transport-preset-catalog settings wiring", () => {
  it("settings re-exports the same catalog as transport-kernel owner", () => {
    expect(RELAY_PRESETS).toBe(TRANSPORT_PRESET_CATALOG);
  });
});
