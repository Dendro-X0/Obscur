import { isObscurAllowLegacy } from "@/app/engine-lab/engine-lab-policy";
import { isDmKernelAuthority } from "@/app/features/dm-kernel/dm-kernel-policy";
import { dmKernelThreadHistoryStub } from "@/app/features/dm-kernel/dm-kernel-thread-history-stub";
import type { ThreadHistoryPort } from "./port";

/**
 * Desktop static/Tauri builds always use the dm-kernel stub so webpack can drop
 * legacy hydrate modules from the shipped client bundle (P4).
 */
const isDesktopDmKernelShipBuild = (): boolean => (
  process.env.NEXT_PUBLIC_DESKTOP_SHELL === "1"
  && process.env.NEXT_PUBLIC_OBSCUR_DM_KERNEL !== "0"
);

const resolveLegacyDmThreadHistoryAdapter = (): ThreadHistoryPort => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { dmThreadHistoryAdapter } = require("./dm-adapter") as typeof import("./dm-adapter");
  return dmThreadHistoryAdapter;
};

/** Single DM materialization entry — dm-kernel / strict stub; legacy hydrate opt-in only. */
export const resolveDmThreadHistoryAdapter = (): ThreadHistoryPort => {
  if (isDmKernelAuthority() || isDesktopDmKernelShipBuild() || !isObscurAllowLegacy()) {
    return dmKernelThreadHistoryStub;
  }
  return resolveLegacyDmThreadHistoryAdapter();
};
