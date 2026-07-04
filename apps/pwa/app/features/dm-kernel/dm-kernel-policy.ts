import { isEngineLabStrictMode } from "@/app/engine-lab/engine-lab-policy";
import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";

/**
 * v2 slim kernel — native DM bypasses the R1 hydrate pipeline entirely.
 * ENGINE LAB: authority by default. Legacy hydrate only when OBSCUR_ALLOW_LEGACY=1.
 */
export const isDmKernelAuthority = (): boolean => {
  if (isEngineLabStrictMode()) {
    return true;
  }
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
