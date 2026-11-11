import {
  resolveDesktopUiAdapterSource,
  type DesktopUiAdapterSource,
} from "../runtime/desktop-ui-adapter-selection";
import type { PrivateTrustHomePorts } from "./ports";

export type PrivateTrustHomePortSource = DesktopUiAdapterSource;

export type ResolvePrivateTrustHomePortsParams = Readonly<{
  isNativeRuntime: boolean;
  forceLabStubs?: boolean;
  labPorts: PrivateTrustHomePorts;
  nativePorts: PrivateTrustHomePorts;
}>;

export type ResolvedPrivateTrustHomePorts = Readonly<{
  ports: PrivateTrustHomePorts;
  source: PrivateTrustHomePortSource;
}>;

/**
 * Cut 4.3 — prefer native PrivateTrustHomePorts when Tauri host is present.
 * Lab stubs only when forced or host absent.
 */
export const resolveDesktopUiPrivateTrustHomePorts = (
  params: ResolvePrivateTrustHomePortsParams,
): ResolvedPrivateTrustHomePorts => {
  const source = resolveDesktopUiAdapterSource({
    isNativeRuntime: params.isNativeRuntime,
    forceLabStubs: params.forceLabStubs,
  });
  return {
    source,
    ports: source === "lab" ? params.labPorts : params.nativePorts,
  };
};
