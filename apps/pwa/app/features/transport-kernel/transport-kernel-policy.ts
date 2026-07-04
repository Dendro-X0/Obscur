import { isEngineLabStrictMode } from "@/app/engine-lab/engine-lab-policy";
import { requiresSqlitePersistence } from "@/app/features/runtime/native-persistence-policy";

/**
 * Transport kernel owns connectivity snapshot truth on native.
 * relay-recovery-policy delegates classification to @obscur/transport-engine.
 *
 * ENGINE LAB: authority by default. Legacy relay snapshot only when OBSCUR_ALLOW_LEGACY=1.
 */
export const isTransportKernelAuthority = (): boolean => {
  if (isEngineLabStrictMode()) {
    return true;
  }
  if (!requiresSqlitePersistence()) {
    return false;
  }
  if (process.env.NEXT_PUBLIC_OBSCUR_TRANSPORT_KERNEL === "0") {
    return false;
  }
  return true;
};
