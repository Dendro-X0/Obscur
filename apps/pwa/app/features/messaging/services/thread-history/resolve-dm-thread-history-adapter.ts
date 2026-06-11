import { createRequire } from "node:module";
import { isDmKernelAuthority } from "@/app/features/dm-kernel/dm-kernel-policy";
import { dmKernelThreadHistoryStub } from "@/app/features/dm-kernel/dm-kernel-thread-history-stub";
import type { ThreadHistoryPort } from "./port";

const requireModule = createRequire(import.meta.url);

/**
 * Desktop static/Tauri builds always use the dm-kernel stub so webpack can drop
 * legacy hydrate modules from the shipped client bundle (P4).
 */
const isDesktopDmKernelShipBuild = (): boolean => (
  process.env.NEXT_PUBLIC_DESKTOP_SHELL === "1"
  && process.env.NEXT_PUBLIC_OBSCUR_DM_KERNEL !== "0"
);

const resolveLegacyDmThreadHistoryAdapter = (): ThreadHistoryPort => {
  const { dmThreadHistoryAdapter } = requireModule("./dm-adapter") as typeof import("./dm-adapter");
  return dmThreadHistoryAdapter;
};

/** Single DM materialization entry — dm-kernel uses inert stub; web keeps R1 interim stack. */
export const resolveDmThreadHistoryAdapter = (): ThreadHistoryPort => {
  if (isDmKernelAuthority() || isDesktopDmKernelShipBuild()) {
    return dmKernelThreadHistoryStub;
  }
  return resolveLegacyDmThreadHistoryAdapter();
};
