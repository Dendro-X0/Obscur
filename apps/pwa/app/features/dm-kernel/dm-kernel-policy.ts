import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";

/**
 * v2 slim kernel — native DM bypasses the R1 hydrate pipeline entirely.
 * Opt out only for emergency: NEXT_PUBLIC_OBSCUR_DM_KERNEL=0
 */
export const isDmKernelAuthority = (): boolean => {
  if (!requiresSqlitePersistence()) {
    return false;
  }
  if (process.env.NEXT_PUBLIC_OBSCUR_DM_KERNEL === "0") {
    return false;
  }
  return true;
};

/**
 * dm-kernel reads SQLite on thread open — automatic relay history replay is redundant
 * and causes main-thread setState storms. Explicit repair/backfill may still call sync with `since`.
 */
export const isDmKernelRelaySyncSuppressed = (): boolean => isDmKernelAuthority();
