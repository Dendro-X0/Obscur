/**
 * Cut 8.3 — prefer native Continuity ports when Tauri host is present.
 * Lab stubs only when OBSCUR_DESKTOP_UI_LAB_STUBS=1 or host absent.
 * ≠ Continuity Pass.
 */

import {
  resolveDesktopUiAdapterSource,
  type DesktopUiAdapterSource,
} from "../runtime/desktop-ui-adapter-selection";
import type { ContinuityPorts } from "./ports";

export type ContinuityPortSource = DesktopUiAdapterSource;

export type ResolveContinuityPortsParams = Readonly<{
  isNativeRuntime: boolean;
  forceLabStubs?: boolean;
  labPorts: ContinuityPorts;
  nativePorts: ContinuityPorts;
}>;

export type ResolvedContinuityPorts = Readonly<{
  ports: ContinuityPorts;
  source: ContinuityPortSource;
}>;

export const resolveDesktopUiContinuityPorts = (
  params: ResolveContinuityPortsParams,
): ResolvedContinuityPorts => {
  const source = resolveDesktopUiAdapterSource({
    isNativeRuntime: params.isNativeRuntime,
    forceLabStubs: params.forceLabStubs,
  });
  return {
    source,
    ports: source === "lab" ? params.labPorts : params.nativePorts,
  };
};
