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
  const { isNativeDmSqliteReadOwner } = require("../native-dm-read-policy") as typeof import("../native-dm-read-policy");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { dmThreadHistoryAdapter } = require("./dm-adapter") as typeof import("./dm-adapter");
  if (isNativeDmSqliteReadOwner()) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { nativeDmThreadHistoryAdapter } = require("./native-dm-adapter") as typeof import("./native-dm-adapter");
    return nativeDmThreadHistoryAdapter;
  }
  return dmThreadHistoryAdapter;
};

/** Single DM materialization entry — dm-kernel uses inert stub; web keeps R1 interim stack. */
export const resolveDmThreadHistoryAdapter = (): ThreadHistoryPort => {
  if (isDmKernelAuthority() || isDesktopDmKernelShipBuild()) {
    return dmKernelThreadHistoryStub;
  }
  return resolveLegacyDmThreadHistoryAdapter();
};
