import { describe, expect, it } from "vitest";

import {
  resolveTauriEngineInvokeCommand,
  shouldRouteTransportExportOfflinePackToAsyncDesktopCommand,
  shouldRouteTransportImportOfflinePackToAsyncDesktopCommand,
} from "./tauri-engine-host";
import type { EngineInvokeRequest } from "@obscur/engine-contracts";

const scope = { profileId: "profile-a" };

describe("tauri-engine-host — RUST-6b offline pack routing", () => {
  it("routes exportOfflinePack to desktop async command", () => {
    const request: EngineInvokeRequest = {
      engine: "transport",
      method: "exportOfflinePack",
      scope,
      payload: {},
    };
    expect(shouldRouteTransportExportOfflinePackToAsyncDesktopCommand(request)).toBe(true);
    expect(resolveTauriEngineInvokeCommand(request)).toBe(
      "engine_invoke_transport_export_offline_pack",
    );
  });

  it("routes importOfflinePack to desktop async command", () => {
    const request: EngineInvokeRequest = {
      engine: "transport",
      method: "importOfflinePack",
      scope,
      payload: {},
    };
    expect(shouldRouteTransportImportOfflinePackToAsyncDesktopCommand(request)).toBe(true);
    expect(resolveTauriEngineInvokeCommand(request)).toBe(
      "engine_invoke_transport_import_offline_pack",
    );
  });

  it("does not route unrelated transport methods to offline commands", () => {
    const request: EngineInvokeRequest = {
      engine: "transport",
      method: "getMeshSnapshot",
      scope,
    };
    expect(shouldRouteTransportExportOfflinePackToAsyncDesktopCommand(request)).toBe(false);
    expect(resolveTauriEngineInvokeCommand(request)).toBe(
      "engine_invoke_transport_get_mesh_snapshot",
    );
  });
});
