import { describe, expect, it } from "vitest";

import {
  PRIVATE_LAN_WS_PRESET,
  TOR_ONION_MESH_PRESET,
} from "./transport-preset-catalog";
import {
  isTorPresetApplyBlocked,
  resolveTemplatePrefillUrl,
  resolveTorPresetBadgeKind,
  shouldConfirmPresetReplace,
  shouldConfirmTorPresetApply,
  shouldConfirmTransportPresetApply,
} from "./transport-preset-apply-policy";

describe("transport-preset-apply-policy", () => {
  it("requires confirm when relay list is non-empty", () => {
    expect(shouldConfirmPresetReplace([])).toBe(false);
    expect(shouldConfirmPresetReplace([{ url: "wss://nos.lol", enabled: true }])).toBe(true);
  });

  it("always confirms Tor pack apply even on empty list", () => {
    expect(shouldConfirmTorPresetApply(TOR_ONION_MESH_PRESET)).toBe(true);
    expect(shouldConfirmTorPresetApply(PRIVATE_LAN_WS_PRESET)).toBe(false);
    expect(shouldConfirmTransportPresetApply(TOR_ONION_MESH_PRESET, [])).toBe(true);
    expect(shouldConfirmTransportPresetApply(PRIVATE_LAN_WS_PRESET, [])).toBe(false);
  });

  it("blocks Tor packs until Tor is ready", () => {
    expect(isTorPresetApplyBlocked(TOR_ONION_MESH_PRESET, { configured: true, ready: false })).toBe(true);
    expect(isTorPresetApplyBlocked(TOR_ONION_MESH_PRESET, { configured: false, ready: false })).toBe(true);
    expect(isTorPresetApplyBlocked(TOR_ONION_MESH_PRESET, { configured: true, ready: true })).toBe(false);
    expect(isTorPresetApplyBlocked(PRIVATE_LAN_WS_PRESET, { configured: false, ready: false })).toBe(false);
  });

  it("shows Tor off when disabled and Tor not ready only while bootstrapping", () => {
    expect(resolveTorPresetBadgeKind(TOR_ONION_MESH_PRESET, { configured: false, ready: false })).toBe("off");
    expect(resolveTorPresetBadgeKind(TOR_ONION_MESH_PRESET, { configured: true, ready: false })).toBe("not_ready");
    expect(resolveTorPresetBadgeKind(TOR_ONION_MESH_PRESET, { configured: true, ready: true })).toBe("ready");
    expect(resolveTorPresetBadgeKind(PRIVATE_LAN_WS_PRESET, { configured: false, ready: false })).toBeNull();
  });

  it("returns template placeholder URL for template packs", () => {
    expect(resolveTemplatePrefillUrl(PRIVATE_LAN_WS_PRESET)).toBe("ws://192.168.0.100:7000");
    expect(resolveTemplatePrefillUrl(TOR_ONION_MESH_PRESET)).toBe("http://example.onion/mesh");
  });
});
