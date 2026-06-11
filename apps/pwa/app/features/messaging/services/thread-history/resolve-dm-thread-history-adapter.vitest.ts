import { isDmKernelAuthority } from "@/app/features/dm-kernel/dm-kernel-policy";
import { dmKernelThreadHistoryStub } from "@/app/features/dm-kernel/dm-kernel-thread-history-stub";
import { dmThreadHistoryAdapter } from "./dm-adapter";
import type { ThreadHistoryPort } from "./port";

/**
 * Vitest alias target — ESM imports work under Vite; production resolver keeps
 * createRequire() so desktop shell builds can tree-shake legacy hydrate modules.
 */
const isDesktopDmKernelShipBuild = (): boolean => (
  process.env.NEXT_PUBLIC_DESKTOP_SHELL === "1"
  && process.env.NEXT_PUBLIC_OBSCUR_DM_KERNEL !== "0"
);

export const resolveDmThreadHistoryAdapter = (): ThreadHistoryPort => {
  if (isDmKernelAuthority() || isDesktopDmKernelShipBuild()) {
    return dmKernelThreadHistoryStub;
  }
  return dmThreadHistoryAdapter;
};
